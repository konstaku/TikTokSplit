import axios from 'axios';
// Use require to avoid ESM interop pitfalls with cheerio
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio: typeof import('cheerio') = require('cheerio');

export interface TikTokVideo {
  videoUrl: string; // This will be the detailed/download page, not direct mp4 yet
  user: string;
  desc: string;
}

/**
 * Scrape top 3 TikTok trending video URLs from TikViewer
 * @param date Not used; always gets current trending
 * @returns Promise<TikTokVideo[]>
 */
export async function getTopTikTokVideos(date: string): Promise<TikTokVideo[]> {
  const url = 'https://www.tikviewer.com/trending';
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!data || typeof data !== 'string') return [];
  const $ = cheerio.load(data);

  const videos: TikTokVideo[] = [];
  $('.video-card, .trending-video, .video-entry').each((_, el) => {
    if (videos.length >= 3) return false;
    const videoUrl = $(el).find('a').attr('href');
    const absUrl = videoUrl ? `https://www.tikviewer.com${videoUrl}` : '';
    const user = $(el).find('.user, .author').text().trim() || 'unknown';
    const desc = $(el).find('.caption, .description, .desc').text().trim();
    if (absUrl) {
      videos.push({ videoUrl: absUrl, user, desc });
    }
  });
  return videos;
}
