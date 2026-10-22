import pc from "picocolors";
import { WatchRepository } from "../db/repository.js";

interface AddOptions {
  care: string;
  name?: string;
  selector?: string;
}

export function handleAdd(url: string, options: AddOptions): void {
  if (!url) {
    console.error(pc.red("Error: URL is required."));
    process.exitCode = 1;
    return;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    console.error(pc.red(`Error: "${url}" is not a valid URL.`));
    process.exitCode = 1;
    return;
  }

  if (!options.care || options.care.trim().length === 0) {
    console.error(pc.red("Error: --care description is required (what change to watch for)."));
    process.exitCode = 1;
    return;
  }

  const repo = new WatchRepository();
  const watch = repo.addWatch({
    url: url.trim(),
    care: options.care.trim(),
    name: options.name?.trim(),
    selector: options.selector?.trim(),
  });

  console.log(pc.green(pc.bold("\n✓ Watch registered successfully!")));
  console.log(`  ${pc.bold("ID:")}       ${watch.id}`);
  console.log(`  ${pc.bold("Name:")}     ${watch.name || "(none)"}`);
  console.log(`  ${pc.bold("URL:")}      ${watch.url}`);
  console.log(`  ${pc.bold("Care:")}     ${watch.care}`);
  if (watch.selector) {
    console.log(`  ${pc.bold("Selector:")} ${watch.selector}`);
  }
  console.log(`\nRun ${pc.cyan(`slothwatch run ${watch.id}`)} to perform the initial snapshot.\n`);
}
