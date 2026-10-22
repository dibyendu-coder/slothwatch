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

### Real Two-Run Measurement on `https://example.com`:
- **Run 1 (Baseline Snapshot)**:
  - Raw extracted text: 917 chars
  - Normalized text: 911 chars
  - Hash: `6a2f988e0a96e32fe616c9dd9a410af179b5bb482cfb8883063ec6b3608c7a61`
  - Browser time: 1,678 ms
  - Model calls: 0
  - Status: `success` (Baseline established)
- **Run 2 (Repeat Unchanged Run)**:
  - Raw extracted text: 917 chars
  - Normalized text: 911 chars
  - Hash match: `6a2f988e0a96e32fe616c9dd9a410af179b5bb482cfb8883063ec6b3608c7a61`
  - Browser time: 1,348 ms
  - **Model calls avoided: 1 (100% avoided, 0 tokens used)**
  - Model time: 0 ms
  - Status: `unchanged` (Lazy Payoff verified)
