import { createBrowserSession, type LaunchOptions } from "./session.js";

export interface ExtractResult {
  rawText: string;
  browserMs: number;
}

export async function extractPageText(
  url: string,
  selector?: string | null,
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
    };
  } finally {
    await session.close();
  }
}
