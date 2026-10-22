# NOTES.md — SlothWatch Development Notes & Blog Log

Running log of surprises, failures, design pivots, and real measured numbers for the DEV challenge write-up.

## Environment & Baseline Setup (Oct 22, 2026)
- **Node runtime**: Node v22.17.0 on Windows.
- **Local Model Available**: Verified via `ollama list`:
  - `gemma4:e2b` (4.6 GB) — Selected as primary default local judge.
  - `gemma4:e4b` (6.6 GB)
- **Stagehand SDK version**: `@browserbasehq/stagehand@4.3.0`.
- **Surprise / API Finding**:
  - Stagehand v4 splits browser launching (`browserbase.launch()`) from agent creation (`Stagehand.create({ browser })`).
  - Stagehand v4 has no native multi-step recipe record/replay mechanism; caching is managed server-side on Browserbase for LLM actions (`act`, `observe`, `extract`).
  - To respect "Lazy first" and zero-token deterministic extraction, page text should be read directly via `page.evaluate(() => document.body.innerText)` or `page.locator(selector).innerText()`, rather than calling `stagehand.extract()` which invokes an LLM.
  - Stagehand v4 requires keeping Zod on `zod@~4.4.3`.

## Phase 0 Notes
- Initialized TypeScript ESM project with `commander`, `better-sqlite3`, `zod@~4.4.3`, and `vitest`.
- Implemented `slothwatch doctor` command to validate Browserbase auth, Ollama reachable + model check, and ntfy topic.

## Phase 1 Notes & Measured Numbers
- Implemented SQLite repository with WAL mode and foreign key cascades for `watches`, `runs`, and `snapshots`.
- Implemented deterministic text extraction using Stagehand (`browserbase.launch` with fallback to `localBrowser.launch` for offline development/testing).
- Implemented SHA-256 text normalization and hashing with full Vitest test coverage (10 tests passing across 3 test files).
- CLI commands implemented: `add`, `list`, `remove`, `run`, `doctor`.
- **Surprises & Gotchas**:
  - `better-sqlite3` on Windows locks file descriptors; unit tests must call `db.close()` before cleanup unlinks database files.
  - Stagehand v4 requires calling both `stagehand.close()` and `browser.close()` for clean process and cloud session shutdown.
  - ntfy topic endpoints return 404 on HEAD requests when empty; the doctor command checks `${NTFY_SERVER}/v1/health` for server status.

## Phase 2 Notes & Measured Numbers
- **Model Tag Used**: `gemma4:e2b` via local Ollama HTTP chat endpoint (`http://localhost:11434/api/chat`).
- **Inference Timing**:
  - Cold model load (first time reading weights from disk into memory): ~60-65 seconds.
  - Warm inference latency: 6,805 ms – 16,729 ms per judgment.
  - Prompt tokens per judgment: ~300 – 435 tokens (compact diff keeps token usage low).
  - Completion tokens per judgment: ~47 – 67 tokens.
- **Compact Diff Performance**:
  - Lines diffed: omitted unchanged lines to conserve context window for 2B model.
  - Capped safely with truncation notification when diff exceeds max limits.
- **Real End-to-End Test Results**:
  1. **Check A (Meaningful Change)**:
     - Diff: `- Status: Review in progress. Final results pending.` -> `+ Status: Congratulations! Your application has been ACCEPTED as a WINNER! Results announced.`
     - Judgment: `matters: true`.
     - Summary: *"Application status changed to accepted as a winner. Results announced on the portal."*
     - Push Alert: Dispatched to phone via ntfy (`Tags: sloth,bell`, `Priority: high`, `Click: <url>`). Topic was kept secret and never logged.
  2. **Check B (Noise-Only Change)**:
     - Diff: `- Last updated: 2026-10-22 17:45:00 UTC`, `+ Last updated: 2026-10-22 18:00:00 UTC`, visitor counter change.
     - Judgment: `matters: false`.
     - Reason: *"The diff only shows changes to timestamps and visitor counts, which do not relate to application portal status updates."*
     - Push Alert: Suppressed (0 push alerts sent).
  3. **Check C (Unchanged Page)**:
     - Hash matched previous snapshot: 0 model calls made, 0 tokens used, 0ms model time.
  4. **Check D (Ollama Stopped / Unreachable)**:
     - Pointed `OLLAMA_HOST` to invalid port: Caught cleanly without unhandled crash, recorded in database as `status: "judge_failed"`, preserved baseline snapshot for future runs, and displayed with full diagnostic error in `slothwatch history`.
