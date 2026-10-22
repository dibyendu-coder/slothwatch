import pc from "picocolors";
import { extractPageText } from "../browser/extractor.js";
import { WatchRepository } from "../db/repository.js";
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

    // Normalize text
    console.log(pc.cyan(`2. Normalizing text and computing hash...`));
    const normalized = normalizeText(rawText);
    const hash = computeHash(normalized);
    console.log(`   ✓ Normalized to ${normalized.length} chars (Hash: ${hash.slice(0, 12)}...)`);

    // Check last snapshot
    const lastSnapshot = repo.getLatestSnapshot(watch.id);

    if (lastSnapshot && lastSnapshot.hash === hash) {
      // Unchanged! Lazy payoff: Zero model calls!
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

    if (!lastSnapshot) {
      // First run: Establish baseline snapshot
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
        summary: "Baseline snapshot established",
        reason: "First run established initial snapshot. Subsequent runs will compare against this hash.",
      });

      console.log(pc.green(pc.bold("\n✓ Initial baseline snapshot stored!")));
      console.log(`   ${pc.bold("Snapshot ID:")}    #${snapshot.id}`);
      console.log(`   ${pc.bold("Snapshot Hash:")}  ${hash.slice(0, 16)}...`);
      console.log(`   ${pc.bold("Total duration:")} ${totalDuration}ms (Browser: ${browserMs}ms)\n`);
      return;
    }

    // Content changed (new hash != old hash)
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
      summary: "Page content changed",
      reason: `Hash changed from ${lastSnapshot.hash.slice(0, 12)} to ${hash.slice(0, 12)}.`,
    });

    console.log(pc.yellow(pc.bold("\n! Page content changed from previous snapshot!")));
    console.log(`   ${pc.dim("Previous hash:")}  ${lastSnapshot.hash.slice(0, 16)}...`);
    console.log(`   ${pc.bold("New hash:")}       ${hash.slice(0, 16)}...`);
    console.log(`   ${pc.dim("New Snapshot ID:")} #${snapshot.id}`);
    console.log(`   ${pc.dim("(Phase 2 will pass diff to local Gemma for judgment)")}\n`);
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
