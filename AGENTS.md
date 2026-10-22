# AGENTS.md — rules for the coding agent

Read this file first, then SPEC.md, then PLAN.md. Work one phase at a time.

## What we are building
SlothWatch: a lazy web-chore watcher. User describes in plain English what to watch on a web page. A cloud browser (Browserbase + Stagehand) fetches the page on a schedule. A local open-weight model (Gemma via Ollama) decides if the change matters. Phone gets a push (ntfy) only when it matters. Nothing to do for the user.

Built for DEV "Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady". Categories targeted: Overall, Best Use of Browserbase, Best Use of Gemma, Best Use of a .tech Domain, Best Use of Entire (agent session shared). Only claim what is genuinely used.

## Hard constraints
- Deadline: Oct 25, 2026, 11:59 PM PDT. Ship early. A working small thing beats a broken big thing.
- Project must be new and started inside the challenge window. Keep commits honest and frequent. Any commit after the deadline must be noted in README.
- Open-source AI must be what makes it work: Gemma runs locally through Ollama. No closed model API anywhere in the core path.
- Page text is judged locally. Never send page content to a closed API.
- Secrets only in `.env` (gitignored). Never in code, prompts, logs, or commits. Provide `.env.example`.
- Agent never submits forms, pays, or sends messages on the user's behalf. Read-only watching only.

## Stack
- TypeScript, Node 20+, ESM.
- `@browserbasehq/stagehand` for browser sessions (Browserbase cloud).
- Ollama HTTP API (`http://localhost:11434`) for Gemma. Model name from config, default a small Gemma tag the user has pulled.
- SQLite via `better-sqlite3` for state.
- `commander` for CLI, `zod` for schemas, `vitest` for tests.
- ntfy (`https://ntfy.sh/<topic>`) for push.
- Scheduling: plain cron or a `slothwatch run-all` command; no daemon needed.

## Do not guess APIs
Stagehand's API changes between versions. Before writing Stagehand code, read the current docs: https://docs.stagehand.dev/v4/first-steps/quickstart and the installed package types. Check what the installed version supports for: session creation, page access, `extract`, `observe`, `act`, caching, custom/local model clients. If something in SPEC.md does not exist, tell me and pick the simplest fallback. Same for Ollama: verify the model is pulled with `ollama list` before use.

## Design principles
1. Lazy first. Cheapest path wins: if page text hash is unchanged, skip the model entirely.
2. Split the work. Browser does navigation and extraction deterministically. Gemma only reasons over extracted text. Small models are unreliable at driving clicks, so do not depend on it.
3. Honest metrics. Record real numbers per run (see SPEC.md Stats). They go in the write-up.
4. Small, readable code. No framework sprawl. Every module has one job.
5. Fail loudly and safely. A failed run is logged and reported, never silently treated as "no change".

## Working style
- Before each phase: restate the goal in 3 lines, list files you will touch.
- After each phase: run tests and a real end-to-end check, then summarize what works, what does not, and numbers measured.
- Commit after each working step with a clear message.
- Update README as you go (install, config, usage). Keep a running `NOTES.md` with surprises, failures, and measured numbers. I will use it for the blog post.
- If blocked more than 2 attempts on the same problem, stop and ask me.
- Do not add features outside PLAN.md without asking.

## Definition of done
`slothwatch add` + `run-all` on a real page produces a stored snapshot, a Gemma judgment, and a phone push on a real change, with a `stats` report showing time and model calls saved on repeat runs.
