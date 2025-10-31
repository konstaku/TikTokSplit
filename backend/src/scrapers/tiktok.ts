import path from 'path';
import { BASE_URL } from './constants';
import { log } from './logger';
import { launchBrowser } from './browser';
import { fetchTrendingAnchors } from './trending';
import { resolveMp4FromDetail } from './detail';

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

export async function getTopTikTokVideos(
  date: string,
  debugDir?: string
): Promise<TikTokVideo[]> {
  const browser = await launchBrowser();
  try {
    const anchors = await fetchTrendingAnchors(browser);
    log('trending anchors total:', anchors.length);
    return anchors.slice(0, 3).map(href => ({
      videoUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      user: 'unknown',
      desc: '',
    }));
  } finally {
    await browser.close();
  }
}

export async function resolveMp4FromTikViewerPage(
  pageUrl: string,
  debugDir?: string,
  label?: string
): Promise<string | null> {
  const browser = await launchBrowser();
  try {
    return await resolveMp4FromDetail(browser, pageUrl);
  } finally {
    await browser.close();
  }
}

export async function getTopTikTokMp4s(
  date: string
): Promise<TikTokResolvedVideo[]> {
  const debugDir = process.env.DEBUG_SCRAPE
    ? path.resolve(__dirname, '../../public/tmp', date)
    : undefined;
  if (debugDir) log('DEBUG_SCRAPE on ->', debugDir);

  const browser = await launchBrowser();
  try {
    const anchors = await fetchTrendingAnchors(browser);
    log('orchestrator: trending detail pages ->', anchors.length);

    const out: TikTokResolvedVideo[] = [];
    for (let i = 0; i < Math.min(3, anchors.length); i++) {
      const detailUrl = anchors[i];
      const mp4 = await resolveMp4FromDetail(browser, detailUrl);
      if (mp4) {
        out.push({ mp4Url: mp4, user: 'unknown', desc: '' });
        log(`resolved MP4 [${i + 1}] ->`, mp4);
      } else {
        log('no MP4 resolved for ->', detailUrl);
      }
    }
    log('total resolved MP4s ->', out.length);
    return out;
  } finally {
    await browser.close();
  }
}
