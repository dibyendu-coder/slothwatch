import pc from "picocolors";
import { extractPageText } from "../browser/extractor.js";
import { WatchRepository } from "../db/repository.js";
import { buildCompactDiff } from "../judge/diff.js";
import { judgeDiff } from "../judge/judge.js";
import { sendPushNotification } from "../notify/ntfy.js";
import { computeHash } from "../text/hash.js";
import { normalizeText } from "../text/normalize.js";

export interface RunOptions {
  local?: boolean;
  silent?: boolean;
}

export interface RunResult {
  runId: number;
  watchId: number;
  status: "success" | "unchanged" | "error" | "judge_failed";
  changed: boolean;
  matters: boolean | null;
  modelCalled: boolean;
  replayed: boolean;
  recipeFallback: boolean;
  durationMs: number;
  browserMs: number;
  modelMs: number;
  error?: string;
  summary?: string;
  reason?: string;
}

export async function executeWatchRun(watchId: number, options: RunOptions = {}): Promise<RunResult> {
  const repo = new WatchRepository();
  const watch = repo.getWatchById(watchId);
  if (!watch) {
    throw new Error(`Watch with ID #${watchId} not found.`);
  }

  const log = (msg: string) => {
    if (!options.silent) {
      console.log(msg);
    }
  };

  log(pc.bold(`\n🦥 SlothWatch Running Watch #${watch.id} — "${watch.name || watch.url}"`));
  log(`   ${pc.dim("Target URL:")} ${watch.url}`);
  if (watch.selector) {
    log(`   ${pc.dim("Selector:")}   ${watch.selector}`);
  }
  log(`   ${pc.dim("Care intent:")} ${watch.care}`);

  const run = repo.createRun(watch.id);
  const startTime = Date.now();

  try {
    log(pc.cyan(`\n1. Fetching page via browser...`));
    const { rawText, browserMs, replayed, recipeFallback, updatedRecipe } = await extractPageText(
      watch.url,
      watch.selector,
      watch.recipe_json,
      { forceLocal: options.local }
    );

    // If recipe steps were discovered or updated through fallback, persist to watch
    if (updatedRecipe && updatedRecipe.length > 0) {
      repo.updateWatchRecipe(watch.id, JSON.stringify(updatedRecipe));
    }

    log(`   ✓ Extracted visible text in ${browserMs}ms (${rawText.length} raw chars)`);
    if (replayed) {
      log(pc.green(`   ✓ Replayed actions deterministically (0 model calls)`));
    }
    if (recipeFallback) {
      log(pc.yellow(`   ! Re-discovery fallback occurred and updated recipe`));
    }

    // Normalize text & compute SHA-256 hash
    log(pc.cyan(`2. Normalizing text and computing hash...`));
    const normalized = normalizeText(rawText);
    const hash = computeHash(normalized);
    log(`   ✓ Normalized to ${normalized.length} chars (Hash: ${hash.slice(0, 12)}...)`);

    // Check last snapshot
    const lastSnapshot = repo.getLatestSnapshot(watch.id);

    // Case 1: Unchanged
    if (lastSnapshot && lastSnapshot.hash === hash) {
      const totalDuration = Date.now() - startTime;
      repo.updateRun(run.id, {
        duration_ms: totalDuration,
        status: "unchanged",
        changed: 0,
        model_called: 0,
        browser_ms: browserMs,
        model_ms: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        replayed: replayed ? 1 : 0,
        recipe_fallback: recipeFallback ? 1 : 0,
        reason: "Content hash identical to previous snapshot. Model call skipped.",
      });

      log(pc.green(pc.bold("\n✓ LAZY PAYOFF: Page content unchanged!")));
      log(`   ${pc.bold("Model calls avoided:")} 1 (0 LLM tokens used)`);
      log(`   ${pc.bold("Hash match:")}           ${hash.slice(0, 16)}...`);
      log(`   ${pc.bold("Total duration:")}        ${totalDuration}ms (Browser: ${browserMs}ms, Model: 0ms)\n`);

      return {
        runId: run.id,
        watchId: watch.id,
        status: "unchanged",
        changed: false,
        matters: null,
        modelCalled: false,
        replayed,
        recipeFallback,
        durationMs: totalDuration,
        browserMs,
        modelMs: 0,
        reason: "Content hash identical to previous snapshot.",
      };
    }

    // Case 2: First run (Establish baseline)
    if (!lastSnapshot) {
      const snapshot = repo.insertSnapshot({
        watch_id: watch.id,
        run_id: run.id,
        text: normalized,
        hash,
      });

      const totalDuration = Date.now() - startTime;
      repo.updateRun(run.id, {
        duration_ms: totalDuration,
        status: "success",
        changed: 1,
        model_called: 0,
        browser_ms: browserMs,
        model_ms: 0,
        replayed: replayed ? 1 : 0,
        recipe_fallback: recipeFallback ? 1 : 0,
        summary: "Baseline snapshot established",
        reason: "First run established initial snapshot. Subsequent runs will compare against this hash.",
      });

      log(pc.green(pc.bold("\n✓ Initial baseline snapshot stored!")));
      log(`   ${pc.bold("Snapshot ID:")}    #${snapshot.id}`);
      log(`   ${pc.bold("Snapshot Hash:")}  ${hash.slice(0, 16)}...`);
      log(`   ${pc.bold("Total duration:")} ${totalDuration}ms (Browser: ${browserMs}ms, Model: 0ms)\n`);

      return {
        runId: run.id,
        watchId: watch.id,
        status: "success",
        changed: true,
        matters: null,
        modelCalled: false,
        replayed,
        recipeFallback,
        durationMs: totalDuration,
        browserMs,
        modelMs: 0,
        summary: "Baseline snapshot established",
      };
    }

    // Case 3: Content changed! Build compact diff and invoke local judge
    log(pc.yellow(`\n3. Content changed! Building compact diff...`));
    const diffResult = buildCompactDiff(lastSnapshot.text, normalized);
    log(`   ✓ Diff: +${diffResult.addedLinesCount} lines, -${diffResult.removedLinesCount} lines`);
    if (diffResult.truncated) {
      log(`   ! Diff was capped to fit small model context safely.`);
    }

    log(pc.cyan(`\n4. Sending diff to local Gemma judge via Ollama...`));
    const judgeResult = await judgeDiff(watch.care, diffResult.diffText);

    if (!judgeResult.success) {
      const totalDuration = Date.now() - startTime;
      repo.updateRun(run.id, {
        duration_ms: totalDuration,
        status: "judge_failed",
        changed: 1,
        model_called: 1,
        browser_ms: browserMs,
        model_ms: judgeResult.modelMs,
        prompt_tokens: judgeResult.promptTokens,
        completion_tokens: judgeResult.completionTokens,
        replayed: replayed ? 1 : 0,
        recipe_fallback: recipeFallback ? 1 : 0,
        error: judgeResult.error || "Model output validation failed",
      });

      if (!options.silent) {
        console.error(pc.red(pc.bold(`\n✗ JUDGE FAILED: ${judgeResult.error}`)));
        console.error(pc.dim("Run recorded as judge_failed in history. No push sent.\n"));
      }

      return {
        runId: run.id,
        watchId: watch.id,
        status: "judge_failed",
        changed: true,
        matters: null,
        modelCalled: true,
        replayed,
        recipeFallback,
        durationMs: totalDuration,
        browserMs,
        modelMs: judgeResult.modelMs,
        error: judgeResult.error,
      };
    }

    const judgment = judgeResult.judgment!;
    const snapshot = repo.insertSnapshot({
      watch_id: watch.id,
      run_id: run.id,
      text: normalized,
      hash,
    });

    const totalDuration = Date.now() - startTime;
    repo.updateRun(run.id, {
      duration_ms: totalDuration,
      status: "success",
      changed: 1,
      model_called: 1,
      matters: judgment.matters ? 1 : 0,
      summary: judgment.summary,
      reason: judgment.reason,
      browser_ms: browserMs,
      model_ms: judgeResult.modelMs,
      prompt_tokens: judgeResult.promptTokens,
      completion_tokens: judgeResult.completionTokens,
      replayed: replayed ? 1 : 0,
      recipe_fallback: recipeFallback ? 1 : 0,
    });

    log(pc.bold("\n🦥 Judgment Result from Local Gemma:"));
    const mattersColor = judgment.matters ? pc.green(pc.bold("YES")) : pc.yellow(pc.bold("NO"));
    log(`   ${pc.bold("Matters:")} ${mattersColor}`);
    log(`   ${pc.bold("Summary:")} ${judgment.summary}`);
    log(`   ${pc.bold("Reason:")}  ${judgment.reason}`);
    log(
      `   ${pc.dim("Model stats:")} ${judgeResult.modelMs}ms | ${judgeResult.promptTokens} prompt tokens | ${judgeResult.completionTokens} completion tokens`
    );

    // If change matters, push notification to phone
    if (judgment.matters) {
      log(pc.cyan(`\n5. Dispatching push alert via ntfy...`));
      const pushTitle = watch.name || `Watch #${watch.id}`;
      const pushResult = await sendPushNotification({
        title: pushTitle,
        body: judgment.summary,
        url: watch.url,
        priority: "high",
      });

      if (pushResult.sent) {
        log(pc.green(pc.bold(`✓ 📱 Push alert dispatched to phone! (Action: ${watch.url})\n`)));
      } else {
        log(pc.yellow(`! Push dispatch failed: ${pushResult.error}\n`));
      }
    } else {
      log(pc.blue(`\nℹ️ Change filtered out as noise/unrelated. No push alert sent.\n`));
    }

    return {
      runId: run.id,
      watchId: watch.id,
      status: "success",
      changed: true,
      matters: judgment.matters,
      modelCalled: true,
      replayed,
      recipeFallback,
      durationMs: totalDuration,
      browserMs,
      modelMs: judgeResult.modelMs,
      summary: judgment.summary,
      reason: judgment.reason,
    };
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = (err as Error).message || String(err);

    repo.updateRun(run.id, {
      duration_ms: totalDuration,
      status: "error",
      error: errorMessage,
    });

    if (!options.silent) {
      console.error(pc.red(pc.bold(`\n✗ Run failed: ${errorMessage}\n`)));
    }

    return {
      runId: run.id,
      watchId: watch.id,
      status: "error",
      changed: false,
      matters: null,
      modelCalled: false,
      replayed: false,
      recipeFallback: false,
      durationMs: totalDuration,
      browserMs: 0,
      modelMs: 0,
      error: errorMessage,
    };
  }
}

export async function handleRun(idStr: string, options: RunOptions = {}): Promise<void> {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) {
    console.error(pc.red(`Error: "${idStr}" is not a valid watch ID.`));
    process.exitCode = 1;
    return;
  }

  const result = await executeWatchRun(id, options);
  if (result.status === "error" || result.status === "judge_failed") {
    process.exitCode = 1;
  }
}
