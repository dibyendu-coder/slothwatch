# PLAN.md — phases

Deadline: Oct 25, 2026, 11:59 PM PDT (Oct 26, about 12:29 PM IST). Target: submit by evening Oct 25 IST at latest.
Mark each box when done. Do one phase at a time and stop for review at the end of each.

## Phase 0 — Setup (target: today)
- [x] Init repo, TypeScript, ESLint/prettier, vitest, commander skeleton
- [x] `.env.example`, `.gitignore` (env, db files, logs)
- [x] `doctor` command: checks Browserbase auth, Ollama reachable + model pulled, ntfy topic
- [x] README stub with challenge name and "built in challenge window" note
- [x] NOTES.md started

## Phase 1 — Walking skeleton
- [x] SQLite schema + migrations
- [x] `add`, `list`, `remove`
- [x] Browserbase session via Stagehand, navigate, extract visible text
- [x] Normalize + hash + snapshot store
- [x] `run <id>` stores snapshot, second run reports unchanged with zero model calls
- [x] Tests for hashing and normalization

## Phase 2 — Local judge + push
- [x] Ollama client (chat endpoint, JSON output, timeouts, token counts)
- [x] Compact diff builder
- [x] zod-validated judgment, retry once on invalid JSON, then fail safe
- [x] ntfy push on `matters: true`
- [x] Noise test: timestamp-only change does not push
- [x] End-to-end on a page I control

## Phase 3 — Lazy features and numbers
- [x] Recipe record + replay (verify Stagehand support first, fallback own store)
- [x] `run-all`, minimum interval guard
- [x] Run metrics recorded
- [x] `stats` command
- [x] `history`

## Phase 4 — Benchmark and polish
- [x] Same watch list judged by 2-3 open models, table of success, time, tokens
- [x] Three real demo chores
- [x] Failure-case log: where small Gemma failed and what the design change was (for the honest section of the post)
- [x] README final, install under 10 minutes

## Phase 5 — Ship
- [ ] Tiny landing page on .tech domain (claim at hacktoberfest.com/my/promos), links to repo and post
- [ ] Short demo GIF or video: set up, laptop sleeps, phone buzzes
- [ ] Save agent session (DevRelay and/or Entire) for embedding
- [ ] DEV post using the Slow and Steady template, with Lazy Payoff section and Prize Categories section
- [ ] Final check: new project, commits within window, no secrets in history

## Post notes to collect while building (put in NOTES.md)
- Real numbers: model calls avoided, first-run vs repeat-run time, tokens, manual minutes saved
- What failed with small Gemma and how the split design fixed it
- Why open mattered at each step (privacy, swapping models, zero cost)
- One surprising thing learned
