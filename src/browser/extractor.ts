import { executeRecipe, type RecipeStep } from "./recipe.js";
import { createBrowserSession, type LaunchOptions } from "./session.js";

export interface ExtractResult {
  rawText: string;
  browserMs: number;
  replayed: boolean;
  recipeFallback: boolean;
  updatedRecipe?: RecipeStep[];
}

export async function extractPageText(
  url: string,
  selector?: string | null,
  recipeJson?: string | null,
  options: LaunchOptions = {}
): Promise<ExtractResult> {
  const startTime = Date.now();
  const session = await createBrowserSession(options);

  try {
    // Navigate with a reasonable timeout
    await session.page.goto(url, {
      timeout: 30000,
    });

    // Wait for the DOM to settle
    await session.page.waitForLoadState("domcontentloaded");

    // Execute recipe steps if configured (cookie banners, tabs, clicks)
    let replayed = false;
    let recipeFallback = false;
    let updatedRecipe: RecipeStep[] | undefined;

    if (recipeJson) {
      const recipeRes = await executeRecipe(session, recipeJson);
      replayed = recipeRes.replayed;
      recipeFallback = recipeRes.fallback;
      if (recipeRes.steps.length > 0) {
        updatedRecipe = recipeRes.steps;
      }
    }

    let rawText = "";
    if (selector) {
      await session.page.waitForSelector(selector, { timeout: 10000 }).catch(() => {
        // Fall through if timeout, locator will attempt to read or throw
      });
      const locator = session.page.locator(selector);
      const count = await locator.count();
      if (count === 0) {
        throw new Error(`Target selector "${selector}" was not found on page ${url}`);
      }
      rawText = await locator.first().innerText();
    } else {
      rawText = await session.page.evaluate(() => {
        return document.body ? document.body.innerText : "";
      });
    }

    const browserMs = Date.now() - startTime;
    return {
      rawText,
      browserMs,
      replayed,
      recipeFallback,
      updatedRecipe,
    };
  } finally {
    await session.close();
  }
}
