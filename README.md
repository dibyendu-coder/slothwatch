# SlothWatch 🦥

> **Built for DEV "Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady"**  
> *Note: This project was conceived and started inside the challenge window (October 2026).*

SlothWatch is a lazy web-chore watcher. You tell it once what you care about on a web page in plain English. A cloud browser ([Browserbase](https://browserbase.com) + [Stagehand](https://stagehand.dev)) fetches the page on a schedule. Visible page text is extracted deterministically and hashed. If the content has not changed, SlothWatch stops immediately—saving model calls, time, and compute. When changes occur, a local open-weight model ([Gemma](https://ollama.com) via Ollama) judges if the change satisfies your intent, and your phone receives a push notification via [ntfy](https://ntfy.sh) only when it truly matters.

## Key Design Principles
1. **Lazy first**: The cheapest check wins. Zero LLM calls when page hashes match.
2. **Deterministic browser, local reasoning**: Browserbase navigates and extracts text deterministically; Gemma runs locally via Ollama to evaluate diffs. Page content never leaves your machine to closed model APIs.
3. **Recipe Record & Replay**: Multi-step interactions (cookie banners, tabs, button clicks) discover selectors on run 1, then replay deterministically with 0 LLM calls on subsequent runs.
4. **Zero noise**: Pushes only fire when `matters: true`. Timestamps, counters, ads, and layout noise are ignored.
5. **Honest metrics**: Real measured numbers tracked in SQLite.

## Quick Start

### Prerequisites
- Node.js 20+
- [Ollama](https://ollama.com) running locally with Gemma pulled:
  ```bash
  ollama pull gemma4:e2b
  ```
- A [Browserbase](https://browserbase.com) account (API key & Project ID)
- An [ntfy](https://ntfy.sh) topic subscribed on your phone (via iOS / Android app or web)

### Installation & Doctor Check
```bash
# Clone and install dependencies
git clone https://github.com/your-username/slothwatch.git
cd slothwatch
npm install
npm run build

# Configure environment
cp .env.example .env
# Edit .env with your BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, and NTFY_TOPIC

# Verify environment setup
npm run doctor
```

## CLI Usage

### Add a Web Watch
```bash
# Basic watch
slothwatch add "https://news.ycombinator.com" --care "Show when there is an announcement about open-source models"

# Specific CSS section
slothwatch add "https://store.example.com/item" --selector "#price" --care "Notify if price drops below $50"

# Multi-step recipe (cookie dismissal, tabs, button clicks)
slothwatch add "https://portal.example.com" \
  --name "Portal Watch" \
  --step "click 'Accept Cookies'" \
  --step "click 'Latest Updates'" \
  --care "Notify if new application deadline is announced"
```

### List and Inspect Watches
```bash
slothwatch list
```

### Run Checks
```bash
# Run a single watch by ID
slothwatch run 1

# Run all configured watches (respects 1-hour minimum interval per watch)
slothwatch run-all

# Force run all watches immediately (bypassing interval check)
slothwatch run-all --force

# Run using local Chrome browser
slothwatch run-all --local
```

### View History & Run Logs
```bash
# View last 10 runs for watch #1
slothwatch history 1

# View last 25 runs
slothwatch history 1 -n 25
```

### View Lazy Payoff & Efficiency Report
```bash
slothwatch stats

# Adjust estimated manual minutes saved per check assumption (default: 2)
slothwatch stats --manual-mins 3
```

## Automated Scheduling (Set-and-Forget)

SlothWatch does not install background daemons automatically, putting you in total control. Run the built-in helper to get copy-paste commands tailored to your operating system:

```bash
slothwatch schedule-help
```

### Windows Task Scheduler (Hourly)
Run the following in an Administrator Command Prompt or PowerShell:
```cmd
schtasks /create /tn "SlothWatch" /tr "\"C:\Program Files\nodejs\node.exe\" \"C:\path\to\slothwatch\dist\bin\slothwatch.js\" run-all" /sc hourly /f
```
To test immediately:
```cmd
schtasks /run /tn "SlothWatch"
```

### Linux / macOS crontab (Hourly)
Add the following line to `crontab -e`:
```cron
0 * * * * cd /path/to/slothwatch && node dist/bin/slothwatch.js run-all >> slothwatch.log 2>&1
```

## License
MIT
