import pc from "picocolors";
import { extractPageText } from "../browser/extractor.js";
import { WatchRepository } from "../db/repository.js";
import { buildCompactDiff } from "../judge/diff.js";
import { judgeDiff } from "../judge/judge.js";
import { sendPushNotification } from "../notify/ntfy.js";
import { computeHash } from "../text/hash.js";
import { normalizeText } from "../text/normalize.js";

interface RunOptions {
  local?: boolean;
}

export async function handleRun(idStr: string, options: RunOptions = {}): Promise<void> {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) {
    console.error(pc.red(`Error: "${idStr}" is not a valid watch ID.`));
    process.exitCode = 1;
    return;
  }

  const repo = new WatchRepository();
  const watch = repo.getWatchById(id);
  if (!watch) {
    console.error(pc.red(`Error: Watch with ID #${id} not found.`));
    process.exitCode = 1;
    return;
  }

  console.log(pc.bold(`\n🦥 SlothWatch Running Watch #${watch.id} — "${watch.name || watch.url}"`));
  console.log(`   ${pc.dim("Target URL:")} ${watch.url}`);
  if (watch.selector) {
    console.log(`   ${pc.dim("Selector:")}   ${watch.selector}`);
  }
  console.log(`   ${pc.dim("Care intent:")} ${watch.care}`);

  const run = repo.createRun(watch.id);
  const startTime = Date.now();

  try {
    console.log(pc.cyan(`\n1. Fetching page via browser...`));
    const { rawText, browserMs } = await extractPageText(watch.url, watch.selector, {
      forceLocal: options.local,
    });

    console.log(`   ✓ Extracted visible text in ${browserMs}ms (${rawText.length} raw chars)`);

    // Normalize text & compute SHA-256 hash
    console.log(pc.cyan(`2. Normalizing text and computing hash...`));
    const normalized = normalizeText(rawText);
    const hash = computeHash(normalized);
    console.log(`   ✓ Normalized to ${normalized.length} chars (Hash: ${hash.slice(0, 12)}...)`);

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
        reason: "Content hash identical to previous snapshot. Model call skipped.",
      });

      console.log(pc.green(pc.bold("\n✓ LAZY PAYOFF: Page content unchanged!")));
      console.log(`   ${pc.bold("Model calls avoided:")} 1 (0 LLM tokens used)`);
      console.log(`   ${pc.bold("Hash match:")}           ${hash.slice(0, 16)}...`);
      console.log(`   ${pc.bold("Total duration:")}        ${totalDuration}ms (Browser: ${browserMs}ms, Model: 0ms)\n`);
      return;
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
        summary: "Baseline snapshot established",
        reason: "First run established initial snapshot. Subsequent runs will compare against this hash.",
      });

      console.log(pc.green(pc.bold("\n✓ Initial baseline snapshot stored!")));
      console.log(`   ${pc.bold("Snapshot ID:")}    #${snapshot.id}`);
      console.log(`   ${pc.bold("Snapshot Hash:")}  ${hash.slice(0, 16)}...`);
      console.log(`   ${pc.bold("Total duration:")} ${totalDuration}ms (Browser: ${browserMs}ms, Model: 0ms)\n`);
      return;
    }

    // Case 3: Content changed! Build compact diff and invoke local judge
    console.log(pc.yellow(`\n3. Content changed! Building compact diff...`));
    const diffResult = buildCompactDiff(lastSnapshot.text, normalized);
    console.log(`   ✓ Diff: +${diffResult.addedLinesCount} lines, -${diffResult.removedLinesCount} lines`);
    if (diffResult.truncated) {
      console.log(`   ! Diff was capped to fit small model context safely.`);
    }

    console.log(pc.cyan(`\n4. Sending diff to local Gemma judge via Ollama...`));
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
        error: judgeResult.error || "Model output validation failed",
      });

      console.error(pc.red(pc.bold(`\n✗ JUDGE FAILED: ${judgeResult.error}`)));
      console.error(pc.dim("Run recorded as judge_failed in history. No push sent.\n"));
      process.exitCode = 1;
      return;
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
    });

    console.log(pc.bold("\n🦥 Judgment Result from Local Gemma:"));
    const mattersColor = judgment.matters ? pc.green(pc.bold("YES")) : pc.yellow(pc.bold("NO"));
    console.log(`   ${pc.bold("Matters:")} ${mattersColor}`);
    console.log(`   ${pc.bold("Summary:")} ${judgment.summary}`);
    console.log(`   ${pc.bold("Reason:")}  ${judgment.reason}`);
    console.log(
      `   ${pc.dim("Model stats:")} ${judgeResult.modelMs}ms | ${judgeResult.promptTokens} prompt tokens | ${judgeResult.completionTokens} completion tokens`
    );

    // If change matters, push notification to phone
    if (judgment.matters) {
      console.log(pc.cyan(`\n5. Dispatching push alert via ntfy...`));
      const pushTitle = watch.name || `Watch #${watch.id}`;
      const pushResult = await sendPushNotification({
        title: pushTitle,
        body: judgment.summary,
        url: watch.url,
        priority: "high",
      });

      if (pushResult.sent) {
        console.log(pc.green(pc.bold(`✓ 📱 Push alert dispatched to phone! (Action: ${watch.url})\n`)));
      } else {
        console.log(pc.yellow(`! Push dispatch failed: ${pushResult.error}\n`));
      }
    } else {
      console.log(pc.blue(`\nℹ️ Change filtered out as noise/unrelated. No push alert sent.\n`));
    }
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = (err as Error).message || String(err);

    repo.updateRun(run.id, {
      duration_ms: totalDuration,
      status: "error",
      error: errorMessage,
    });

    console.error(pc.red(pc.bold(`\n✗ Run failed: ${errorMessage}\n`)));
    process.exitCode = 1;
  }
}
