import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { loadConfig } from "../config.js";

interface CheckResult {
  title: string;
  ok: boolean;
  message: string;
  critical: boolean;
}

export async function runDoctor(): Promise<boolean> {
  const config = loadConfig();
  const results: CheckResult[] = [];

  console.log(pc.bold("\n🦥 SlothWatch Doctor — System & Dependency Health Check\n"));

  // 1. Check .env presence
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    results.push({
      title: ".env file",
      ok: true,
      message: "Found .env in current directory",
      critical: false,
    });
  } else {
    results.push({
      title: ".env file",
      ok: false,
      message: "Missing .env (copy from .env.example)",
      critical: false,
    });
  }

  // 2. Check Browserbase credentials
  if (!config.BROWSERBASE_API_KEY) {
    results.push({
      title: "Browserbase API Key",
      ok: false,
      message: "BROWSERBASE_API_KEY is not set in .env",
      critical: true,
    });
  } else {
    try {
      const res = await fetch("https://api.browserbase.com/v1/sessions", {
        headers: {
          "x-bb-api-key": config.BROWSERBASE_API_KEY,
        },
      });
      if (res.ok) {
        results.push({
          title: "Browserbase Authentication",
          ok: true,
          message: `Authenticated successfully (Project ID: ${config.BROWSERBASE_PROJECT_ID || "default"})`,
          critical: true,
        });
      } else {
        results.push({
          title: "Browserbase Authentication",
          ok: false,
          message: `Authentication failed (HTTP ${res.status}: ${res.statusText})`,
          critical: true,
        });
      }
    } catch (err) {
      results.push({
        title: "Browserbase Authentication",
        ok: false,
        message: `Network error connecting to Browserbase API: ${(err as Error).message}`,
        critical: true,
      });
    }
  }

  // 3. Check Ollama reachable & model pulled
  try {
    const ollamaUrl = `${config.OLLAMA_HOST}/api/tags`;
    const res = await fetch(ollamaUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      results.push({
        title: "Ollama Reachability",
        ok: false,
        message: `Ollama returned HTTP ${res.status} at ${config.OLLAMA_HOST}`,
        critical: true,
      });
    } else {
      results.push({
        title: "Ollama Reachability",
        ok: true,
        message: `Reachable at ${config.OLLAMA_HOST}`,
        critical: true,
      });

      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const modelNames = data.models?.map((m) => m.name) || [];
      const targetModel = config.OLLAMA_MODEL;
      const modelFound = modelNames.some(
        (name) => name === targetModel || name.startsWith(`${targetModel}:`) || targetModel.startsWith(name)
      );

      if (modelFound) {
        results.push({
          title: `Ollama Model (${targetModel})`,
          ok: true,
          message: `Model "${targetModel}" is pulled and ready`,
          critical: true,
        });
      } else {
        results.push({
          title: `Ollama Model (${targetModel})`,
          ok: false,
          message: `Model "${targetModel}" not found. Available: [${modelNames.join(", ")}]. Run: ollama pull ${targetModel}`,
          critical: true,
        });
      }
    }
  } catch (err) {
    results.push({
      title: "Ollama Reachability",
      ok: false,
      message: `Cannot connect to Ollama at ${config.OLLAMA_HOST} (${(err as Error).message}). Is Ollama running?`,
      critical: true,
    });
  }

  // 4. Check ntfy topic
  if (!config.NTFY_TOPIC || config.NTFY_TOPIC.includes("your-unique-topic")) {
    results.push({
      title: "ntfy Configuration",
      ok: false,
      message: "NTFY_TOPIC is not configured or using default placeholder",
      critical: true,
    });
  } else {
    try {
      const healthUrl = `${config.NTFY_SERVER}/v1/health`;
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        results.push({
          title: "ntfy Configuration",
          ok: true,
          message: `Server healthy (${config.NTFY_SERVER}) and topic configured ("${config.NTFY_TOPIC}")`,
          critical: true,
        });
      } else {
        results.push({
          title: "ntfy Configuration",
          ok: false,
          message: `Server ${config.NTFY_SERVER} returned HTTP ${res.status}`,
          critical: false,
        });
      }
    } catch (err) {
      results.push({
        title: "ntfy Configuration",
        ok: false,
        message: `Could not reach ${config.NTFY_SERVER}: ${(err as Error).message}`,
        critical: false,
      });
    }
  }

  // Print results
  let allCriticalOk = true;
  for (const r of results) {
    const symbol = r.ok ? pc.green("✓") : r.critical ? pc.red("✗") : pc.yellow("!");
    const statusText = r.ok ? pc.green(r.title) : r.critical ? pc.red(r.title) : pc.yellow(r.title);
    console.log(`  ${symbol} ${pc.bold(statusText)}: ${r.message}`);
    if (!r.ok && r.critical) {
      allCriticalOk = false;
    }
  }

  console.log("");
  if (allCriticalOk) {
    console.log(pc.green(pc.bold("Doctor passed! System is healthy and ready for SlothWatch.")));
  } else {
    console.log(pc.yellow(pc.bold("Doctor identified items needing attention before running.")));
  }
  console.log("");

  return allCriticalOk;
}
