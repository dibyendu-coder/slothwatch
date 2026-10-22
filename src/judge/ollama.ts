import { loadConfig } from "../config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatOptions {
  model?: string;
  host?: string;
  timeoutMs?: number;
  temperature?: number;
}

export interface OllamaChatResult {
  rawContent: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  modelMs: number;
}

/**
 * Client for local Ollama HTTP API (chat endpoint).
 * Enforces JSON mode, records prompt and completion token counts and elapsed time.
 */
export async function callOllamaChat(
  messages: ChatMessage[],
  options: OllamaChatOptions = {}
): Promise<OllamaChatResult> {
  const config = loadConfig();
  const host = options.host || config.OLLAMA_HOST || "http://localhost:11434";
  const model = options.model || config.OLLAMA_MODEL || "gemma4:e2b";
  const timeoutMs = options.timeoutMs ?? 120000;
  const temperature = options.temperature ?? 0.1;

  const url = `${host.replace(/\/+$/, "")}/api/chat`;

  const requestBody = {
    model,
    messages,
    format: "json",
    stream: false,
    options: {
      temperature,
    },
  };

  const startTime = Date.now();
  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms (host: ${host}, model: ${model})`);
    }
    throw new Error(`Failed to reach Ollama at ${host}: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Ollama error HTTP ${res.status} (${res.statusText}): ${errorText}`);
  }

  const data = (await res.json()) as {
    model?: string;
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
  };

  const modelMs = Date.now() - startTime;
  const rawContent = data.message?.content?.trim() || "";

  return {
    rawContent,
    model: data.model || model,
    promptTokens: data.prompt_eval_count || 0,
    completionTokens: data.eval_count || 0,
    modelMs,
  };
}
