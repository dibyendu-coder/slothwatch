import type Database from "better-sqlite3";
import { getDatabase } from "./client.js";

export interface Watch {
  id: number;
  name: string | null;
  url: string;
  care: string;
  selector: string | null;
  recipe_json: string | null;
  created_at: string;
}

export interface Run {
  id: number;
  watch_id: number;
  started_at: string;
  duration_ms: number | null;
  status: "success" | "unchanged" | "error";
  changed: number; // 0 or 1
  model_called: number; // 0 or 1
  matters: number | null; // 0, 1, or null
  summary: string | null;
  reason: string | null;
  error: string | null;
  browser_ms: number;
  model_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface Snapshot {
  id: number;
  watch_id: number;
  run_id: number | null;
  text: string;
  hash: string;
  created_at: string;
}

export interface WatchWithLastRun extends Watch {
  last_run_status: string | null;
  last_run_at: string | null;
  last_snapshot_at: string | null;
}

export class WatchRepository {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb || getDatabase();
  }

  addWatch(data: {
    url: string;
    care: string;
    name?: string;
    selector?: string;
    recipe_json?: string;
  }): Watch {
    const stmt = this.db.prepare(`
      INSERT INTO watches (name, url, care, selector, recipe_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.name || null,
      data.url,
      data.care,
      data.selector || null,
      data.recipe_json || null
    );

    return this.getWatchById(Number(result.lastInsertRowid))!;
  }

  getWatchById(id: number): Watch | null {
    const stmt = this.db.prepare(`SELECT * FROM watches WHERE id = ?`);
    const row = stmt.get(id);
    return (row as Watch) || null;
  }

  listWatches(): WatchWithLastRun[] {
    const stmt = this.db.prepare(`
      SELECT 
        w.*,
        r.status AS last_run_status,
        r.started_at AS last_run_at,
        s.created_at AS last_snapshot_at
      FROM watches w
      LEFT JOIN runs r ON r.id = (
        SELECT id FROM runs WHERE watch_id = w.id ORDER BY id DESC LIMIT 1
      )
      LEFT JOIN snapshots s ON s.id = (
        SELECT id FROM snapshots WHERE watch_id = w.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY w.id ASC
    `);
    return stmt.all() as WatchWithLastRun[];
  }

  removeWatch(id: number): boolean {
    const stmt = this.db.prepare(`DELETE FROM watches WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getLatestSnapshot(watchId: number): Snapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots 
      WHERE watch_id = ? 
      ORDER BY id DESC 
      LIMIT 1
    `);
    const row = stmt.get(watchId);
    return (row as Snapshot) || null;
  }

  insertSnapshot(data: {
    watch_id: number;
    run_id: number | null;
    text: string;
    hash: string;
  }): Snapshot {
    const stmt = this.db.prepare(`
      INSERT INTO snapshots (watch_id, run_id, text, hash)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.watch_id,
      data.run_id,
      data.text,
      data.hash
    );

    const getStmt = this.db.prepare(`SELECT * FROM snapshots WHERE id = ?`);
    return getStmt.get(Number(result.lastInsertRowid)) as Snapshot;
  }

  createRun(watchId: number): Run {
    const stmt = this.db.prepare(`
      INSERT INTO runs (watch_id, status)
      VALUES (?, 'running')
    `);
    const result = stmt.run(watchId);

    const getStmt = this.db.prepare(`SELECT * FROM runs WHERE id = ?`);
    return getStmt.get(Number(result.lastInsertRowid)) as Run;
  }

  updateRun(
    runId: number,
    data: Partial<Omit<Run, "id" | "watch_id" | "started_at">>
  ): void {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => (data as Record<string, unknown>)[k]);

    const stmt = this.db.prepare(`UPDATE runs SET ${setClause} WHERE id = ?`);
    stmt.run(...values, runId);
  }
}
