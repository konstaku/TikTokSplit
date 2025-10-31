// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio: typeof import('cheerio') = require('cheerio');
import axios from 'axios';
import { Browser } from 'puppeteer';
import { withPage } from './browser';
import { SELECTORS, WAITS } from './constants';
import { log } from './logger';

export async function resolveMp4FromDetail(
  browser: Browser,
  detailUrl: string
): Promise<string | null> {
  // Prefer browser-native
  const viaBrowser = await withPage(browser, async page => {
    log('goto detail (browser):', detailUrl);
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise<void>(r => setTimeout(r, WAITS.detailDelayMs));
    try {
      await page.waitForSelector(SELECTORS.videoOrMp4, {
        timeout: WAITS.selectorTimeoutMs,
      });
    } catch {}

    // Try to encourage currentSrc population
    try {
      await page.evaluate(() => {
        const v = document.querySelector('video') as HTMLVideoElement | null;
        if (v) v.scrollIntoView({ block: 'center', inline: 'center' });
      });
      try {
        await page.click('video');
      } catch {}
      await new Promise<void>(r => setTimeout(r, 600));
      try {
        await page.evaluate(async () => {
          const v = document.querySelector('video') as HTMLVideoElement | null;
          if (v && v.paused) {
            const p = v.play();
            if (p && typeof (p as any).catch === 'function')
              (p as any).catch(() => {});
          }
        });
      } catch {}
      await new Promise<void>(r => setTimeout(r, 600));
    } catch {}

    const candidates = await page.evaluate(() => {
      const out: string[] = [];
      const v = document.querySelector('video') as HTMLVideoElement | null;
      if (v) {
        if (v.currentSrc) out.push(v.currentSrc);
        if (v.src) out.push(v.src);
      }
      document.querySelectorAll('video source').forEach(s => {
        const el = s as HTMLSourceElement;
        if (el.src) out.push(el.src);
      });
      document.querySelectorAll('a[href*=".mp4"]').forEach(a => {
        const href = (a as HTMLAnchorElement).href;
        if (href) out.push(href);
      });
      return Array.from(new Set(out));
    });
    log('browser video candidates:', candidates.length);
    const found = candidates.find(u => /\.mp4(\?|$)/i.test(u)) || candidates[0];
    return found || '';
  });
  if (viaBrowser) return viaBrowser;

  // Fallback HTML
  log('fallback HTML detail:', detailUrl);
  const { data } = await axios.get(detailUrl);
  const $ = cheerio.load(data);
  const directVideo =
    $('video[src]').attr('src') || $('video source[src]').attr('src') || '';
  if (directVideo && /\.mp4(\?|$)/i.test(directVideo)) return directVideo;
  const mp4Href = $('a[href$=".mp4"]').attr('href') || '';
  return mp4Href || null;
}
