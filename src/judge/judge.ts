import { callOllamaChat, type ChatMessage } from "./ollama.js";
import { JudgmentSchema, type Judgment } from "./schema.js";

export interface JudgeOptions {
  model?: string;
  host?: string;
  timeoutMs?: number;
}

export interface JudgeResult {
  success: boolean;
  judgment?: Judgment;
  error?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  modelMs: number;
  retried: boolean;
}

const SYSTEM_PROMPT = `You are SlothWatch's local change judge.
Your sole job is to evaluate a web page diff against the user's plain English "care" instruction.

Rules:
1. Return ONLY a valid JSON object with this exact structure:
{
  "matters": <boolean>,
  "summary": "<1 or 2 short lines describing the key change if it matters, or a brief note if not>",
  "reason": "<brief justification for why it matches or fails the care instruction>"
}

2. NOISE FILTERING:
- Timestamps, relative times ("just now", "5m ago"), clocks, dates DO NOT matter unless the care instruction explicitly asks for them.
- View counters, visitor counts, like counts, and dynamic session IDs DO NOT matter.
- Advertisements, tracking notices, cookie banners, navigation menus, and layout whitespace DO NOT matter.
- If the only difference in the diff is noise, counters, or timestamps, set "matters": false.

3. USER INTENT & SEMANTICS:
- Phrases like "Notify me when X", "Alert me if X", or "Tell me if X" describe the condition X to detect on the page. If the diff shows that condition X occurred (e.g., item restocked, deadline shifted, status changed), set "matters": true.
- Do NOT treat "notify me" as asking whether the website added a notification feature or button.
- If the instruction specifies a numeric condition (e.g., "drops below $300"), check the numbers strictly: if the new value does not meet the criteria, set "matters": false.
- "matters" is true ONLY IF the change directly and meaningfully satisfies what the user cares about.
- Keep the summary to maximum 2 short lines.
- Output raw JSON only. Never wrap in markdown code blocks.`;

export async function judgeDiff(
  care: string,
  diffText: string,
  options: JudgeOptions = {}
): Promise<JudgeResult> {
  let promptTokens = 0;
  let completionTokens = 0;
  let modelMs = 0;
  let usedModel = options.model || "gemma4:e2b";

  const userPrompt = `USER CARE INSTRUCTION:
"${care}"

PAGE DIFF (- removed, + added):
${diffText}

Does this change matter to what the user cares about? Output valid JSON only.`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  // Attempt 1
  try {
    const res1 = await callOllamaChat(messages, options);
    promptTokens += res1.promptTokens;
    completionTokens += res1.completionTokens;
    modelMs += res1.modelMs;
    usedModel = res1.model;

    const parsed1 = parseJsonSafely(res1.rawContent);
    const validated1 = JudgmentSchema.safeParse(parsed1);

    if (validated1.success) {
      return {
        success: true,
        judgment: validated1.data,
        model: usedModel,
        promptTokens,
        completionTokens,
        modelMs,
        retried: false,
      };
    }
  } catch (err) {
    // If connection/timeout error on attempt 1, rethrow
    return {
      success: false,
      error: `judge_failed: ${(err as Error).message}`,
      model: usedModel,
      promptTokens,
      completionTokens,
      modelMs,
      retried: false,
    };
  }

  // Attempt 2 (Retry once with stricter prompt)
  const retryPrompt = `Your previous output was invalid. You MUST output STRICT JSON only conforming to:
{"matters": true or false, "summary": "max 2 lines", "reason": "brief reason"}

No conversational text, no markdown backticks.

USER CARE INSTRUCTION:
"${care}"

PAGE DIFF:
${diffText}`;

  const retryMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: retryPrompt },
  ];

  try {
    const res2 = await callOllamaChat(retryMessages, options);
    promptTokens += res2.promptTokens;
    completionTokens += res2.completionTokens;
    modelMs += res2.modelMs;
    usedModel = res2.model;

    const parsed2 = parseJsonSafely(res2.rawContent);
    const validated2 = JudgmentSchema.safeParse(parsed2);

    if (validated2.success) {
      return {
        success: true,
        judgment: validated2.data,
        model: usedModel,
        promptTokens,
        completionTokens,
        modelMs,
        retried: true,
      };
    }

    return {
      success: false,
      error: `judge_failed: Model output failed schema validation after retry: ${validated2.error.message}. Output was: "${res2.rawContent.slice(0, 100)}"`,
      model: usedModel,
      promptTokens,
      completionTokens,
      modelMs,
      retried: true,
    };
  } catch (err) {
    return {
      success: false,
      error: `judge_failed: ${(err as Error).message}`,
      model: usedModel,
      promptTokens,
      completionTokens,
      modelMs,
      retried: true,
    };
  }
}

function parseJsonSafely(raw: string): unknown {
  // Strip optional markdown fences if model returned them
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // If model returned text with json embedded, try extracting outermost braces
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
