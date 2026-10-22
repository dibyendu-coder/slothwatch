import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeStats } from "../src/cli/stats.js";
import { closeDatabase, getDatabase } from "../src/db/client.js";
import { WatchRepository } from "../src/db/repository.js";

const testDbPath = path.resolve(process.cwd(), "test_stats.db");

describe("Stats and Lazy Payoff Calculation", () => {
  let repo: WatchRepository;

  beforeAll(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
    const db = getDatabase(testDbPath);
    repo = new WatchRepository(db);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  it("calculates accurate stats, model calls avoided, and manual time saved", () => {
    const w1 = repo.addWatch({
      url: "https://example.com/item1",
      care: "watch price drop",
      name: "Item 1",
    });

    const w2 = repo.addWatch({
      url: "https://example.com/item2",
      care: "watch releases",
      name: "Item 2",
    });

    // Watch 1: 3 runs (1 baseline, 2 unchanged)
    const r1 = repo.createRun(w1.id);
    repo.updateRun(r1.id, {
      duration_ms: 3000,
      browser_ms: 2500,
      model_ms: 0,
      status: "success",
      changed: 1,
      model_called: 0,
      replayed: 0,
      recipe_fallback: 0,
    });

    const r2 = repo.createRun(w1.id);
    repo.updateRun(r2.id, {
      duration_ms: 2000,
      browser_ms: 2000,
      model_ms: 0,
      status: "unchanged",
      changed: 0,
      model_called: 0,
      replayed: 1,
      recipe_fallback: 0,
    });

    const r3 = repo.createRun(w1.id);
    repo.updateRun(r3.id, {
      duration_ms: 2100,
      browser_ms: 2100,
      model_ms: 0,
      status: "unchanged",
      changed: 0,
      model_called: 0,
      replayed: 1,
      recipe_fallback: 0,
    });

    // Watch 2: 2 runs (1 baseline, 1 changed with model call)
    const r4 = repo.createRun(w2.id);
    repo.updateRun(r4.id, {
      duration_ms: 4000,
      browser_ms: 3500,
      model_ms: 0,
      status: "success",
      changed: 1,
      model_called: 0,
      replayed: 0,
      recipe_fallback: 0,
    });

    const r5 = repo.createRun(w2.id);
    repo.updateRun(r5.id, {
      duration_ms: 8000,
      browser_ms: 3000,
      model_ms: 5000,
      status: "success",
      changed: 1,
      model_called: 1,
      matters: 1,
      prompt_tokens: 300,
      completion_tokens: 50,
      replayed: 1,
      recipe_fallback: 0,
    });

    const stats = computeStats({ manualMins: "3" }, testDbPath);

    expect(stats.totalWatches).toBe(2);
    expect(stats.totalRuns).toBe(5);
    expect(stats.totalUnchangedRuns).toBe(2);
    expect(stats.totalModelCallsAvoided).toBe(2);
    expect(stats.totalModelCallsMade).toBe(1);
    expect(stats.totalTokens).toBe(350);
    expect(stats.totalReplayRuns).toBe(3);
    expect(stats.manualMinsAssumption).toBe(3);
    expect(stats.totalManualMinutesSaved).toBe(15); // 5 runs * 3 min = 15

    const w1Stats = stats.watchStats.find((s) => s.watchId === w1.id)!;
    expect(w1Stats.runs).toBe(3);
    expect(w1Stats.modelCallsAvoided).toBe(2);
    expect(w1Stats.modelCallsMade).toBe(0);
    expect(w1Stats.replayCount).toBe(2);

    const w2Stats = stats.watchStats.find((s) => s.watchId === w2.id)!;
    expect(w2Stats.runs).toBe(2);
    expect(w2Stats.modelCallsMade).toBe(1);
    expect(w2Stats.totalTokens).toBe(350);
  });
});
