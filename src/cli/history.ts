import pc from "picocolors";
import { WatchRepository } from "../db/repository.js";

export function handleHistory(idStr: string): void {
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

  const runs = repo.getRunsForWatch(watch.id);

  console.log(pc.bold(`\n🦥 SlothWatch Run History for Watch #${watch.id} — "${watch.name || watch.url}"`));
  console.log(`   ${pc.dim("Care intent:")} ${watch.care}\n`);

  if (runs.length === 0) {
    console.log("   No runs recorded yet.");
    console.log(`   Execute with ${pc.cyan(`slothwatch run ${watch.id}`)}\n`);
    return;
  }

  for (const r of runs) {
    const statusColor =
      r.status === "success"
        ? pc.green
        : r.status === "unchanged"
          ? pc.blue
          : r.status === "judge_failed"
            ? pc.magenta
            : pc.red;

    const mattersTag =
      r.matters === 1
        ? pc.green(pc.bold(" [MATTERS: YES (PUSHED)]"))
        : r.matters === 0
          ? pc.yellow(" [MATTERS: NO]")
          : "";

    console.log(
      `  ${pc.bold(`Run #${r.id}`)} ${statusColor(`[${r.status}]`)}${mattersTag} — ${pc.dim(r.started_at)}`
    );

    if (r.duration_ms) {
      console.log(
        `     ${pc.dim("Time:")} ${r.duration_ms}ms (Browser: ${r.browser_ms}ms, Model: ${r.model_ms}ms)`
      );
    }

    if (r.model_called === 1) {
      console.log(
        `     ${pc.dim("Tokens:")} ${r.prompt_tokens} prompt / ${r.completion_tokens} completion`
      );
    } else {
      console.log(`     ${pc.dim("Model calls:")} 0 (Skipped via hash match)`);
    }

    if (r.summary) {
      console.log(`     ${pc.dim("Summary:")} ${r.summary}`);
    }
    if (r.reason) {
      console.log(`     ${pc.dim("Reason:")}  ${r.reason}`);
    }
    if (r.error) {
      console.log(`     ${pc.red(`Error:   ${r.error}`)}`);
    }
    console.log("");
  }
}
