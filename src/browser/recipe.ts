import pc from "picocolors";
import type { BrowserSession } from "./session.js";

export interface RecipeStep {
  instruction: string;
  selector?: string;
  method?: string;
  arguments?: string[];
}

export interface RecipeExecutionResult {
  executed: boolean;
  replayed: boolean;
  fallback: boolean;
  steps: RecipeStep[];
}

/**
 * Resolves or executes an action on the page for a given instruction.
 * Tries direct Playwright locators first, then Stagehand act.
 */
async function discoverAndExecuteStep(
  session: BrowserSession,
  instruction: string
): Promise<{ selector: string; method?: string; arguments?: string[] }> {
  const trimmed = instruction.trim();

  // Pattern: wait <duration>
  const waitMatch = trimmed.match(/^wait\s+(\d+)\s*(s|sec|seconds|ms)?$/i);
  if (waitMatch) {
    const val = parseInt(waitMatch[1], 10);
    const unit = waitMatch[2]?.toLowerCase();
    const ms = unit === "ms" ? val : val * 1000;
    await session.page.waitForTimeout(ms);
    return { selector: `wait:${ms}`, method: "wait" };
  }

  // Pattern: scroll down / up
  if (/^scroll\s+(down|up)$/i.test(trimmed)) {
    const dir = trimmed.toLowerCase().includes("down") ? 600 : -600;
    await session.page.evaluate((d) => window.scrollBy(0, d), dir);
    await session.page.waitForTimeout(500);
    return { selector: `scroll:${dir}`, method: "scroll" };
  }

  // Extract clean target if instruction begins with "click " or "tap "
  let target = trimmed;
  const clickMatch = trimmed.match(/^(?:click|tap|press)\s+(?:on\s+)?(.+)$/i);
  if (clickMatch) {
    target = clickMatch[1].replace(/^["']|["']$/g, "").trim();
  }

  // Candidates for selector discovery in order of specificity
  const candidateSelectors: string[] = [];

  // If user passed a CSS-like selector (e.g. #id, .class, button[type=...])
  if (/^[#.[\]a-zA-Z0-9_\-:=>+~ ]+$/.test(target) && (target.startsWith("#") || target.startsWith(".") || target.startsWith("[") || target.includes("["))) {
    candidateSelectors.push(target);
  }

  // Common button/text heuristics
  candidateSelectors.push(
    `button:has-text("${target}")`,
    `a:has-text("${target}")`,
    `[role="button"]:has-text("${target}")`,
    `input[value="${target}"]`,
    `text="${target}"`,
    target
  );

  for (const sel of candidateSelectors) {
    try {
      const loc = session.page.locator(sel);
      const count = await loc.count();
      if (count > 0) {
        await loc.first().click({ timeout: 4000 });
        await session.page.waitForTimeout(500);
        return { selector: sel, method: "click" };
      }
    } catch {
      // Try next candidate
    }
  }

  // If local heuristics don't match, attempt Stagehand act
  try {
    const actResult = await session.stagehand.act(instruction);
    const discovered = actResult.data.actions?.[0];
    if (discovered?.selector) {
      return {
        selector: discovered.selector,
        method: discovered.method,
        arguments: discovered.arguments,
      };
    }
  } catch (err) {
    throw new Error(`Unable to execute recipe step "${instruction}": ${(err as Error).message}`);
  }

  throw new Error(`Could not find clickable element for recipe step: "${instruction}"`);
}

/**
 * Executes or records recipe steps on the active page.
 * - If a step has a known selector from a previous run, it executes deterministically
 *   without calling an LLM (pure replay).
 * - If a deterministic step fails, it falls back to re-discovery once
 *   and updates the recipe.
 * - On first run (no selector yet), it discovers and executes the step.
 */
export async function executeRecipe(
  session: BrowserSession,
  rawRecipeJson?: string | null
): Promise<RecipeExecutionResult> {
  if (!rawRecipeJson || rawRecipeJson.trim().length === 0) {
    return { executed: false, replayed: false, fallback: false, steps: [] };
  }

  let steps: RecipeStep[] = [];
  try {
    const parsed = JSON.parse(rawRecipeJson);
    if (Array.isArray(parsed)) {
      steps = parsed;
    } else if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { steps?: unknown[] }).steps)) {
      steps = (parsed as { steps: RecipeStep[] }).steps;
    }
  } catch {
    // If not JSON, treat raw string as a single instruction step
    steps = [{ instruction: rawRecipeJson }];
  }

  if (steps.length === 0) {
    return { executed: false, replayed: false, fallback: false, steps: [] };
  }

  let anyReplayed = false;
  let anyFallback = false;
  const updatedSteps: RecipeStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(pc.cyan(`   Step ${i + 1}/${steps.length}: "${step.instruction}"...`));

    // Handle wait/scroll special steps
    if (step.selector?.startsWith("wait:")) {
      const ms = parseInt(step.selector.replace("wait:", ""), 10) || 1000;
      await session.page.waitForTimeout(ms);
      anyReplayed = true;
      updatedSteps.push(step);
      console.log(pc.green(`     ✓ Replayed wait (${ms}ms)`));
      continue;
    }

    if (step.selector?.startsWith("scroll:")) {
      const d = parseInt(step.selector.replace("scroll:", ""), 10) || 500;
      await session.page.evaluate((delta) => window.scrollBy(0, delta), d);
      await session.page.waitForTimeout(500);
      anyReplayed = true;
      updatedSteps.push(step);
      console.log(pc.green(`     ✓ Replayed scroll (${d}px)`));
      continue;
    }

    // Case 1: We have a known selector -> Replay deterministically
    if (step.selector) {
      let replaySuccess = false;
      try {
        const locator = session.page.locator(step.selector);
        const count = await locator.count();
        if (count > 0) {
          await locator.first().click({ timeout: 4000 });
          await session.page.waitForTimeout(800);
          replaySuccess = true;
          anyReplayed = true;
          console.log(pc.green(`     ✓ Deterministic replay succeeded via selector "${step.selector}"`));
          updatedSteps.push(step);
        }
      } catch (err) {
        console.log(pc.yellow(`     ! Replay failed on selector "${step.selector}": ${(err as Error).message}`));
      }

      if (replaySuccess) {
        continue;
      }

      // Replay failed -> Fall back to re-discovery once
      console.log(pc.yellow(`     ↻ Re-discovery fallback: re-resolving "${step.instruction}"...`));
      anyFallback = true;
      try {
        const discovered = await discoverAndExecuteStep(session, step.instruction);
        updatedSteps.push({
          instruction: step.instruction,
          selector: discovered.selector,
          method: discovered.method,
          arguments: discovered.arguments,
        });
        console.log(pc.green(`     ✓ Re-discovery succeeded (Updated selector: "${discovered.selector}")`));
      } catch (fallbackErr) {
        throw new Error(`Recipe step "${step.instruction}" failed during re-discovery: ${(fallbackErr as Error).message}`);
      }
    } else {
      // Case 2: First run (no selector yet) -> Discover and record
      console.log(pc.cyan(`     [Discovering action for "${step.instruction}"]`));
      try {
        const discovered = await discoverAndExecuteStep(session, step.instruction);
        updatedSteps.push({
          instruction: step.instruction,
          selector: discovered.selector,
          method: discovered.method,
          arguments: discovered.arguments,
        });
        console.log(pc.green(`     ✓ Discovered and recorded selector: "${discovered.selector}"`));
      } catch (err) {
        throw new Error(`Initial execution of recipe step "${step.instruction}" failed: ${(err as Error).message}`);
      }
    }
  }

  return {
    executed: true,
    replayed: anyReplayed,
    fallback: anyFallback,
    steps: updatedSteps,
  };
}
