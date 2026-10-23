import { Command } from "commander";
import { handleAdd } from "./add.js";
import { handleBench } from "./bench.js";
import { runDoctor } from "./doctor.js";
import { handleHistory } from "./history.js";
import { handleList } from "./list.js";
import { handleRemove } from "./remove.js";
import { handleRun } from "./run.js";
import { handleRunAll } from "./run-all.js";
import { handleScheduleHelp } from "./schedule-help.js";
import { handleStats } from "./stats.js";

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
    .option(
      "--step <instruction>",
      "Pre-extraction recipe step in plain English (e.g. 'click Accept', 'wait 2s'). Can be repeated.",
      (val: string, prev: string[]) => prev.concat([val]),
      []
    )
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
    .command("run-all")
    .description("Execute runs for every configured watch, respecting minimum run intervals")
    .option("-i, --interval <minutes>", "Minimum interval between runs in minutes (default: 60)", "60")
    .option("-f, --force", "Bypass minimum interval rule and run all watches immediately")
    .option("-l, --local", "Force using local Chrome browser instead of Browserbase cloud")
    .action(async (options) => {
      await handleRunAll(options);
    });

  program
    .command("stats")
    .description("Display Lazy Payoff efficiency report: model calls avoided, timing, and manual time saved")
    .option("-m, --manual-mins <minutes>", "Estimated manual minutes saved per check (default: 2)", "2")
    .action((options) => {
      handleStats(options);
    });

  program
    .command("history <id>")
    .description("Display run and judgment history for a watch")
    .option("-n, --limit <count>", "Number of recent runs to display (default: 10)", "10")
    .action((id, options) => {
      handleHistory(id, options);
    });

  program
    .command("schedule-help")
    .description("Display copy-paste scheduling commands for your operating system")
    .action(() => {
      handleScheduleHelp();
    });

  program
    .command("bench")
    .description("Benchmark open-weight models against a fixed suite of real and noise diffs")
    .option(
      "-m, --models <tags>",
      "Comma-separated list of Ollama model tags (default: gemma4:e2b,gemma4:e4b,llama3.2:3b)",
      "gemma4:e2b,gemma4:e4b,llama3.2:3b"
    )
    .option("-c, --cases <path>", "Path to cases JSON file (default: bench/cases.json)")
    .action(async (options) => {
      await handleBench(options);
    });

  return program;
}
