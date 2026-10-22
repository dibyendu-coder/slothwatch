# SlothWatch 🦥

> **Built for DEV "Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady"**  
> *Note: This project was conceived and started inside the challenge window (October 2026).*

SlothWatch is a lazy web-chore watcher. You tell it once what you care about on a web page in plain English. A cloud browser ([Browserbase](https://browserbase.com) + [Stagehand](https://stagehand.dev)) fetches the page on a schedule. Visible page text is extracted deterministically and hashed. If the content has not changed, SlothWatch stops immediately—saving model calls, time, and compute. When changes occur, a local open-weight model ([Gemma](https://ollama.com) via Ollama) judges if the change satisfies your intent, and your phone receives a push notification via [ntfy](https://ntfy.sh) only when it truly matters.

## Key Design Principles
1. **Lazy first**: The cheapest check wins. Zero LLM calls when page hashes match.
2. **Deterministic browser, local reasoning**: Browserbase navigates and extracts text deterministically; Gemma runs locally via Ollama to evaluate diffs. Page content never leaves your machine to closed model APIs.
3. **Zero noise**: Pushes only fire when `matters: true`.

## Quick Start

### Prerequisites
- Node.js 20+
- [Ollama](https://ollama.com) with Gemma pulled (`ollama pull gemma4:e2b`)
- A [Browserbase](https://browserbase.com) account (API key & Project ID)
- An [ntfy](https://ntfy.sh) topic installed on your phone

### Installation & Doctor Check
```bash
# Clone and install dependencies
git clone https://github.com/your-username/slothwatch.git
cd slothwatch
npm install

# Configure environment
cp .env.example .env
# Edit .env with your BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, and NTFY_TOPIC

# Verify environment setup
npm run doctor
```

## CLI Usage (Coming in Phases 1-3)
```bash
slothwatch add <url> --care "<what matters>" [--selector "<css>"] [--name "<label>"]
slothwatch list
slothwatch run <id>
slothwatch run-all
slothwatch history <id>
slothwatch stats
```

## License
MIT
