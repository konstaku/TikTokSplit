import axios from 'axios';
import Parser from 'rss-parser';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio: typeof import('cheerio') = require('cheerio');
import path from 'path';
import { downloadToFile } from '../utils/download';
import { log } from './logger';

export interface NewsItem {
  headline: string;
  image: string; // Local path or URL
  link: string;
}

const RSS_FEEDS = [
  'https://rss.cnn.com/rss/cnn_topstories.rss',
  'https://apnews.com/apf-topnews',
  'https://feeds.reuters.com/reuters/topNews',
  'https://feeds.npr.org/1001/rss.xml',
  'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
];

const parser = new Parser();

/**
 * Extract image URL from article HTML if not in RSS
 */
async function extractImageFromArticle(
  articleUrl: string
): Promise<string | null> {
  try {
    const { data } = await axios.get(articleUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    // Try common image selectors
    const img =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('article img').first().attr('src') ||
      $('.article-image img').first().attr('src') ||
      '';
    return img || null;
  } catch {
    return null;
  }
}

/**
 * Normalize headline for uniqueness check (remove common words, lowercase)
 */
function normalizeHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
    .trim()
    .substring(0, 50); // First 50 chars for comparison
}

/**
 * Scrape top US news headline and image from RSS feeds
 * Ensures unique topics (no duplicates from different sources)
 */
export async function getBreakingNews(date?: string): Promise<NewsItem> {
  const seenTopics = new Set<string>();
  const candidates: NewsItem[] = [];

  log('fetching news from RSS feeds');

  // Try each RSS feed until we find a unique headline
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      log(`parsed feed: ${feed.title}, items: ${feed.items.length}`);

      for (const item of feed.items.slice(0, 5)) {
        // Skip if we've seen a similar topic
        const normalized = normalizeHeadline(item.title || '');
        if (seenTopics.has(normalized)) {
          log(`skipping duplicate topic: ${item.title}`);
          continue;
        }

        seenTopics.add(normalized);

        // Extract image from RSS or article
        let imageUrl =
          item.enclosure?.url ||
          item['media:content']?.['$']?.url ||
          item['media:thumbnail']?.['$']?.url ||
          '';

        // If no image in RSS, try scraping article page
        if (!imageUrl && item.link) {
          log(`no image in RSS, scraping article: ${item.link}`);
          imageUrl = (await extractImageFromArticle(item.link)) || '';
        }

        if (imageUrl) {
          candidates.push({
            headline: item.title || 'Breaking News',
            image: imageUrl,
            link: item.link || '',
          });
          log(`found candidate: ${item.title}`);
          break; // Found one from this feed, move to next
        }
      }
    } catch (err) {
      log(`error fetching ${feedUrl}: ${(err as Error).message}`);
    }

    // If we have a candidate, use it
    if (candidates.length > 0) break;
  }

  if (candidates.length === 0) {
    log('no news items found, using fallback');
    return {
      headline: 'Breaking News',
      image: 'https://via.placeholder.com/800x450?text=News',
      link: '',
    };
  }

  const selected = candidates[0];
  log(`selected news: ${selected.headline}`);

  // Download image locally if it's a URL
  if (selected.image.startsWith('http')) {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const imageDir = path.resolve(__dirname, '../../public/tmp', dateStr);
    const imageExt = path.extname(new URL(selected.image).pathname) || '.jpg';
    const imagePath = path.join(imageDir, `news${imageExt}`);

    try {
      await downloadToFile(selected.image, imagePath);
      selected.image = `/public/tmp/${dateStr}/news${imageExt}`;
      log(`downloaded image to: ${selected.image}`);
    } catch (err) {
      log(`failed to download image: ${(err as Error).message}`);
      // Keep original URL if download fails
    }
  }

  return selected;
}
