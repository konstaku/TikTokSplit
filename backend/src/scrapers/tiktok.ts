import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio: typeof import('cheerio') = require('cheerio');
import puppeteer, { type Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

export interface TikTokVideo {
  videoUrl: string; // TikViewer detail/download page URL
  user: string;
  desc: string;
}

export interface TikTokResolvedVideo {
  mp4Url: string;
  user: string;
  desc: string;
}

function toAbs(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://www.tikviewer.com${url.startsWith('/') ? '' : '/'}${url}`;
}

async function dumpHtmlIfDebug(
  html: string,
  dumpFilePath?: string
): Promise<void> {
  if (!process.env.DEBUG_SCRAPE || !dumpFilePath) return;
  try {
    await fs.promises.mkdir(path.dirname(dumpFilePath), { recursive: true });
    await fs.promises.writeFile(dumpFilePath, html, 'utf8');
    console.log(`[scrape] dumped HTML -> ${dumpFilePath}`);
    // eslint-disable-next-line no-empty
  } catch {}
}

type FetchOptions = { waitSelector?: string; delayMs?: number };

async function fetchHtml(
  url: string,
  dumpFilePath?: string,
  opts: FetchOptions = {}
): Promise<string | null> {
  console.log(`[scrape] fetchHtml -> ${url}`);
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    });
    if (data && typeof data === 'string') {
      // axios can't wait for dynamic content; still dump for debugging
      await dumpHtmlIfDebug(data, dumpFilePath);
      return data;
    }
    console.log(
      '[scrape] axios returned non-string data, falling back to puppeteer'
    );
    // eslint-disable-next-line no-empty
  } catch (e) {
    console.log(
      `[scrape] axios failed, fallback to puppeteer: ${(e as Error).message}`
    );
  }
  // Fallback to puppeteer
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    if ((page as any).emulateUserAgent) {
      await (page as any).emulateUserAgent(UA);
    } else {
      await page.setExtraHTTPHeaders({ 'user-agent': UA });
    }
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (opts.waitSelector) {
      try {
        console.log(`[scrape] waiting for selector: ${opts.waitSelector}`);
        await page.waitForSelector(opts.waitSelector, { timeout: 7000 });
      } catch {
        console.log('[scrape] waitSelector timeout; continuing');
      }
    }
    if (opts.delayMs && opts.delayMs > 0) {
      console.log(`[scrape] extra delay ${opts.delayMs}ms`);
      await new Promise<void>(resolve => setTimeout(resolve, opts.delayMs));
    }
    const html = await page.content();
    await browser.close();
    await dumpHtmlIfDebug(html, dumpFilePath);
    return html;
    // eslint-disable-next-line no-empty
  } catch (e) {
    console.log(`[scrape] puppeteer failed: ${(e as Error).message}`);
    return null;
  }
}

// Browser-native helpers (avoid static HTML issues)
async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    if ((page as any).emulateUserAgent) {
      await (page as any).emulateUserAgent(UA);
    } else {
      await page.setExtraHTTPHeaders({ 'user-agent': UA });
    }
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function fetchTrendingAnchorsWithBrowser(): Promise<string[]> {
  return await withBrowser<string[]>(async page => {
    const url = 'https://www.tikviewer.com/trending';
    console.log('[scrape] browser goto trending');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Give time for client-side rendering
    await new Promise<void>(r => setTimeout(r, 2500));
    try {
      await page.waitForSelector('a[href^="/video/"]', { timeout: 8000 });
    } catch {}
    const hrefs = await page.$$eval(
      'a[href^="/video/"], a[href*="/video/"]',
      nodes =>
        Array.from(
          new Set(
            nodes.map(n => (n as HTMLAnchorElement).getAttribute('href') || '')
          )
        )
    );
    console.log(`[scrape] browser anchors (/video/): ${hrefs.length}`);
    return hrefs
      .filter(Boolean)
      .slice(0, 3)
      .map(h => h!);
  });
}

