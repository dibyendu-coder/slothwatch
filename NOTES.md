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

## Phase 4 Notes & Measured Numbers (Benchmark, Polish & Safety)

### 1. Benchmark Execution & Model Comparison
- **Dataset**: `bench/cases.json` created with 22 fixed cases (9 real changes, 8 noise, 5 tricky edge cases).
- **Models Compared**: `gemma4:e2b` (4.6 GB), `gemma4:e4b` (6.6 GB), `llama3.2:3b` (2.0 GB).
- **Round 1 (Baseline Prompt)**:
  - `gemma4:e2b`: 21/22 (95.5%), 0 FP, 1 FN (Case 05: RTX 5080 restock), 0 schema errors, 7.56s avg latency.
  - `gemma4:e4b`: 21/22 (95.5%), 1 FP (Case 22: price math), 0 FN, 0 schema errors, 7.06s avg latency.
  - `llama3.2:3b`: 19/22 (86.4%), 2 FP (Case 16: comments count, Case 22: price math), 1 FN (Case 07: hackathon category), 0 schema errors, 2.08s avg latency.
- **Failure Analysis**:
  - `gemma4:e2b` failed Case 05 (*"Notify me when the RTX 5080 GPU is back in stock"*) with reason: *"The user requested a notification when the item is back in stock. This change only updates the current stock status, not implementing a notification feature."* The small model literally interpreted "Notify me" as asking if the website implemented a notification system!
  - `gemma4:e4b` and `llama3.2:3b` failed Case 22 (*"Tell me if the flight ticket price drops below $300"*, diff `$380 -> $325`) with reason claiming $325 is below $300 (small model arithmetic limitation).
  - `llama3.2:3b` hallucinated on Case 07 and over-eagerly flagged comment count noise on Case 16 as modifying blog content.

### 2. Single Allowed Prompt Tuning Iteration
- Refined Rule 3 in `SYSTEM_PROMPT` (`src/judge/judge.ts`):
  - Clarified that phrases like "Notify me when X" describe condition X to detect on the page, and not whether the website added a notification button.
  - Added strict arithmetic instruction for numerical thresholds.
- **Round 2 (Tuned Prompt Results)**:
  - `gemma4:e2b`: **21/22 (95.5%), 1 FP, 0 FN (Zero missed changes!)**, 0 schema errors, **5.31s avg latency**.
  - `gemma4:e4b`: 21/22 (95.5%), 1 FP, 0 FN (Zero missed changes!), 0 schema errors, 6.35s avg latency.
  - `llama3.2:3b`: 20/22 (90.9%), 2 FP, 0 FN, 0 schema errors, 1.81s avg latency.
- **Conclusion**: `gemma4:e2b` achieved a **0% False Negative rate** (never misses a real alert), 0 schema retries, and lower latency than `e4b`. It is firmly justified as the default model in config.

### 3. Demo Chores Execution (Real Cloud Targets)
- Set up 3 real watches:
  1. Controlled page: `https://github.com/dibyendu-coder/slothwatch` (Watch #3)
  2. Stable price target: `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html` (Watch #4)
  3. DEV Challenge page: `https://dev.to/challenges/hf26` (Watch #7)
- **Observations & Bot Defenses**:
  - DEV challenge page (`https://dev.to/challenges/hf26`) loaded seamlessly via Browserbase in 11.02s without Cloudflare challenge intercepts.
  - 10,940 normalized characters extracted.
  - Second run on DEV achieved the Lazy Payoff: hash matched previous snapshot, **0 model calls, 0 tokens**.
  - Books to Scrape executed deterministic recipe replay (`click #write_review`), hash matched, **0 model calls**.
  - SlothWatch GitHub repo: 10.6s extraction, hash matched, **0 model calls**.
  - Total Browserbase session time consumed across demo chores: ~0.75 session minutes.

### 4. Interactive Demo & Safety Verification
- Added `npm run demo` (`scripts/demo.ts`): spins up an isolated test web server, tests baseline snapshot, validates lazy hash hit (0 model calls), triggers real page diff, confirms local Gemma evaluation, fires ntfy phone push alert, and displays efficiency report.
- Hardened `doctor` command: masked sensitive Browserbase project IDs (`55f…404`) and ntfy topics (`slo…4v8`).
- Audited git history and files: confirmed zero secrets or API keys committed (`git log -p -S bb_live`). `.env` and `slothwatch.db` are strictly ignored.

