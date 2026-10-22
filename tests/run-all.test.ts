import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleRunAll } from "../src/cli/run-all.js";
import * as runModule from "../src/cli/run.js";
import { closeDatabase, getDatabase } from "../src/db/client.js";
import { WatchRepository } from "../src/db/repository.js";

const testDbPath = path.resolve(process.cwd(), "test_runall.db");

describe("run-all Interval Guard and Fault Isolation", () => {
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
    vi.restoreAllMocks();
  });

  it("skips watches within the minimum interval unless force is specified", async () => {
    const w1 = repo.addWatch({
      url: "https://example.com/one",
      care: "check price",
      name: "Watch 1",
    });

    // Simulate run 10 minutes ago
    const r1 = repo.createRun(w1.id);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
    repo.db.prepare("UPDATE runs SET started_at = ?, status = 'success' WHERE id = ?").run(tenMinutesAgo, r1.id);

    const mockExecute = vi.spyOn(runModule, "executeWatchRun").mockResolvedValue({
      runId: 99,
      watchId: w1.id,
      status: "unchanged",
      changed: false,
      matters: null,
      modelCalled: false,
      replayed: false,
      recipeFallback: false,
      durationMs: 1500,
      browserMs: 1500,
      modelMs: 0,
    });

    // 1. Run without force: interval is 60m, elapsed is 10m -> should SKIP
    const results1 = await handleRunAll({ interval: 60, force: false }, repo);
    expect(results1.length).toBe(1);
    expect(results1[0].status).toBe("skipped");
    expect(mockExecute).not.toHaveBeenCalled();

    // 2. Run with force: should execute
    const results2 = await handleRunAll({ interval: 60, force: true }, repo);
    expect(results2.length).toBe(1);
    expect(results2[0].status).toBe("unchanged");
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("ensures a failing watch does not abort subsequent watches", async () => {
    const wFail = repo.addWatch({
      url: "https://example.com/fail",
      care: "check errors",
      name: "Failing Watch",
    });

    const wPass = repo.addWatch({
      url: "https://example.com/pass",
      care: "check pass",
      name: "Passing Watch",
    });

    vi.spyOn(runModule, "executeWatchRun").mockImplementation(async (watchId: number) => {
      if (watchId === wFail.id) {
        throw new Error("Target site timed out / navigation crashed");
      }
      return {
        runId: 101,
        watchId: wPass.id,
        status: "success",
        changed: true,
        matters: true,
        modelCalled: true,
        replayed: false,
        recipeFallback: false,
        durationMs: 2000,
        browserMs: 1200,
        modelMs: 800,
      };
    });

    const results = await handleRunAll({ force: true }, repo);

    // We have 3 watches in this test DB: w1, wFail, wPass
    const failItem = results.find((r) => r.watchId === wFail.id);
    const passItem = results.find((r) => r.watchId === wPass.id);

    expect(failItem).toBeDefined();
    expect(failItem?.status).toBe("error");
    expect(failItem?.note).toContain("Target site timed out");

    expect(passItem).toBeDefined();
    expect(passItem?.status).toBe("success");
    expect(passItem?.matters).toBe(true);
  });
});
