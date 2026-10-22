import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../src/db/client.js";
import { WatchRepository } from "../src/db/repository.js";

const testDbPath = path.resolve(process.cwd(), "test_slothwatch.db");

describe("WatchRepository", () => {
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
      } catch {
        // Ignore file lock on Windows exit
      }
    }
  });

  it("adds and retrieves a watch", () => {
    const watch = repo.addWatch({
      url: "https://example.com/deadlines",
      care: "Watch for application deadline changes",
      name: "Scholarship Portal",
      selector: "#announcements",
    });

    expect(watch.id).toBeGreaterThan(0);
    expect(watch.name).toBe("Scholarship Portal");
    expect(watch.url).toBe("https://example.com/deadlines");
    expect(watch.selector).toBe("#announcements");

    const fetched = repo.getWatchById(watch.id);
    expect(fetched?.care).toBe("Watch for application deadline changes");
  });

  it("lists watches with their latest run status", () => {
    const list = repo.listWatches();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].name).toBe("Scholarship Portal");
  });

  it("stores and fetches snapshots", () => {
    const watch = repo.addWatch({
      url: "https://example.com/test",
      care: "Any change",
    });

    const run = repo.createRun(watch.id);
    const snap1 = repo.insertSnapshot({
      watch_id: watch.id,
      run_id: run.id,
      text: "Version 1 content",
      hash: "hash_v1",
    });

    const latest = repo.getLatestSnapshot(watch.id);
    expect(latest?.hash).toBe("hash_v1");
    expect(latest?.id).toBe(snap1.id);
  });

  it("removes a watch and cascades deletion", () => {
    const watch = repo.addWatch({
      url: "https://example.com/to-delete",
      care: "Temporary watch",
    });

    const removed = repo.removeWatch(watch.id);
    expect(removed).toBe(true);
    expect(repo.getWatchById(watch.id)).toBeNull();
  });
});
