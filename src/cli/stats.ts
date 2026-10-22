import pc from "picocolors";
import { getDatabase } from "../db/client.js";
import { WatchRepository } from "../db/repository.js";

export interface StatsOptions {
  manualMins?: string | number;
}

export interface WatchStats {
  watchId: number;
  name: string;
  url: string;
  runs: number;
  unchangedRuns: number;
  modelCallsAvoided: number;
  modelCallsMade: number;
  avgBrowserMs: number;
  avgModelMs: number;
  totalTokens: number;
  firstRunAvgMs: number;
  replayRunAvgMs: number;
  replayCount: number;
  fallbackCount: number;
  manualMinutesSaved: number;
}

export interface GlobalStats {
  totalWatches: number;
  totalRuns: number;
  totalUnchangedRuns: number;
  totalModelCallsAvoided: number;
  totalModelCallsMade: number;
  avgBrowserMs: number;
  avgModelMs: number;
  totalTokens: number;
  totalReplayRuns: number;
  totalFallbackRuns: number;
  totalManualMinutesSaved: number;
  manualMinsAssumption: number;
  watchStats: WatchStats[];
}

export function computeStats(options: StatsOptions = {}, customDbPath?: string): GlobalStats {
  const db = getDatabase(customDbPath);
  const repo = new WatchRepository(db);
  const watches = repo.listWatches();

  const manualMinsAssumption = typeof options.manualMins === "number"
    ? options.manualMins
    : parseFloat(String(options.manualMins || "2")) || 2;

  const watchStats: WatchStats[] = [];

  let grandTotalRuns = 0;
  let grandTotalUnchanged = 0;
  let grandTotalAvoided = 0;
  let grandTotalMade = 0;
  let grandTotalBrowserMs = 0;
  let grandTotalModelMs = 0;
  let grandTotalTokens = 0;
  let grandTotalReplays = 0;
  let grandTotalFallbacks = 0;

  for (const watch of watches) {
    const runs = repo.getRunsForWatch(watch.id).filter((r) => r.status !== "running");
    const count = runs.length;

    let unchangedCount = 0;
    let avoidedCount = 0;
    let madeCount = 0;
    let browserMsSum = 0;
    let modelMsSum = 0;
    let tokensSum = 0;

    const firstRunTimes: number[] = [];
    const replayTimes: number[] = [];
    let fallbackCount = 0;

    for (const r of runs) {
      if (r.status === "unchanged") {
        unchangedCount++;
        avoidedCount++;
      }
      if (r.model_called === 1) {
        madeCount++;
        modelMsSum += r.model_ms;
      }
      browserMsSum += r.browser_ms;
      tokensSum += (r.prompt_tokens || 0) + (r.completion_tokens || 0);

      if (r.replayed === 1) {
        replayTimes.push(r.duration_ms || r.browser_ms);
      } else {
        firstRunTimes.push(r.duration_ms || r.browser_ms);
      }

      if (r.recipe_fallback === 1) {
        fallbackCount++;
      }
    }

    const avgBrowserMs = count > 0 ? Math.round(browserMsSum / count) : 0;
    const avgModelMs = madeCount > 0 ? Math.round(modelMsSum / madeCount) : 0;
    const firstRunAvgMs = firstRunTimes.length > 0
      ? Math.round(firstRunTimes.reduce((a, b) => a + b, 0) / firstRunTimes.length)
      : 0;
    const replayRunAvgMs = replayTimes.length > 0
      ? Math.round(replayTimes.reduce((a, b) => a + b, 0) / replayTimes.length)
      : 0;

    grandTotalRuns += count;
    grandTotalUnchanged += unchangedCount;
    grandTotalAvoided += avoidedCount;
    grandTotalMade += madeCount;
    grandTotalBrowserMs += browserMsSum;
    grandTotalModelMs += modelMsSum;
    grandTotalTokens += tokensSum;
    grandTotalReplays += replayTimes.length;
    grandTotalFallbacks += fallbackCount;

    watchStats.push({
      watchId: watch.id,
      name: watch.name || watch.url,
      url: watch.url,
      runs: count,
      unchangedRuns: unchangedCount,
      modelCallsAvoided: avoidedCount,
      modelCallsMade: madeCount,
      avgBrowserMs,
      avgModelMs,
      totalTokens: tokensSum,
      firstRunAvgMs,
      replayRunAvgMs,
      replayCount: replayTimes.length,
      fallbackCount,
      manualMinutesSaved: count * manualMinsAssumption,
    });
  }

  const globalAvgBrowserMs = grandTotalRuns > 0 ? Math.round(grandTotalBrowserMs / grandTotalRuns) : 0;
  const globalAvgModelMs = grandTotalMade > 0 ? Math.round(grandTotalModelMs / grandTotalMade) : 0;

  return {
    totalWatches: watches.length,
    totalRuns: grandTotalRuns,
    totalUnchangedRuns: grandTotalUnchanged,
    totalModelCallsAvoided: grandTotalAvoided,
    totalModelCallsMade: grandTotalMade,
    avgBrowserMs: globalAvgBrowserMs,
    avgModelMs: globalAvgModelMs,
    totalTokens: grandTotalTokens,
    totalReplayRuns: grandTotalReplays,
    totalFallbackRuns: grandTotalFallbacks,
    totalManualMinutesSaved: grandTotalRuns * manualMinsAssumption,
    manualMinsAssumption,
    watchStats,
  };
}

