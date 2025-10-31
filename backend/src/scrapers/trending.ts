import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio: typeof import('cheerio') = require('cheerio');
import { Browser } from 'puppeteer';
import { withPage } from './browser';
import { BASE_URL, TRENDING_URL, SELECTORS, WAITS } from './constants';
import { log } from './logger';

export async function fetchTrendingAnchors(
  browser: Browser
): Promise<string[]> {
  // Prefer browser-native
  const hrefs = await withPage(browser, async page => {
    log('goto trending (browser)');
    await page.goto(TRENDING_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise<void>(r => setTimeout(r, WAITS.trendingDelayMs));
    try {
      await page.waitForSelector('a[href^="/video/"]', {
        timeout: WAITS.selectorTimeoutMs,
      });
    } catch {}
    const found = await page.$$eval(SELECTORS.trendingAnchor, nodes =>
      Array.from(
        new Set(
          nodes.map(n => (n as HTMLAnchorElement).getAttribute('href') || '')
        )
      )
    );
    log('browser anchors (/video/):', found.length);
    return found.filter(Boolean).slice(0, 3) as string[];
  });
  if (hrefs.length)
    return hrefs.map(h => (h.startsWith('http') ? h : `${BASE_URL}${h}`));

  // Fallback HTML
  log('fallback HTML fetch trending');
  const { data } = await axios.get(TRENDING_URL);
  const $ = cheerio.load(data);
  const anchors = Array.from(
    new Set(
      $(SELECTORS.trendingAnchor)
        .map((_, a) => $(a).attr('href') || '')
        .get()
    )
  );
  log('html anchors (/video/):', anchors.length);
  return anchors
    .slice(0, 3)
    .map(h => (h.startsWith('http') ? h : `${BASE_URL}${h}`));
}