async function fetchDetailMp4WithBrowser(
  detailUrl: string
): Promise<string | null> {
  return await withBrowser<string | null>(async page => {
    console.log(`[scrape] browser goto detail -> ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise<void>(r => setTimeout(r, 1200));
    try {
      await page.waitForSelector('video, a[href*="mp4"]', { timeout: 7000 });
    } catch {}

    // Ensure video is in view and try to initiate playback so currentSrc populates
    try {
      await page.evaluate(() => {
        const v = document.querySelector('video') as HTMLVideoElement | null;
        if (!v) return;
        v.scrollIntoView({ block: 'center', inline: 'center' });
      });
      // Try clicking overlay/play if present
      try {
        await page.click('video');
      } catch {}
      await new Promise<void>(r => setTimeout(r, 800));
      // Try programmatic play (may be blocked, but worth attempting)
      try {
        await page.evaluate(async () => {
          const v = document.querySelector('video') as HTMLVideoElement | null;
          if (v && v.paused) {
            const p = v.play();
            if (p && typeof (p as any).catch === 'function') {
              (p as any).catch(() => {});
            }
          }
        });
      } catch {}
      await new Promise<void>(r => setTimeout(r, 800));
    } catch {}

    // Prefer direct video/src, source/src, or currentSrc
    const probe = await page.evaluate(() => {
      const results: string[] = [];
      const v = document.querySelector('video') as HTMLVideoElement | null;
      if (v) {
        if (v.currentSrc) results.push(v.currentSrc);
        if (v.src) results.push(v.src);
      }
      document.querySelectorAll('video source').forEach(srcEl => {
        const s =
          (srcEl as HTMLSourceElement).src ||
          (srcEl as HTMLElement).getAttribute('src') ||
          '';
        if (s) results.push(s);
      });
      // Any anchor that looks like mp4
      document.querySelectorAll('a[href*=".mp4"]').forEach(a => {
        const href = (a as HTMLAnchorElement).href;
        if (href) results.push(href);
      });
      // De-dup
      return Array.from(new Set(results));
    });
    if (probe.length) {
      console.log(`[scrape] browser video candidates: ${probe.length}`);
      const found = probe.find(u => /\.mp4(\?|$)/i.test(u)) || probe[0];
      if (found) {
        console.log(`[scrape] browser picked -> ${found}`);
        return toAbs(found);
      }
    } else {
      console.log('[scrape] browser: no video candidates found via DOM');
    }

    // One more attempt: wait for a video src to become non-empty
    try {
      await page.waitForFunction(
        () => {
          const v = document.querySelector('video') as HTMLVideoElement | null;
          return !!(v && (v.currentSrc || v.src));
        },
        { timeout: 4000 }
      );
      const late = await page.evaluate(() => {
        const v = document.querySelector('video') as HTMLVideoElement | null;
        return v ? v.currentSrc || v.src || '' : '';
      });
      if (late) {
        console.log(`[scrape] browser late video src -> ${late}`);
        return toAbs(late);
      }
    } catch {}

    console.log('[scrape] browser: no mp4 found');
    return null;
  });
}

function extractMp4sFromHtml(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  // Prefer video and source first
  $('video[src], video source[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (/\.mp4(\?|$)/i.test(src)) urls.add(toAbs(src));
  });

  // Attribute-based fallbacks
  $('a[href], source[src]').each((_, el) => {
    const href = $(el).attr('href') || $(el).attr('src') || '';
    if (/\.mp4(\?|$)/i.test(href)) urls.add(toAbs(href));
  });

  // Download Video anchor text
  $('a').each((_, a) => {
    const text = ($(a).text() || '').trim().toLowerCase();
    const href = ($(a).attr('href') || '').trim();
    if (text.includes('download video') && href) urls.add(toAbs(href));
  });

  // data-* attributes that may contain mp4
  $('[data-url], [data-href], [data-src]').each((_, el) => {
    const cand =
      $(el).attr('data-url') ||
      $(el).attr('data-href') ||
      $(el).attr('data-src') ||
      '';
    if (/\.mp4(\?|$)/i.test(cand)) urls.add(toAbs(cand));
  });

  // Script contents regex
  const scriptText = $('script')
    .map((_, s) => $(s).html() || '')
    .get()
    .join('\n');
  const regex = /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(scriptText)) !== null) {
    urls.add(toAbs(m[0]));
  }

  // Page text fallback
  const text = $.root().text();
  let m2: RegExpExecArray | null;
  const regex2 = /https?:\/\/[^\s"']+\.mp4(?:\?[^\s"']*)?/gi;
  while ((m2 = regex2.exec(text)) !== null) {
    urls.add(toAbs(m2[0]));
  }

  const arr = Array.from(urls);
  console.log(`[scrape] extractMp4sFromHtml -> found ${arr.length} candidates`);
  return arr;
}

async function resolveMp4WithFollow(
  html: string,
  pageUrl: string,
  debugDir?: string,
  label?: string,
  depth = 0
): Promise<string | null> {
  const found = extractMp4sFromHtml(html, pageUrl);
  if (found.length) {
    console.log(`[scrape] MP4 found at depth ${depth}: ${found[0]}`);
    return found[0];
  }
  if (depth >= 2) {
    console.log('[scrape] stopping follow: max depth reached');
    return null;
  }

  const $ = cheerio.load(html);
  const followLinks: string[] = [];
  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim();
    if (!href) return;
    if (
      /^\/?video\//i.test(href) ||
      /download|mp4|video|watch|save/i.test(href)
    ) {
      followLinks.push(toAbs(href));
    }
  });
  console.log(
    `[scrape] follow candidates at depth ${depth}: ${followLinks.length}`
  );

  for (let i = 0; i < Math.min(3, followLinks.length); i++) {
    const link = followLinks[i];
    try {
      const nextDump =
        debugDir && label
          ? path.join(debugDir, `${label}_follow${depth + 1}_${i + 1}.html`)
          : undefined;
      const nextHtml = await fetchHtml(link, nextDump, {
        waitSelector: 'video, a[href*="mp4"]',
        delayMs: 1500,
      });
      if (!nextHtml) continue;
      const mp4 = await resolveMp4WithFollow(
        nextHtml,
        link,
        debugDir,
        label,
        depth + 1
      );
      if (mp4) return mp4;
      // eslint-disable-next-line no-empty
    } catch {}
  }
  return null;
}

/**
 * Step 1 & 2: Extract first 3 /video/ hrefs from trending page
 */
export async function getTopTikTokVideos(
  date: string,
  debugDir?: string
): Promise<TikTokVideo[]> {
  // Prefer browser-native extraction
  const hrefs = await fetchTrendingAnchorsWithBrowser();
  console.log(
    `[scrape] trending anchors (/video/) via browser: ${hrefs.length}`
  );
  const videos: TikTokVideo[] = hrefs
    .slice(0, 3)
    .map(h => ({ videoUrl: toAbs(h), user: 'unknown', desc: '' }));

  // Fallback to HTML path if browser found none
  if (videos.length === 0) {
    const url = 'https://www.tikviewer.com/trending';
    const dumpPath = debugDir
      ? path.join(debugDir, `debug_trending.html`)
      : undefined;
    const html = await fetchHtml(url, dumpPath, {
      waitSelector: 'a[href^="/video/"]',
      delayMs: 3000,
    });
    if (!html) return [];
    const $ = cheerio.load(html);
    const anchors = Array.from(
      new Set(
        $('a[href^="/video/"], a[href*="/video/"]')
          .map((_, a) => $(a).attr('href') || '')
          .get()
      )
    );
    console.log(
      `[scrape] trending anchors (/video/) via html: ${anchors.length}`
    );
    return anchors
      .slice(0, 3)
      .map(h => ({ videoUrl: toAbs(h), user: 'unknown', desc: '' }));
  }

  return videos;
}

/**
 * Step 3: Open each detail page and extract MP4 from <video>/<source>, else fallbacks
 */
export async function resolveMp4FromTikViewerPage(
  pageUrl: string,
  debugDir?: string,
  label?: string
): Promise<string | null> {
  console.log(`[scrape] resolve MP4 from detail -> ${pageUrl}`);

  // Prefer browser-native extraction
  const viaBrowser = await fetchDetailMp4WithBrowser(pageUrl);
  if (viaBrowser) return viaBrowser;

  // Fallback to HTML approach
  const dumpPath =
    debugDir && label ? path.join(debugDir, `${label}.html`) : undefined;
  const html = await fetchHtml(pageUrl, dumpPath, {
    waitSelector: 'video, a[href*="mp4"]',
    delayMs: 2000,
  });
  if (!html) return null;

  const $ = cheerio.load(html);
  const directVideo =
    $('video[src]').attr('src') || $('video source[src]').attr('src') || '';
  if (directVideo && /\.mp4(\?|$)/i.test(directVideo)) {
    const abs = toAbs(directVideo);
    console.log(`[scrape] direct <video> MP4 -> ${abs}`);
    return abs;
  }

  console.log('[scrape] no direct <video> mp4, trying fallbacks & follow');
  return await resolveMp4WithFollow(html, pageUrl, debugDir, label, 0);
}

/**
 * Orchestrator: Step 1-3 end-to-end
 */
export async function getTopTikTokMp4s(
  date: string
): Promise<TikTokResolvedVideo[]> {
  const debugDir = process.env.DEBUG_SCRAPE
    ? path.resolve(__dirname, '../../public/tmp', date)
    : undefined;
  if (debugDir) console.log(`[scrape] DEBUG_SCRAPE on -> ${debugDir}`);

  const items = await getTopTikTokVideos(date, debugDir);
  console.log(`[scrape] trending detail pages -> ${items.length}`);

  const out: TikTokResolvedVideo[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const mp4 = await resolveMp4FromTikViewerPage(
        item.videoUrl,
        debugDir,
        `detail_${i + 1}`
      );
      if (mp4) {
        out.push({ mp4Url: mp4, user: item.user, desc: item.desc });
        console.log(`[scrape] resolved MP4 [${i + 1}] -> ${mp4}`);
      } else {
        console.log(`[scrape] no MP4 resolved for -> ${item.videoUrl}`);
      }
      // eslint-disable-next-line no-empty
    } catch (e) {
      console.log(
        `[scrape] error resolving MP4 for ${item.videoUrl}: ${
          (e as Error).message
        }`
      );
    }
  }
  console.log(`[scrape] total resolved MP4s -> ${out.length}`);
  return out;
}
