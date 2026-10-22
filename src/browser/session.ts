import {
  browserbase,
  localBrowser,
  Stagehand,
  type Page,
  type StagehandBrowser,
} from "@browserbasehq/stagehand";
import { loadConfig } from "../config.js";

export interface BrowserSession {
  stagehand: Stagehand;
  browser: StagehandBrowser;
  page: Page;
  close: () => Promise<void>;
}

export interface LaunchOptions {
  forceLocal?: boolean;
}

export async function createBrowserSession(options: LaunchOptions = {}): Promise<BrowserSession> {
  const config = loadConfig();
  const useCloud = Boolean(config.BROWSERBASE_API_KEY) && !options.forceLocal;

  let browser: StagehandBrowser;

  if (useCloud) {
    browser = await browserbase.launch({
      apiKey: config.BROWSERBASE_API_KEY,
      projectId: config.BROWSERBASE_PROJECT_ID || undefined,
      browserSettings: {
        blockAds: true,
      },
    });
  } else {
    browser = await localBrowser.launch({
      headless: true,
    });
  }

  const stagehand = await Stagehand.create({ browser });

  const pages = await browser.context.pages();
  const page = pages[0] || (await browser.context.newPage());

  const close = async () => {
    try {
      await stagehand.close();
    } catch {
      // Ignore if already closed
    }
    try {
      await browser.close();
    } catch {
      // Ignore if already closed
    }
  };

  return {
    stagehand,
    browser,
    page,
    close,
  };
}
