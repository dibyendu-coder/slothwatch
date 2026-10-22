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

## Measured Metrics (To be recorded per phase)
- Hash checks evaluated:
- Model calls avoided by hash check:
- Average run duration (first run vs repeat run):
- Manual minutes saved:
