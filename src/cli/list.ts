import pc from "picocolors";
import { WatchRepository } from "../db/repository.js";

export function handleList(): void {
  const repo = new WatchRepository();
  const watches = repo.listWatches();

  console.log(pc.bold("\n🦥 SlothWatch — Watched Pages\n"));

  if (watches.length === 0) {
    console.log("  No watches configured yet.");
    console.log(`  Use ${pc.cyan('slothwatch add <url> --care "<what matters>"')} to create one.\n`);
    return;
  }

  for (const w of watches) {
    const statusColor =
      w.last_run_status === "success"
        ? pc.green
        : w.last_run_status === "unchanged"
          ? pc.blue
          : w.last_run_status === "error"
            ? pc.red
            : pc.gray;

    const statusBadge = w.last_run_status ? statusColor(`[${w.last_run_status}]`) : pc.gray("[no runs]");

    console.log(`  ${pc.bold(`#${w.id}`)} ${w.name ? pc.bold(`"${w.name}" `) : ""}${statusBadge}`);
    console.log(`     ${pc.dim("URL:")}  ${w.url}`);
    console.log(`     ${pc.dim("Care:")} ${w.care}`);
    if (w.selector) {
      console.log(`     ${pc.dim("Selector:")} ${w.selector}`);
    }
    if (w.last_run_at) {
      console.log(`     ${pc.dim("Last run:")} ${w.last_run_at}`);
    }
    console.log("");
  }
}