- **Surprises & Gotchas**:
  - Cold model loading for a 4.6GB quantized model on local CPU/disk takes ~60s on the first inference; increased default client timeout to 120s to prevent premature client-side aborts during cold starts.
  - Zod v4 syntax differences: `required_error` object option from Zod v3 is deprecated in favor of standard validation types in Zod v4.

## Phase 3 Notes & Measured Numbers (Lazy Payoff & Scheduling)
- **Stagehand Caching vs. Custom Recipe Store**:
  - Stagehand v4 provides managed server-side LLM action caching on Browserbase, but has no native multi-step recipe recording or replay API.
  - Built a custom recipe store in SQLite (`watches.recipe_json`), executing saved CSS/XPath selectors for 0-model-call replay and falling back to Stagehand `act()` re-discovery once if a selector fails.
- **Browserbase Usage & Quota**:
  - Checked Browserbase dashboard limits via API (`/v1/projects/{projectId}`): concurrency 3, active sessions 0.
  - Executed 10 total browser sessions across 3 live targets.
  - Total Browserbase session time consumed: ~0.5 session minutes (well within free tier).
- **Real Multi-Watch Test Runs**:
  - Configured 3 live watches:
    1. Watch #3 (`SlothWatch Repo` — controlled page): `https://github.com/dibyendu-coder/slothwatch`
    2. Watch #4 (`Book Price Watch` — price page with recipe step): `https://books.toscrape.com/...` with `--step "click #write_review"`
    3. Watch #6 (`Python Announcements` — public news): `https://www.python.org/blogs/`
  - Total Runs Executed: 10 runs
  - Content Hash Lazy Hit Rate: 50.0% (5 out of 10 runs avoided model calls entirely by hash check)
  - Pure Deterministic Recipe Replays: 2 runs replayed deterministically with 0 model calls
  - Recipe Fallback: 1 run tested with intentionally broken selector (`#intentionally-broken-selector-404`), successfully fell back to Stagehand re-discovery, re-resolved the element to `xpath=/html[1]/body[1]/...`, and flagged `[RECIPE FALLBACK]` in history.
  - Average Browser Session: 15.53 seconds
  - Average Model Latency: 23.02 seconds (when changes detected)
  - Total Local Tokens: 1,646 tokens
  - Estimated Manual Minutes Saved: 20 minutes (at 2 min/check default assumption) or 30 minutes (at 3 min/check assumption)
- **Surprises & Gotchas**:
  - **SQLite UTC vs JavaScript Date**: SQLite `datetime('now')` produces `YYYY-MM-DD HH:MM:SS` in UTC. In JavaScript on Windows in non-UTC timezones (e.g. IST +05:30), `new Date(str)` without an explicit `"Z"` interprets the timestamp as local time, shifting it 5.5 hours into the past and causing interval calculations to treat recent runs as hours old. Solved via `parseSqliteUtc` helper.
  - **TypeScript Build Asset Copying**: TypeScript compiler (`tsc`) does not copy `.sql` files into `dist/`. Added dynamic directory lookup in `src/db/client.ts` to locate `schema.sql` whether running from source via `tsx` or compiled via `node dist/bin/slothwatch.js`.
  - **Fault Isolation in run-all**: When Watch #5 initially encountered an invalid CSS selector, the runner safely isolated the error, updated SQLite with `status: error`, and proceeded to subsequent watches without aborting the suite.
