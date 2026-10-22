import { Command } from "commander";
import { runDoctor } from "./doctor.js";

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

  return program;
}
