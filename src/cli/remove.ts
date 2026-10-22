import pc from "picocolors";
import { WatchRepository } from "../db/repository.js";

export function handleRemove(idStr: string): void {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) {
    console.error(pc.red(`Error: "${idStr}" is not a valid watch ID.`));
    process.exitCode = 1;
    return;
  }

  const repo = new WatchRepository();
  const existing = repo.getWatchById(id);
  if (!existing) {
    console.error(pc.red(`Error: Watch with ID #${id} not found.`));
    process.exitCode = 1;
    return;
  }

  const ok = repo.removeWatch(id);
  if (ok) {
    console.log(pc.green(`\n✓ Watch #${id} (${existing.name || existing.url}) removed.\n`));
  } else {
    console.error(pc.red(`Failed to remove watch #${id}.`));
    process.exitCode = 1;
  }
}
