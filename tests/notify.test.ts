import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPushNotification } from "../src/notify/ntfy.js";

describe("sendPushNotification", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends notification with proper Title, Click, Priority headers and body", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = (init?.body as string) || "";
      return new Response("OK", { status: 200 });
    });

    const res = await sendPushNotification({
      title: "Scholarship Watcher",
      body: "Winner list announced!",
      url: "https://example.com/results",
      priority: "high",
    });

    expect(res.sent).toBe(true);
    expect(capturedUrl).toContain("https://ntfy.sh/");
    expect(capturedHeaders["Title"]).toBe("Scholarship Watcher");
    expect(capturedHeaders["Click"]).toBe("https://example.com/results");
    expect(capturedHeaders["Priority"]).toBe("high");
    expect(capturedBody).toBe("Winner list announced!");
  });

  it("handles server error without crashing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

    const res = await sendPushNotification({
      title: "Test Watch",
      body: "Test body",
      url: "https://example.com",
    });

    expect(res.sent).toBe(false);
    expect(res.error).toContain("HTTP 500");
  });
});
