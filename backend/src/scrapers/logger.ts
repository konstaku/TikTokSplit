export function log(...args: unknown[]): void {
  if (!process.env.DEBUG_SCRAPE) return;
  // eslint-disable-next-line no-console
  console.log('[scrape]', ...args);
}
