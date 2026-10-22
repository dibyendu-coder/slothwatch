import { loadConfig } from "../config.js";

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  priority?: "min" | "low" | "default" | "high" | "urgent";
}

export interface PushResult {
  sent: boolean;
  error?: string;
}

/**
 * Sends a push alert via ntfy (https://ntfy.sh).
 * SECURITY RULE: Never log or print the NTFY_TOPIC value to logs, console, or files.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<PushResult> {
  const config = loadConfig();

  if (!config.NTFY_TOPIC || config.NTFY_TOPIC.includes("your-unique-topic")) {
    return {
      sent: false,
      error: "NTFY_TOPIC is not configured in .env",
    };
  }

  const endpoint = `${config.NTFY_SERVER.replace(/\/+$/, "")}/${config.NTFY_TOPIC}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Title: payload.title,
        Click: payload.url,
        Priority: payload.priority || "high",
        Tags: "sloth,bell",
      },
      body: payload.body,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        sent: false,
        error: `ntfy server returned HTTP ${res.status}: ${errText}`,
      };
    }

    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: `Failed to dispatch push notification: ${(err as Error).message}`,
    };
  }
}
