# POST_FACTS.md — Verified Facts for DEV Challenge Blog Post

This document compiles an exhaustive, verified list of facts, real measured numbers, benchmark citations, failures, and architectural design choices for the DEV "Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady" write-up.

Every bullet point includes its exact source file in the repository.

---

## 1. What It Does & Core Concept
- **Definition**: SlothWatch is a lazy web-chore watcher. You describe in plain English what you care about on a web page; a cloud browser visits on schedule; a local open-weight model decides if the change matters; and your phone gets an instant push notification via ntfy only when it genuinely matters. [`SPEC.md:L7-L12`, `AGENTS.md:L7-L11`]
- **The "Lazy First" Principle**: The cheapest operation always wins. If the SHA-256 hash of extracted visible text matches the previous snapshot, SlothWatch exits immediately—consuming **0 LLM calls, 0 tokens, and 0 API dollars**. [`SPEC.md:L14-L18`, `README.md:L7-L9`]
- **Noise Filtering**: Web pages constantly fluctuate with timestamps, view counts, rotating ads, and cookie banners. SlothWatch filters out noise and only alerts the user when their specific condition is met. [`NOTES.md:L47-L51`]
- **Read-Only Safety**: SlothWatch never submits forms, pays, or sends messages on the user's behalf. It is strictly a read-only observer. [`AGENTS.md:L18`, `SPEC.md:L68-L70`]

---

## 2. Technical Stack
- **Language & Runtime**: TypeScript 5.7.3, Node.js v22.17.0 (compatible with Node 20+), native ECMAScript Modules (ESM). [`package.json:L5`, `package.json:L26-L32`]
- **Cloud Browser Automation**: `@browserbasehq/stagehand@4.3.0` running headless Chromium on Browserbase cloud infrastructure, with fallback to local Chromium for offline testing. [`package.json:L19`, `NOTES.md:L10-L15`]
- **Local Open-Source AI**: Local Ollama HTTP API (`http://localhost:11434/api/chat`) running Google's open-weight Gemma model (`gemma4:e2b` as default 4.6 GB quantized model; also evaluated `gemma4:e4b` and `llama3.2:3b`). [`NOTES.md:L7-L9`, `src/config.ts:L31`]
- **State Storage**: `better-sqlite3@11.8.1` with Write-Ahead Logging (WAL) mode and foreign key cascades, tracking `watches`, `runs`, and `snapshots`. [`src/db/schema.sql`, `package.json:L20`]
- **Validation Engine**: `zod@~4.4.3` for strict schema validation of model JSON outputs. [`package.json:L24`, `src/judge/schema.ts`]
- **CLI Interface**: `commander@13.1.0` powering subcommands (`add`, `list`, `remove`, `run`, `run-all`, `stats`, `history`, `doctor`, `bench`, `schedule-help`). [`package.json:L21`, `bin/slothwatch.ts`]
- **Mobile Push Notifications**: `ntfy` (`https://ntfy.sh`) dispatching alerts with custom priority, title, clickable URL, and sloth tags without user login. [`src/notify/ntfy.ts`]
- **Test Suite**: `vitest@3.0.5` running 29 unit and integration tests across 9 test files. [`package.json:L31`]

---

