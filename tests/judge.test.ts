import { afterEach, describe, expect, it, vi } from "vitest";
import { judgeDiff } from "../src/judge/judge.js";
import * as ollamaModule from "../src/judge/ollama.js";
import { JudgmentSchema } from "../src/judge/schema.js";

describe("JudgmentSchema", () => {
  it("validates well-formed judgment JSON", () => {
    const raw = {
      matters: true,
      summary: "Deadline changed to Nov 5\nNext stage opens Monday",
      reason: "Directly matches care instruction regarding deadline announcement",
    };
    const parsed = JudgmentSchema.parse(raw);
    expect(parsed.matters).toBe(true);
    expect(parsed.summary).toBe("Deadline changed to Nov 5\nNext stage opens Monday");
    expect(parsed.reason).toContain("Directly matches");
  });

  it("truncates multi-line summaries to max 2 short lines", () => {
    const raw = {
      matters: true,
      summary: "Line 1\nLine 2\nLine 3\nLine 4",
      reason: "Matches instruction",
    };
    const parsed = JudgmentSchema.parse(raw);
    expect(parsed.summary.split("\n").length).toBe(2);
    expect(parsed.summary).toBe("Line 1\nLine 2");
  });

  it("fails validation if matters boolean is missing", () => {
    const raw = {
      summary: "Some summary",
      reason: "Some reason",
    };
    const res = JudgmentSchema.safeParse(raw);
    expect(res.success).toBe(false);
  });
});

describe("judgeDiff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully judges on first attempt with valid output", async () => {
    vi.spyOn(ollamaModule, "callOllamaChat").mockResolvedValueOnce({
      rawContent: JSON.stringify({
        matters: true,
        summary: "Price dropped to $49",
        reason: "User cares about price drop below $50",
      }),
      model: "gemma4:e2b",
      promptTokens: 120,
      completionTokens: 35,
      modelMs: 250,
    });

    const res = await judgeDiff("Notify me if price drops below $50", "- $55\n+ $49");
    expect(res.success).toBe(true);
    expect(res.judgment?.matters).toBe(true);
    expect(res.judgment?.summary).toBe("Price dropped to $49");
    expect(res.retried).toBe(false);
    expect(res.promptTokens).toBe(120);
    expect(res.completionTokens).toBe(35);
  });

  it("retries once when first attempt returns malformed output, then succeeds", async () => {
    // Attempt 1: Malformed output
    // Attempt 2: Valid output
    vi.spyOn(ollamaModule, "callOllamaChat")
      .mockResolvedValueOnce({
        rawContent: "I think the change matters because it looks relevant.",
        model: "gemma4:e2b",
        promptTokens: 100,
        completionTokens: 20,
        modelMs: 200,
      })
      .mockResolvedValueOnce({
        rawContent: JSON.stringify({
          matters: false,
          summary: "Timestamp updated",
          reason: "Only timestamp changed",
        }),
        model: "gemma4:e2b",
        promptTokens: 110,
        completionTokens: 25,
        modelMs: 210,
      });

    const res = await judgeDiff("Notify on price drop", "- 10:00\n+ 10:05");
    expect(res.success).toBe(true);
    expect(res.judgment?.matters).toBe(false);
    expect(res.retried).toBe(true);
    expect(res.promptTokens).toBe(210); // 100 + 110
  });

  it("fails safe with judge_failed when model output remains invalid after retry", async () => {
    vi.spyOn(ollamaModule, "callOllamaChat")
      .mockResolvedValueOnce({
        rawContent: "Invalid 1",
        model: "gemma4:e2b",
        promptTokens: 50,
        completionTokens: 10,
        modelMs: 100,
      })
      .mockResolvedValueOnce({
        rawContent: "Still invalid 2",
        model: "gemma4:e2b",
        promptTokens: 50,
        completionTokens: 10,
        modelMs: 100,
      });

    const res = await judgeDiff("Any change", "- a\n+ b");
    expect(res.success).toBe(false);
    expect(res.error).toContain("judge_failed");
    expect(res.retried).toBe(true);
  });
});
