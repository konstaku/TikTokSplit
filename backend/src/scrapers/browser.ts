import puppeteer, { Browser, Page } from 'puppeteer';
import { USER_AGENT } from './constants';
import { log } from './logger';

export async function launchBrowser(): Promise<Browser> {
  log('launch browser');
  return puppeteer.launch({ headless: true });
}

export async function withPage<T>(
  browser: Browser,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const page = await browser.newPage();
  try {
    if ((page as any).emulateUserAgent) {
      await (page as any).emulateUserAgent(USER_AGENT);
    } else {
      await page.setExtraHTTPHeaders({
        'user-agent': USER_AGENT,
        'accept-language': 'en-US,en;q=0.9',
      });
    }
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}