export function handleStats(options: StatsOptions = {}): void {
  const stats = computeStats(options);

  console.log(pc.bold("\n🦥 SlothWatch Lazy Payoff & Efficiency Report"));
  console.log(pc.dim("━".repeat(84)));

  if (stats.totalWatches === 0) {
    console.log(pc.yellow("No watches configured yet."));
    return;
  }

  // Global summary banner
  const lazyRatio = stats.totalRuns > 0
    ? ((stats.totalModelCallsAvoided / stats.totalRuns) * 100).toFixed(1)
    : "0.0";

  console.log(
    ` ${pc.bold("Total Watches:")}          ${pc.cyan(String(stats.totalWatches))} configured`
  );
  console.log(
    ` ${pc.bold("Total Runs Executed:")}    ${pc.cyan(String(stats.totalRuns))} (${stats.totalUnchangedRuns} unchanged / ${stats.totalRuns - stats.totalUnchangedRuns} changed or initial)`
  );
  console.log(
    ` ${pc.bold("Model Calls Avoided:")}   ${pc.green(pc.bold(String(stats.totalModelCallsAvoided)))} avoided by content hash check (${pc.green(`${lazyRatio}% lazy hit rate`)})`
  );
  console.log(
    ` ${pc.bold("Model Calls Made:")}      ${pc.yellow(String(stats.totalModelCallsMade))} (local Gemma only)`
  );
  console.log(
    ` ${pc.bold("Avg Browser Session:")}    ${pc.cyan(`${(stats.avgBrowserMs / 1000).toFixed(2)}s`)}`
  );
  console.log(
    ` ${pc.bold("Avg Model Latency:")}     ${pc.cyan(`${(stats.avgModelMs / 1000).toFixed(2)}s`)} (when change detected)`
  );
  console.log(
    ` ${pc.bold("Total Local Tokens:")}     ${pc.cyan(String(stats.totalTokens))} tokens`
  );
  console.log(
    ` ${pc.bold("Recipe Replays:")}         ${pc.green(String(stats.totalReplayRuns))} pure replays, ${pc.yellow(String(stats.totalFallbackRuns))} re-discovery fallbacks`
  );
  console.log(
    ` ${pc.bold("Manual Time Saved:")}      ${pc.green(pc.bold(`${stats.totalManualMinutesSaved} minutes`))} ${pc.dim(`*(estimated assuming ${stats.manualMinsAssumption} min per manual check)*`)}`
  );

  console.log(pc.dim("━".repeat(84)));
  console.log(pc.bold("📋 Breakdown Per Watch:"));
  console.log("─".repeat(84));
  console.log(
    `${pc.bold("ID".padEnd(4))} | ` +
    `${pc.bold("Target".padEnd(24))} | ` +
    `${pc.bold("Runs".padEnd(6))} | ` +
    `${pc.bold("Avoided".padEnd(8))} | ` +
    `${pc.bold("Tokens".padEnd(8))} | ` +
    `${pc.bold("Browser".padEnd(8))} | ` +
    `${pc.bold("Replay vs 1st")}`
  );
  console.log("─".repeat(84));

  for (const w of stats.watchStats) {
    const targetLabel = w.name.length > 24 ? w.name.slice(0, 21) + "..." : w.name.padEnd(24);
    const replayComp = w.replayCount > 0
      ? `${(w.replayRunAvgMs / 1000).toFixed(1)}s vs ${(w.firstRunAvgMs / 1000).toFixed(1)}s`
      : `${(w.firstRunAvgMs / 1000).toFixed(1)}s (1st)`;

    console.log(
      `${String(w.watchId).padEnd(4)} | ` +
      `${targetLabel} | ` +
      `${String(w.runs).padEnd(6)} | ` +
      `${String(w.modelCallsAvoided).padEnd(8)} | ` +
      `${String(w.totalTokens).padEnd(8)} | ` +
      `${`${(w.avgBrowserMs / 1000).toFixed(1)}s`.padEnd(8)} | ` +
      `${replayComp}`
    );
  }
  console.log("─".repeat(84) + "\n");
}
