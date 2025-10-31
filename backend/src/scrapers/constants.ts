export const BASE_URL = 'https://www.tikviewer.com';
export const TRENDING_URL = `${BASE_URL}/trending`;

export const SELECTORS = {
  trendingAnchor: 'a[href^="/video/"], a[href*="/video/"]',
  videoOrMp4: 'video, a[href*="mp4"]',
};

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const WAITS = {
  trendingDelayMs: 2500,
  detailDelayMs: 1500,
  selectorTimeoutMs: 8000,
};