## 3. Real Measured Numbers (The Lazy Payoff)
- **Total Configured Watches**: 4 active live watches (SlothWatch GitHub repo, Book Price target with recipe interaction, Python News, and DEV Hacktoberfest challenge page). [`stats command output`, `NOTES.md:L69-L72`]
- **Total Execution Runs**: 14 runs recorded in SQLite. [`stats command output`]
- **Model Calls Avoided**: 8 runs avoided LLM calls completely due to SHA-256 content hash matching. [`stats command output`]
- **Lazy Hit Rate**: **57.1%** of all runs exited instantly at the hash guard without touching the model. [`stats command output`]
- **Model Calls Made**: Exactly 2 model inferences triggered across all 14 runs (only when content diff was detected). [`stats command output`]
- **Total Local Tokens Used**: 1,646 tokens total across all runs (all processed locally via Ollama). [`stats command output`]
- **Incremental AI API Cost**: **$0.00** (zero dollars spent on closed model APIs). [`NOTES.md:L16`]
- **Average Browserbase Session**: 14.21 seconds per cloud browser visit. [`stats command output`]
- **Average Model Latency on Change**: 23.02 seconds (includes initial cold disk load and JSON generation). [`stats command output`]
- **Recipe Replays**: 3 pure deterministic replays, 1 re-discovery fallback test. [`stats command output`, `NOTES.md:L75-L76`]
- **Replay vs First-Run Speedup**:
  - Book Price Watch (Watch #4 with click action): First run took **30.8s** (Stagehand action discovery) vs repeat runs at **20.1s** (deterministic CSS selector replay) — **34.7% faster** with 0 model calls. [`stats command output`, `NOTES.md:L76`]
  - SlothWatch Repo (Watch #3): First run 27.9s vs repeat run 12.6s — **54.8% faster**. [`stats command output`]
  - Python Announcements (Watch #6): First run 15.1s vs repeat run 11.3s — **25.2% faster**. [`stats command output`]
  - DEV Challenge Page (Watch #7): First run 14.2s vs repeat run 10.6s — **25.4% faster**. [`stats command output`]
- **Manual Time Saved**: **28 minutes saved** across 14 runs (based on standard conservative assumption of 2 minutes per manual check; or 42 minutes at 3 min/check). [`stats command output`, `NOTES.md:L80`]
- **Browserbase Cloud Quota Consumed**: ~0.75 session minutes total consumed across all development and demo chore runs (well inside free tier limits). [`NOTES.md:L67`, `NOTES.md:L121`]

---

## 4. Benchmark Results Across Open-Weight Models
- **Benchmark Suite**: 22 fixed cases in `bench/cases.json` covering 9 real changes, 8 noise variations, and 5 tricky edge cases. [`bench/RESULTS.md:L4`, `NOTES.md:L89`]
- **Evaluation Summary**:
  - **`gemma4:e2b` (Default)**:
    - Accuracy: **95.5% (21 / 22)**
    - False Positives: 1 (Case 22 price arithmetic)
    - False Negatives: **0 (Zero missed changes!)**
    - Invalid JSON / Schema Retries: **0 / 0 (100% first-pass schema adherence)**
    - Average Latency: **5.31s**
    - Average Tokens: 696 tokens
    [`bench/RESULTS.md:L8-L13`, `NOTES.md:L104-L108`]
  - **`gemma4:e4b`**:
    - Accuracy: 95.5% (21 / 22)
    - False Positives: 1 (Case 22 price arithmetic)
    - False Negatives: 0
    - Invalid JSON / Schema Retries: 0 / 0
    - Average Latency: 6.35s
    - Average Tokens: 550 tokens
    [`bench/RESULTS.md:L11`]
  - **`llama3.2:3b`**:
    - Accuracy: 90.9% (20 / 22)
    - False Positives: 2 (Case 16 comments count noise; Case 22 price arithmetic)
    - False Negatives: 0
    - Invalid JSON / Schema Retries: 0 / 0
    - Average Latency: 1.81s
    - Average Tokens: 527 tokens
    [`bench/RESULTS.md:L12`]
- **Why `gemma4:e2b` Won as Default**:
  - Zero False Negatives: An alert tool that misses genuine events is useless; Gemma 2B never missed a real event.
  - 4.6 GB RAM footprint: Runs comfortably on consumer laptops without discrete GPUs.
  - Lower latency than 4B (5.31s vs 6.35s) with identical 95.5% accuracy.
  [`NOTES.md:L108`, `README.md:L140-L144`]

---

## 5. Failures, Wrong Judgments & How They Were Solved
- **Failure 1: Case 05 ("Notify me" Literal Misunderstanding)**:
  - *Diff*: GPU availability changed from `Out of Stock` to `In Stock (Only 3 left!)`.
  - *Care instruction*: "Notify me when the RTX 5080 GPU is back in stock".
  - *Model verdict (Untuned Prompt)*: `matters: false`.
  - *Model reasoning*: *"The user requested a notification when the item is back in stock. This change only updates the current stock status, not implementing a notification feature."*
  - *Root cause*: Small 2B model literally checked whether the website built a notification system rather than checking stock status.
  - *Fix*: Tuned Rule 3 in `SYSTEM_PROMPT` (`src/judge/judge.ts`) explicitly stating that phrasing like "Notify me when X" defines condition X to detect, not website features. In Round 2, `gemma4:e2b` correctly scored `matters: true`.
  [`NOTES.md:L95-L98`, `NOTES.md:L101-L103`]
- **Failure 2: Case 22 (Small Model Arithmetic Comparison)**:
  - *Diff*: Flight price dropped from `$380` to `$325`.
  - *Care instruction*: "Tell me if the flight ticket price drops below $300".
  - *Model verdict*: `matters: true` across all three models (`gemma4:e2b`, `gemma4:e4b`, `llama3.2:3b`).
  - *Model reasoning*: *"The flight ticket price for SEA to SFO Economy has dropped to $325, which is below the $300 threshold."*
  - *Root cause*: 2B–4B parameter models lack reliable internal arithmetic comparison capabilities ($325 > $300) without external tool use.
  - *Mitigation documented in README*: Users are advised to specify directional care instructions ("if price drops") rather than fine numerical threshold inequalities.
  [`bench/RESULTS.md:L26-L48`, `NOTES.md:L97`]
- **Failure 3: Case 16 (Noise Misclassification by Llama)**:
  - *Diff*: `Comments (42)` changed to `Comments (43)`.
  - *Care instruction*: "Tell me if the blog post content is edited or corrected".
  - *Model verdict*: `matters: true` by `llama3.2:3b`.
  - *Model reasoning*: Treated comment count increment as blog post content edit.
  [`bench/RESULTS.md:L52-L61`]
- **Failure 4: Broken Selector in Recipe Replay**:
  - *Test*: Watch #4 was tested with intentionally broken CSS selector `#intentionally-broken-selector-404`.
  - *Behavior*: Runner detected selector failure, fell back to Stagehand `act()` re-discovery, re-located the element via XPath `/html[1]/body[1]/...`, updated the SQLite recipe record, and completed the run without crashing.
  [`NOTES.md:L76`, `src/browser/recipe.ts:L45-L65`]
- **Failure 5: Test Isolation on Fresh Clones**:
  - *Issue*: On a clean git clone, copying `.env.example` to `.env` caused `tests/notify.test.ts` to fail because `NTFY_TOPIC` contained the placeholder string `slothwatch-your-unique-topic`.
  - *Fix*: Isolated `process.env.NTFY_TOPIC` in `tests/notify.test.ts` via `beforeEach`/`afterEach`, allowing all 29 tests to pass cleanly out-of-the-box.
  [`tests/notify.test.ts:L4-L16`]

---

## 6. Key Design Decisions
1. **Deterministic Navigation vs Local Reasoning**:
   - Browserbase handles cloud browsing, stealth anti-bot headers, DOM rendering, and click actions deterministically.
   - Gemma only reasons over extracted text diffs.
   - *Why*: Small 2B–4B models fail catastrophically when tasked with driving browser clicks or interpreting raw DOM coordinates. Splitting the jobs makes the system robust. [`AGENTS.md:L30-L36`, `SPEC.md:L20-L24`]
2. **Deterministic Extraction over Stagehand `extract`**:
   - Rather than calling `stagehand.extract()` which invokes a cloud LLM, SlothWatch extracts text via `page.evaluate(() => document.body.innerText)`.
   - *Why*: Direct extraction uses 0 tokens and costs $0.00, keeping navigation strictly deterministic. [`NOTES.md:L14`]
3. **Compact Diff Engine**:
   - Unified line diff filters out thousands of unchanged boilerplate lines.
   - *Why*: Keeps context window under ~400 tokens per evaluation, minimizing latency and memory overhead on local CPU/GPU. [`NOTES.md:L38-L40`]
4. **Custom Recipe Store in SQLite**:
   - Stagehand v4 does not support native multi-step action recording/replaying in code. SlothWatch records CSS/XPath selectors upon first execution and replays them via Playwright locators on subsequent runs. [`NOTES.md:L61-L64`, `src/browser/recipe.ts`]
5. **No Long-Running Background Daemon**:
   - Uses plain cron or Windows Task Scheduler to invoke `slothwatch run-all`.
   - *Why*: Zero background memory footprint, zero daemon maintenance, and zero process crash leaks. [`AGENTS.md:L27`, `README.md:L217-L236`]

---

## 7. Where Open Beat Closed
- **Data Privacy**: Private dashboards, grade portals, and internal job pages never leave the user's computer. Closed APIs ingest user page diffs into corporate servers. [`README.md:L15`]
- **Zero Cost for High-Frequency Watching**: Hourly checks on 10 targets = 7,200 runs/month. With local Gemma, marginal cost is $0.00. Closed APIs charge per token. [`README.md:L16`]
- **Model Sovereignty & Zero Throttling**: No rate limits, no API key expiration, no sudden pricing tier changes. [`README.md:L17`]
- **Offline / Local Browser Mode**: Full support for running headless Chrome locally via `--local`, enabling 100% offline development and air-gapped watching. [`src/browser/session.ts`]

---

## 8. Honest Limitations
- **Cold Model Start Latency**: First inference from disk takes 30–60 seconds on local CPU. Subsequent warm inferences drop to 2–6 seconds. [`README.md:L242`, `NOTES.md:L57`]
- **Client-Side SPA Hydration**: Heavily rendered dynamic single-page apps may require explicit CSS selectors (`--selector`) or wait steps (`--step "wait 3s"`). [`README.md:L243`]
- **Aggressive Bot Firewalls**: Interactive Cloudflare Turnstile challenges can occasionally require manual cookies. [`README.md:L244`]
- **Numerical Arithmetic Reasoning**: 2B–4B models can fail numerical threshold comparisons ($325 < $300). Users should specify qualitative instructions ("if price drops"). [`README.md:L245`, `NOTES.md:L97`]
- **Strictly Read-Only Watching**: SlothWatch never submits forms or processes transactions. [`README.md:L246`]

---

## 9. Setup Friction & Gotchas Encountered
- **`better-sqlite3` File Locking on Windows**: On Windows, SQLite locks database files. Test tear-down scripts and migrations must explicitly call `db.close()` before unlinking files to avoid `EBUSY: resource busy or locked`. [`NOTES.md:L27`]
- **Stagehand v4 SDK Architecture**: Stagehand v4 separated `browserbase.launch()` from `Stagehand.create({ browser })`, requiring dual cleanup calls (`stagehand.close()` and `browser.close()`) for proper session shutdown. [`NOTES.md:L12`, `NOTES.md:L28`]
- **SQLite UTC vs Local Windows Timezones**: SQLite's `datetime('now')` stores UTC strings (`YYYY-MM-DD HH:MM:SS`). Parsing them with `new Date(str)` on Windows in IST (+05:30) shifted timestamps 5.5 hours into the past, causing recent runs to appear hours old. Resolved with `parseSqliteUtc()` appending `"Z"`. [`NOTES.md:L82`]
- **TypeScript Compiler Asset Copying**: `tsc` does not copy `.sql` schema files into `dist/`. Required dynamic directory traversal in `src/db/client.ts` to support both `tsx` development and compiled `node dist/...` execution. [`NOTES.md:L83`]
- **Zod v4 API Changes**: Zod v4 syntax differs from v3; the `required_error` property in object schemas is deprecated in favor of standard validation types. [`NOTES.md:L58`]
