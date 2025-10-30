export interface NewsItem {
  headline: string;
  image: string;
  link: string;
}

/**
 * Scrape top US news headline and image (stub for today; typically use RSS)
 * @returns Promise<NewsItem>
 */
export async function getBreakingNews(): Promise<NewsItem> {
  // STUB: Replace with real RSS/news scrape logic
  return {
    headline: 'Major News Event Happened',
    image: 'https://example.com/news-image.jpg',
    link: 'https://cnn.com/article',
  };
}
