# SlothWatch 🦥

> **Built during Hacktoberfest Open-Source AI Challenge Week 3 (Oct 19-25, 2026)**  
> *Note: This project was conceived, designed, and built entirely inside the challenge window.*  
> *Submission Deadline: October 25, 2026, 11:59 PM PDT (October 26, 12:29 PM IST).*  
> *Landing Page:* [slothwatch.tech](https://slothwatch.tech) (or `docs/` on GitHub Pages)

SlothWatch is a lazy web-chore watcher. You describe in plain English what you care about on a web page. A cloud browser ([Browserbase](https://browserbase.com) + [Stagehand](https://stagehand.dev)) visits the page on an automated schedule. Visible text is extracted deterministically and hashed. If the page is unchanged, SlothWatch exits immediately—consuming **0 LLM calls, 0 tokens, and 0 API dollars**.

When real text changes occur, a local open-weight model ([Gemma](https://ollama.com) via Ollama) evaluates the compact diff to determine if it satisfies your intent. Your phone receives a push notification via [ntfy](https://ntfy.sh) only when it genuinely matters—filtering out timestamps, visitor counters, ads, and cookie banners.

---

## Demo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           [ DEMO GIF / RECORDING ]                              │
│                                                                                 │
│   1. `slothwatch add "..." --care "Notify if status updates to accepted"`        │
│   2. Initial Run: Baseline snapshot captured & hashed.                          │
│   3. Hourly Cron: Page unchanged ➔ SHA-256 hash hit ➔ Exit (0 tokens).         │
│   4. Status Changes: Diff detected ➔ Local Gemma 2B evaluates ➔ Phone rings.   │
│                                                                                 │
│          *(Run `npm run demo` locally for interactive zero-cloud demo)*         │
└─────────────────────────────────────────────────────────────────────────────────┘
```
*(Interactive self-contained terminal demo available via `npm run demo`)*

---

## Why Open-Source AI?

1. **Privacy-First Web Watching**: Your watched pages (private dashboards, internal job statuses, personal portal updates) are analyzed entirely on your local machine. Page contents and diffs are **never sent to closed proprietary model APIs**.
2. **Zero Recurring AI Cost**: Running perpetual watchers against commercial APIs drains wallets quickly. With local Gemma running via Ollama, 10,000 checks cost exactly $0.
3. **Model Sovereignty**: Swap models on demand (`gemma4:e2b`, `gemma4:e4b`, `llama3.2:3b`) without API rate limits, vendor lock-in, or subscription tiers.

---

## Architecture & Design Principles

```
  ┌────────────────────────────────────────────────────────┐
  │ 1. DETERMINISTIC BROWSER (Browserbase Cloud)           │
  │    Navigates to URL, executes recipe steps (clicks)   │
  │    Extracts inner visible text (0 LLM calls)           │
  └─────────────────────────┬──────────────────────────────┘
                            ▼
  ┌────────────────────────────────────────────────────────┐
  │ 2. LAZY HASH GUARD (SHA-256)                           │
  │    Hash matches previous snapshot?                     │
  │    ├── YES ➔ EXIT IMMEDIATELY (0 tokens, 0 LLM time)   │
  │    └── NO  ➔ Proceed to Step 3                         │
  └─────────────────────────┬──────────────────────────────┘
                            ▼
  ┌────────────────────────────────────────────────────────┐
  │ 3. COMPACT DIFF ENGINE                                 │
  │    Extracts added/removed lines, omits large context   │
  └─────────────────────────┬──────────────────────────────┘
                            ▼
  ┌────────────────────────────────────────────────────────┐
  │ 4. LOCAL GEMMA JUDGE (Ollama HTTP JSON Mode)           │
  │    Evaluates intent vs diff: noise? or matters?        │
  │    Schema-validated JSON output                        │
  └─────────────────────────┬──────────────────────────────┘
                            ▼
  ┌────────────────────────────────────────────────────────┐
  │ 5. PUSH NOTIFICATION (ntfy)                            │
  │    Fires alert to phone only if matters == true        │
  └────────────────────────────────────────────────────────┘
```

1. **Lazy First**: The cheapest operation wins. If a page's text hash is identical, the run completes in milliseconds without calling any model.
2. **Deterministic Browser, Local Reasoning**: Browserbase handles DOM loading and navigation deterministically; Gemma only reasons over compact diffs. Small models aren't trusted to drive complex web interactions blindly.
3. **Recipe Record & Replay**: Multi-step interactions (cookie dismissal, tab switching) discover CSS/XPath selectors on the first run, then replay deterministically with 0 model calls on repeat runs.
4. **Honest Metrics**: Real numbers (tokens, model time avoided, manual time saved) are recorded in SQLite and reported via `slothwatch stats`.

---

## Quick Start (Under 10 Minutes)

### 1. Prerequisites
- **Node.js 20+**
- **[Ollama](https://ollama.com)** installed and running locally
- **Gemma model pulled**:
  ```bash
  ollama pull gemma4:e2b
  ```
- **[Browserbase](https://browserbase.com)** account (API key & Project ID from dashboard)
- **[ntfy](https://ntfy.sh)** app on your iOS or Android phone (or desktop browser)

### 2. Installation

#### On Windows (PowerShell):
```powershell
git clone https://github.com/dibyendu-coder/slothwatch.git
cd slothwatch
npm install
npm run build
cp .env.example .env
```

#### On Linux / macOS:
```bash
git clone https://github.com/dibyendu-coder/slothwatch.git
cd slothwatch
npm install
npm run build
cp .env.example .env
```

### 3. Configuration
Edit `.env` with your favorite text editor:
```env
BROWSERBASE_API_KEY=bb_live_your_actual_key
BROWSERBASE_PROJECT_ID=your_project_id
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
NTFY_TOPIC=slothwatch-my-secret-topic-9921
NTFY_SERVER=https://ntfy.sh
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `BROWSERBASE_API_KEY` | Cloud browser authentication key from Browserbase dashboard | *Required* |
| `BROWSERBASE_PROJECT_ID`| Project ID from Browserbase dashboard | *Required* |
| `OLLAMA_HOST` | Ollama HTTP endpoint | `http://localhost:11434` |
| `OLLAMA_MODEL` | Local model tag (open weights) | `gemma4:e2b` |
| `NTFY_TOPIC` | Secret mobile notification topic | *Required* |
| `NTFY_SERVER` | ntfy push notification server | `https://ntfy.sh` |

*(Subscribe to your topic in your ntfy mobile app to receive alerts).*

### 4. Run Doctor Check
Verify all connections, credentials, and local models:
```bash
npm run doctor
```
*Doctor automatically masks sensitive API keys, project IDs, and ntfy topics in terminal output.*

---

## Interactive Demo (Zero Cloud Quota)

To see the complete SlothWatch lifecycle without consuming external websites:
```bash
npm run demo
```
This self-contained script:
1. Launches an isolated local test HTTP server.
2. Runs **Check 1**: Establishes a baseline snapshot.
3. Runs **Check 2**: Verifies the **Lazy Hash Hit** (0 model calls, instant exit).
4. Simulates a status change (`Under Review` ➔ `ACCEPTED AS WINNER!`).
5. Runs **Check 3**: Diff detected ➔ Local Gemma evaluates ➔ Dispatches real push alert to your phone.
6. Prints the **Lazy Payoff Efficiency Report**.

---

## Benchmark Results

We evaluated open-weight models against a fixed suite of **22 diverse test cases** in `bench/cases.json` (real changes, noise fluctuations, and tricky edge cases) using `slothwatch bench`:

| Model | Accuracy | Score | False Positives (Noise Pushed) | False Negatives (Missed Change) | Schema / Retried | Avg Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`gemma4:e2b` (Default)** | **95.5%** | **21/22** | **1** | **0** | **0 / 0** | **5.31s** |
| `gemma4:e4b` | 95.5% | 21/22 | 1 | 0 | 0 / 0 | 6.35s |
| `llama3.2:3b` | 90.9% | 20/22 | 2 | 0 | 0 / 0 | 1.81s |

### Why `gemma4:e2b` is the Default:
- **0 False Negatives**: It never missed a genuine web change that mattered to the user.
- **Fast & Lightweight**: 5.31s average latency on local CPU/GPU, requiring only 4.6 GB RAM.
- **Flawless Schema Adherence**: 100% valid JSON conforming to Zod schema without any retries.

To reproduce the benchmark on your machine:
```bash
node dist/bin/slothwatch.js bench --models gemma4:e2b,gemma4:e4b,llama3.2:3b
```
Full failure logs and prompt citations are available in [`bench/RESULTS.md`](./bench/RESULTS.md).

---

## CLI Command Reference

### `add` — Register a web watch
```bash
# Basic watch
node dist/bin/slothwatch.js add "https://news.ycombinator.com" \
  --care "Notify when there is an announcement about local open-weight models"

# Narrowed to a CSS selector
node dist/bin/slothwatch.js add "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html" \
  --name "Book Price Watch" \
  --selector ".product_main" \
  --care "Notify if price drops below 50 pounds"

# Multi-step recipe interaction (e.g. cookie dismiss or button clicks)
node dist/bin/slothwatch.js add "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html" \
  --step "click #write_review" \
  --care "Notify if review section updates"
```

### `list` — View all configured watches
```bash
node dist/bin/slothwatch.js list
```

### `run <id>` — Execute a single watch
```bash
# Run via Browserbase cloud
node dist/bin/slothwatch.js run 1

# Run via local Chrome browser (offline / zero-cloud testing)
node dist/bin/slothwatch.js run 1 --local
```

### `run-all` — Batch run with interval protection
```bash
# Respects 60-minute minimum interval per watch
node dist/bin/slothwatch.js run-all

# Bypass interval guard and force-check every watch immediately
node dist/bin/slothwatch.js run-all --force

# Custom interval guard (e.g., min 30 minutes)
node dist/bin/slothwatch.js run-all --interval 30
```

### `stats` — Lazy Payoff & Efficiency Report
```bash
node dist/bin/slothwatch.js stats
```
Displays total runs, model calls avoided by content hashing, average browser session duration, average model latency, local token counts, and estimated manual minutes saved.

### `history <id>` — Inspect past runs & judgments
```bash
node dist/bin/slothwatch.js history 1
```

### `remove <id>` — Delete a watch
```bash
node dist/bin/slothwatch.js remove 1
```

---

## Automated Scheduling

SlothWatch is set-and-forget without running a heavy background daemon. Run the built-in helper for OS-specific setup commands:
```bash
node dist/bin/slothwatch.js schedule-help
```

### Windows Task Scheduler (Hourly)
Run in PowerShell (Admin):
```powershell
$action = New-ScheduledTaskAction -Execute "node" -Argument "C:\path\to\slothwatch\dist\bin\slothwatch.js run-all"
$trigger = New-ScheduledTaskTrigger -Hourly -At (Get-Date)
Register-ScheduledTask -TaskName "SlothWatch" -Action $action -Trigger $trigger -Description "Hourly SlothWatch Web Runs"
```

### Linux / macOS Crontab (Hourly)
Add to `crontab -e`:
```cron
0 * * * * cd /path/to/slothwatch && node dist/bin/slothwatch.js run-all >> slothwatch.log 2>&1
```

---

## Honest Limitations

1. **Cold Model Start**: The very first model inference after starting Ollama requires loading weights from disk into memory (~30-40s on local CPU). Subsequent warm inferences complete in 1.5s–5s.
2. **Dynamic Client Hydration**: Heavy JavaScript Single-Page Apps (SPAs) may require `--step "wait 3s"` or specific selector targets to allow dynamic tables to render before text extraction.
3. **Strict Bot Firewalls**: While Browserbase cloud instances provide high stealth and anti-bot capabilities, pages behind Cloudflare Turnstile or reCAPTCHA can occasionally require manual cookies or residential proxies.
4. **Numerical Arithmetic Reasoning**: In small open-weight models (2B–4B), complex arithmetic comparisons (e.g. checking whether a price of $325 is below $300) can occasionally yield false positives without external tool use. We recommend clear absolute care instructions (e.g., "Notify if price decreases").
5. **Strictly Read-Only Watching**: SlothWatch never submits forms, pays, or sends messages on the user's behalf. It is an observer only.

---

## Safety & Security Pass

- **Read-Only Watching**: SlothWatch never submits forms, executes transactions, or enters user credentials on watched pages.
- **Zero Secrets in Code or History**: All credentials (`BROWSERBASE_API_KEY`, `NTFY_TOPIC`) live strictly in `.env`.
- **Masked Diagnostics**: `slothwatch doctor` masks API keys, project IDs, and ntfy topic strings to prevent accidental screen or log leaks.
- **Strictly Ignored State**: Databases (`*.db`, `*.db-wal`, `*.db-shm`), build outputs (`dist/`), and log files are gitignored.

---

## Commits after deadline

*None. All commits were made within the challenge window (October 19–25, 2026).*

---

## License

[MIT](LICENSE) © 2026 Dibyendu
