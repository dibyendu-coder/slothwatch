# SPEC.md — SlothWatch

## One-line pitch
Tell it once what you care about on a web page. A cloud browser checks slowly and steadily, local Gemma decides if it matters, and your phone buzzes only when it does.

## Users and problem
People who keep re-checking pages: scholarship or portal status, deadlines, price drops, challenge or program announcements. The chore is boring, repetitive, and easy to forget. SlothWatch does it so they do not have to.

## Why open
- Gemma runs locally via Ollama: page content (possibly from logged-in pages) never goes to a closed API.
- Model swap is one config line; same watch list can be benchmarked across open models.
- No per-call bill. Cost after setup is near zero.
- Honest trade-off to report: small open models struggle at driving browsers, so the browser does deterministic work and the model only reasons over text.

## Core flow (per watch)
1. Open Browserbase session via Stagehand.
2. Navigate to URL (optionally via saved recipe steps, e.g. dismiss cookie banner, click a tab).
3. Extract visible text of the target area (whole page by default, optional CSS selector).
4. Normalize text (collapse whitespace, strip volatile bits like timestamps if configured).
5. Hash. If hash equals last snapshot, record "unchanged", skip Gemma, stop. (Laziness win.)
6. Otherwise compute a compact diff against last snapshot.
7. Send diff + user's "care" sentence to Gemma. Require JSON output validated by zod:
   `{ "matters": boolean, "summary": string (max 2 short lines), "reason": string }`
8. Store snapshot + judgment + metrics.
9. If `matters` is true, push via ntfy with the summary and the URL.

## Recipe replay (repeatable workflow)
First run of a watch may need steps (click, scroll, wait). Record those steps as a recipe (ordered list, stored in SQLite as JSON). Later runs replay the recipe without asking a model to rediscover it. Check what Stagehand supports natively for caching or replay; if nothing fits, implement a minimal recipe store: step type, target description/selector, expected result. If a replay step fails, fall back to re-discovery once, update the recipe, and flag it in the report.

## CLI
- `slothwatch add <url> --care "<what matters>" [--selector "<css>"] [--name "<label>"]`
- `slothwatch list`
- `slothwatch run <id>`
- `slothwatch run-all`
- `slothwatch history <id>`
- `slothwatch remove <id>`
- `slothwatch stats` — the "Lazy Payoff" report
- `slothwatch doctor` — checks env vars, Browserbase auth, Ollama reachable and model pulled, ntfy topic set

## Data model (SQLite)
- `watches(id, name, url, care, selector, recipe_json, created_at)`
- `runs(id, watch_id, started_at, duration_ms, status, changed, model_called, matters, summary, reason, error, browser_ms, model_ms, prompt_tokens, completion_tokens)`
- `snapshots(id, watch_id, run_id, text, hash, created_at)`

## Config (.env, see .env.example)
- `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`
- `OLLAMA_HOST` (default http://localhost:11434)
- `OLLAMA_MODEL` (Gemma tag the user has pulled)
- `NTFY_TOPIC` (hard-to-guess string), optional `NTFY_SERVER`

## Stats (Lazy Payoff)
`slothwatch stats` prints, per watch and total:
- runs, unchanged runs, runs that called the model
- model calls avoided by hash check
- average browser time and model time
- tokens used locally
- estimated manual minutes saved (configurable minutes-per-check, default 2)
- repeat-run vs first-run time and model-call comparison (replay benefit)
Real measured numbers only. No fabricated estimates beyond the clearly labelled manual-minutes assumption.

## Safety
- Read-only: never submit forms, make purchases, or post anything.
- Credentials never enter model prompts. If a logged-in page is needed, use Browserbase's persistent context so no password is handled by our code; document how.
- Page text stays local after extraction. Only the extracted text passes to local Ollama.
- Respect site terms. Low frequency by default (minimum interval between runs per watch, default 1 hour).

## Out of scope
Multi-user, web dashboard (a tiny static landing page on a .tech domain is fine), form filling, payments, mobile app.

## Acceptance criteria
1. `doctor` passes on a clean setup.
2. Adding a watch and running it twice on an unchanged page: second run makes zero model calls.
3. Editing a test page (a tiny local or hosted page I control) triggers a Gemma judgment and an ntfy push on the phone.
4. A noise-only change (timestamp) is judged `matters: false` and does not push.
5. `stats` shows real numbers.
6. README lets a stranger install and run in under 10 minutes.
7. Tests cover hashing, diffing, zod validation of model output, and failure handling.

## Demo chores for the write-up (pick three)
- A page I control that I edit live (reliable demo).
- A price or stock page.
- A public program or challenge page where announcements appear.
