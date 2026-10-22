import { describe, expect, it, vi } from "vitest";
import { executeRecipe } from "../src/browser/recipe.js";
import type { BrowserSession } from "../src/browser/session.js";

function createMockSession(options: {
  matchingSelectors?: string[];
  stagehandSelector?: string;
  stagehandError?: boolean;
} = {}): BrowserSession {
  const matching = new Set(options.matchingSelectors || []);
  const clickedSelectors: string[] = [];

  const mockLocator = (sel: string) => {
    const isMatch = matching.has(sel);
    return {
      count: vi.fn(async () => (isMatch ? 1 : 0)),
      first: () => ({
        click: vi.fn(async () => {
          if (!isMatch) {
            throw new Error(`Element not found for selector ${sel}`);
          }
          clickedSelectors.push(sel);
        }),
      }),
    };
  };

  const page = {
    locator: vi.fn(mockLocator),
    waitForTimeout: vi.fn(async () => {}),
    evaluate: vi.fn(async () => {}),
  } as unknown as BrowserSession["page"];

  const stagehand = {
    act: vi.fn(async (instruction: string) => {
      if (options.stagehandError) {
        throw new Error("Stagehand act failed");
      }
      return {
        data: {
          success: true,
          message: "Action simulated",
          actionDescription: "Clicked element",
          actions: [
            {
              selector: options.stagehandSelector || `#discovered-${instruction.replace(/\s+/g, "-")}`,
              description: instruction,
              method: "click",
            },
          ],
        },
        metadata: {} as any,
      };
    }),
  } as unknown as BrowserSession["stagehand"];

  return {
    page,
    stagehand,
    browser: {} as any,
    close: vi.fn(async () => {}),
  };
}

describe("Recipe Execution & Replay Engine", () => {
  it("returns executed: false when recipe is empty or missing", async () => {
    const session = createMockSession();
    const res1 = await executeRecipe(session, "");
    expect(res1.executed).toBe(false);

    const res2 = await executeRecipe(session, "[]");
    expect(res2.executed).toBe(false);
  });

  it("replays deterministically when selector matches (0 model calls)", async () => {
    const session = createMockSession({
      matchingSelectors: ["#cookie-accept-btn"],
    });

    const recipeJson = JSON.stringify([
      { instruction: "Accept cookies", selector: "#cookie-accept-btn" },
    ]);

    const res = await executeRecipe(session, recipeJson);
    expect(res.executed).toBe(true);
    expect(res.replayed).toBe(true);
    expect(res.fallback).toBe(false);
    expect(res.steps[0].selector).toBe("#cookie-accept-btn");
    // stagehand.act was NOT called!
    expect(session.stagehand.act).not.toHaveBeenCalled();
  });

  it("falls back to re-discovery when known selector fails to match", async () => {
    // Initial selector #broken-btn will NOT match, but fallback discovery candidate matches
    const session = createMockSession({
      matchingSelectors: ['button:has-text("Accept cookies")'],
    });

    const recipeJson = JSON.stringify([
      { instruction: "Accept cookies", selector: "#broken-btn" },
    ]);

    const res = await executeRecipe(session, recipeJson);
    expect(res.executed).toBe(true);
    expect(res.replayed).toBe(false);
    expect(res.fallback).toBe(true);
    expect(res.steps[0].selector).toBe('button:has-text("Accept cookies")');
  });

  it("discovers action on first run when no selector is stored yet", async () => {
    const session = createMockSession({
      stagehandSelector: "#discovered-banner-close",
    });

    const recipeJson = JSON.stringify([
      { instruction: "dismiss promo popup" },
    ]);

    const res = await executeRecipe(session, recipeJson);
    expect(res.executed).toBe(true);
    expect(res.replayed).toBe(false);
    expect(res.fallback).toBe(false);
    expect(res.steps[0].selector).toBe("#discovered-banner-close");
    expect(session.stagehand.act).toHaveBeenCalledWith("dismiss promo popup");
  });

  it("handles wait instructions cleanly", async () => {
    const session = createMockSession();
    const recipeJson = JSON.stringify([
      { instruction: "wait 2s", selector: "wait:2000" },
    ]);

    const res = await executeRecipe(session, recipeJson);
    expect(res.executed).toBe(true);
    expect(res.replayed).toBe(true);
    expect(session.page.waitForTimeout).toHaveBeenCalledWith(2000);
  });
});
