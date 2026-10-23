import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import pc from "picocolors";
import { getDatabase, closeDatabase } from "../src/db/client.js";
import { WatchRepository } from "../src/db/repository.js";
import { executeWatchRun } from "../src/cli/run.js";
import { handleStats } from "../src/cli/stats.js";

async function runDemo(): Promise<void> {
  console.log(pc.bold("\n🦥 ─────────────────────────────────────────────────────────────"));
  console.log(pc.bold("  SlothWatch Interactive Recorded Demo"));
  console.log(pc.bold("  Lazy Web-Chore Watcher • Zero-Cloud-AI • Local Gemma + Browserbase"));
  console.log(pc.bold("─────────────────────────────────────────────────────────────\n"));

  // Isolate demo into a dedicated test database
  const demoDbPath = path.resolve(process.cwd(), "slothwatch-demo.db");
  process.env.DATABASE_PATH = demoDbPath;
  if (fs.existsSync(demoDbPath)) {
    fs.unlinkSync(demoDbPath);
  }

  // 1. Start local mock web page server
  let pageContent = `
    <html>
      <head><title>Hackathon Submission Portal</title></head>
      <body>
        <h1>DEV Open-Source AI Challenge 2026</h1>
        <p id="applicant">Team: SlothWatch</p>
        <div id="status">
          <strong>Application Status:</strong> Submitted & Under Review
        </div>
        <p id="timestamp">Server Time: 2026-10-23 10:00:00 UTC</p>
      </body>
    </html>
  `;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(pageContent);
  });

  const PORT = 9284;
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  const testUrl = `http://localhost:${PORT}/`;
  console.log(pc.green(`✓ Local test page server active at ${testUrl}\n`));

  try {
    // 2. Initialize DB and add demo watch
    const db = getDatabase(demoDbPath);
    const repo = new WatchRepository(db);
    const watch = repo.addWatch({
      url: testUrl,
      care: "Tell me if my application status changes or results are announced",
      name: "DEV Hackathon Results Watcher",
    });

    console.log(pc.cyan(`[Step 1] Configured Watch #${watch.id}:`));
    console.log(`  Target URL: ${testUrl}`);
    console.log(`  Care Rule:  "${watch.care}"\n`);

    // 3. First Run: Cold Baseline Extraction
    console.log(pc.bold(pc.yellow("▶ [Run 1] First Check: Creating baseline snapshot...")));
    await executeWatchRun(watch.id, { local: true });
    console.log("");

    // 4. Second Run: Unchanged page (demonstrates Lazy First / 0 model calls)
    console.log(pc.bold(pc.yellow("▶ [Run 2] Second Check: Unchanged page (Lazy Hash Match)...")));
    await executeWatchRun(watch.id, { local: true });
    console.log(pc.green("  ⚡ Zero model calls! Hash matched previous snapshot instantly.\n"));

    // 5. Simulate real page change
    console.log(pc.bold(pc.magenta("▶ [Simulating Change] The judges have updated the portal!")));
    pageContent = `
      <html>
        <head><title>Hackathon Submission Portal</title></head>
        <body>
          <h1>DEV Open-Source AI Challenge 2026</h1>
          <p id="applicant">Team: SlothWatch</p>
          <div id="status">
            <strong>Application Status:</strong> ACCEPTED AS WINNER! Congratulations!
          </div>
          <p id="timestamp">Server Time: 2026-10-23 12:30:00 UTC</p>
        </body>
      </html>
    `;
    console.log(pc.dim("  Diff updated: 'Under Review' ➔ 'ACCEPTED AS WINNER!'\n"));

    // 6. Third Run: Change detected -> Local Gemma judges
    console.log(pc.bold(pc.yellow("▶ [Run 3] Third Check: Diff detected ➔ Local Gemma evaluates...")));
    await executeWatchRun(watch.id, { local: true });
    console.log("");

    // 7. Display Stats Report
    console.log(pc.bold(pc.cyan("▶ [Lazy Payoff Report] Execution Efficiency & Time Saved:")));
    handleStats({ manualMins: "2" });

    console.log(pc.bold(pc.green("\n✓ Demo completed successfully! Clean exit.")));
  } finally {
    closeDatabase();
    server.close();
    // Clean up demo db files
    for (const ext of ["", "-shm", "-wal"]) {
      const p = `${demoDbPath}${ext}`;
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }
  }
}

runDemo().catch((err) => {
  console.error(pc.red(`\nDemo error: ${(err as Error).message}`));
  process.exit(1);
});
