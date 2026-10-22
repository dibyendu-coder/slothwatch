import pc from "picocolors";
import { WatchRepository } from "../db/repository.js";
import { executeWatchRun, type RunResult } from "./run.js";

export interface RunAllOptions {
  interval?: string | number;
  force?: boolean;
  local?: boolean;
}

export interface RunAllSummaryItem {
  watchId: number;
  name: string;
  status: "success" | "unchanged" | "error" | "judge_failed" | "skipped";
  changed: boolean;
  matters: boolean | null;
  durationMs: number;
  replayed: boolean;
  recipeFallback: boolean;
  modelCalled: boolean;
  note: string;
}

function parseSqliteUtc(dateStr: string): number {
  if (dateStr.endsWith("Z")) {
    return new Date(dateStr).getTime();
  }
  return new Date(dateStr.replace(" ", "T") + "Z").getTime();
}

export async function handleRunAll(
  options: RunAllOptions = {},
  customRepo?: WatchRepository
): Promise<RunAllSummaryItem[]> {
  const repo = customRepo || new WatchRepository();
  const watches = repo.listWatches();

  if (watches.length === 0) {
    console.log(pc.yellow("\nNo watches configured."));
    console.log(`Add one with: ${pc.cyan('slothwatch add <url> --care "<what to watch for>"')}\n`);
    return [];
  }

  const intervalMinutes = typeof options.interval === "number"
    ? options.interval
    : parseInt(String(options.interval || "60"), 10) || 60;

  console.log(pc.bold(`\n🦥 SlothWatch Running All Watches (${watches.length} total)`));
  console.log(`   ${pc.dim("Interval rule:")} min ${intervalMinutes} min between runs (${options.force ? pc.yellow("FORCE MODE: ignoring interval") : "respecting interval"})`);
  if (options.local) {
    console.log(`   ${pc.dim("Browser engine:")} local Chrome`);
  }

  const results: RunAllSummaryItem[] = [];

  for (let i = 0; i < watches.length; i++) {
    const watch = watches[i];
    const displayName = watch.name || (watch.url.length > 35 ? watch.url.slice(0, 32) + "..." : watch.url);

    console.log(pc.bold(pc.cyan(`\n[${i + 1}/${watches.length}] Watch #${watch.id} — "${displayName}"`)));

    // Check minimum interval
    if (!options.force && watch.last_run_at) {
      const lastRunTime = parseSqliteUtc(watch.last_run_at);
      const elapsedMinutes = (Date.now() - lastRunTime) / (1000 * 60);

      if (elapsedMinutes < intervalMinutes) {
        const remaining = Math.ceil(intervalMinutes - elapsedMinutes);
        console.log(pc.dim(`   ⏭ Skipped: ran ${Math.floor(elapsedMinutes)}m ago (${remaining}m remaining before next scheduled run)`));
        results.push({
          watchId: watch.id,
          name: displayName,
          status: "skipped",
          changed: false,
          matters: null,
          durationMs: 0,
          replayed: false,
          recipeFallback: false,
          modelCalled: false,
          note: `Skipped (${remaining}m left)`,
        });
        continue;
      }
    }

    // Execute run safely: one failure must never abort the rest
    try {
      const res: RunResult = await executeWatchRun(watch.id, {
        local: options.local,
        silent: false,
      });

      let note = "";
      if (res.status === "unchanged") {
        note = "Unchanged (0 model calls)";
      } else if (res.status === "judge_failed") {
        note = `Judge failed: ${res.error || "validation"}`;
      } else if (res.status === "error") {
        note = `Error: ${res.error || "failed"}`;
      } else if (res.matters === true) {
        note = "Pushed alert";
      } else if (res.matters === false) {
        note = "Filtered (noise)";
      } else {
        note = res.summary || "Baseline snapshot";
      }

      if (res.recipeFallback) {
        note += " [fallback]";
      } else if (res.replayed) {
        note += " [replayed]";
      }

      results.push({
        watchId: watch.id,
        name: displayName,
        status: res.status,
        changed: res.changed,
        matters: res.matters,
        durationMs: res.durationMs,
        replayed: res.replayed,
        recipeFallback: res.recipeFallback,
        modelCalled: res.modelCalled,
        note,
      });
    } catch (err) {
      const errMsg = (err as Error).message || String(err);
      console.error(pc.red(`   ✗ Watch #${watch.id} crashed: ${errMsg}`));
      results.push({
        watchId: watch.id,
        name: displayName,
        status: "error",
        changed: false,
        matters: null,
        durationMs: 0,
        replayed: false,
        recipeFallback: false,
        modelCalled: false,
        note: `Crashed: ${errMsg}`,
      });
    }
  }

  // Print compact summary table
  printRunAllTable(results);

  return results;
}

function printRunAllTable(items: RunAllSummaryItem[]): void {
  console.log(pc.bold("\n📊 Run-All Execution Summary:"));
  console.log("─".repeat(88));
  console.log(
    `${pc.bold("ID".padEnd(4))} | ` +
    `${pc.bold("Target".padEnd(28))} | ` +
    `${pc.bold("Status".padEnd(12))} | ` +
    `${pc.bold("Changed".padEnd(8))} | ` +
    `${pc.bold("Time".padEnd(8))} | ` +
    `${pc.bold("Notes")}`
  );
  console.log("─".repeat(88));

  let ranCount = 0;
  let skippedCount = 0;
  let unchangedCount = 0;
  let pushedCount = 0;
  let errorCount = 0;

  for (const item of items) {
    if (item.status === "skipped") {
      skippedCount++;
    } else {
      ranCount++;
    }

    if (item.status === "unchanged") unchangedCount++;
    if (item.matters === true) pushedCount++;
    if (item.status === "error" || item.status === "judge_failed") errorCount++;

    const statusBadge =
      item.status === "success"
        ? pc.green("success")
        : item.status === "unchanged"
          ? pc.blue("unchanged")
          : item.status === "skipped"
            ? pc.dim("skipped")
            : pc.red(item.status);

    const changedStr = item.status === "skipped" ? "-" : item.changed ? "yes" : "no";
    const timeStr = item.durationMs > 0 ? `${(item.durationMs / 1000).toFixed(1)}s` : "-";
    const nameCol = item.name.length > 28 ? item.name.slice(0, 25) + "..." : item.name.padEnd(28);

    console.log(
      `${String(item.watchId).padEnd(4)} | ` +
      `${nameCol} | ` +
      `${statusBadge.padEnd(12)} | ` +
      `${changedStr.padEnd(8)} | ` +
      `${timeStr.padEnd(8)} | ` +
      `${item.note}`
    );
  }

  console.log("─".repeat(88));
  console.log(
    pc.bold(
      `Totals: ${items.length} watches | Ran: ${ranCount} | Skipped: ${skippedCount} | Unchanged: ${unchangedCount} | Pushed: ${pushedCount} | Errors: ${errorCount}`
    ) + "\n"
  );
}
