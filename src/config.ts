import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

// Load .env from current directory or process.cwd()
dotenv.config();

const ConfigSchema = z.object({
  BROWSERBASE_API_KEY: z.string().optional().default(""),
  BROWSERBASE_PROJECT_ID: z.string().optional().default(""),
  OLLAMA_HOST: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("gemma4:e2b"),
  NTFY_TOPIC: z.string().optional().default(""),
  NTFY_SERVER: z.string().default("https://ntfy.sh"),
  DATABASE_PATH: z.string().default(path.resolve(process.cwd(), "slothwatch.db")),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    OLLAMA_HOST: process.env.OLLAMA_HOST || "http://localhost:11434",
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || "gemma4:e2b",
    NTFY_TOPIC: process.env.NTFY_TOPIC,
    NTFY_SERVER: process.env.NTFY_SERVER || "https://ntfy.sh",
    DATABASE_PATH: process.env.DATABASE_PATH || path.resolve(process.cwd(), "slothwatch.db"),
  });
}
