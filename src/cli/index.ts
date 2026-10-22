import { Command } from "commander";
import { handleAdd } from "./add.js";
import { runDoctor } from "./doctor.js";
import { handleHistory } from "./history.js";
import { handleList } from "./list.js";
import { handleRemove } from "./remove.js";
import { handleRun } from "./run.js";

export function createProgram(): Command {
  const program = new Command("slothwatch");

  program
    .name("slothwatch")
    .description("A lazy web-chore watcher powered by Browserbase, local Gemma, and ntfy")
    .version("0.1.0");

  program
    .command("doctor")
    .description("Verify environment variables, Browserbase auth, Ollama reachability, and ntfy setup")
    .action(async () => {
      const ok = await runDoctor();
      if (!ok) {
        process.exitCode = 1;
      }
    });

  program
    .command("add <url>")
    .description("Add a web page to watch")
    .requiredOption("-c, --care <description>", "What change to watch for (plain English)")
    .option("-s, --selector <css>", "Optional CSS selector to narrow down the target area")
    .option("-n, --name <label>", "Optional human-readable label for this watch")
    .action((url, options) => {
      handleAdd(url, options);
    });

  program
    .command("list")
    .description("List all configured watches and their last run status")
    .action(() => {
      handleList();
    });

  program
    .command("remove <id>")
    .description("Remove a watch and its run history")
    .action((id) => {
      handleRemove(id);
    });

  program
    .command("run <id>")
    .description("Execute a single watch run")
    .option("-l, --local", "Force using local Chrome browser instead of Browserbase cloud")
    .action(async (id, options) => {
      await handleRun(id, options);
    });

  program
    .command("history <id>")
    .description("Display run and judgment history for a watch")
    .action((id) => {
      handleHistory(id);
    });

  return program;
}
