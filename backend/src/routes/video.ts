import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getTopTikTokMp4s } from '../scrapers/tiktok';
import { getBreakingNews } from '../scrapers/news';
import {
  mergeTikTokVideos,
  VideoInput,
  NewsOverlay,
} from '../videoProcessing/mergeVideos';
import { downloadToFile } from '../utils/download';

const router = Router();

router.get('/:date', (req: Request, res: Response) => {
  res.json({ message: `Hello World for ${req.params.date}` });
});

router.post('/:date/generate', async (req: Request, res: Response) => {
  const date = req.params.date;
  try {
    // 1. Resolve top TikViewer MP4s (must be at least 3 distinct)
    const resolved = await getTopTikTokMp4s(date);
    if (resolved.length < 3) {
      return res.status(502).json({
        success: false,
        error: 'Need 3 distinct MP4 URLs but fewer were resolved',
      });
    }

    // 2. Download exactly 3 distinct videos
    const baseDir = path.resolve(__dirname, '../../public/tmp', date);
    const speeds = [2, 1.5, 1.25];
    const downloaded: VideoInput[] = [];
    for (let i = 0; i < 3; i++) {
      const item = resolved[i];
      const outPath = path.join(baseDir, `video${i + 1}.mp4`);
      await downloadToFile(item.mp4Url, outPath);
      downloaded.push({ path: outPath, speed: speeds[i] });
    }

    // 3. Get news overlay (stub)
    const news = await getBreakingNews();

    // 4. Build overlays (every 5s starting from 3s)
    const newsOverlays: NewsOverlay[] = [
      { image: news.image, headline: news.headline, time: 3 },
      { image: news.image, headline: news.headline, time: 8 },
      { image: news.image, headline: news.headline, time: 13 },
      { image: news.image, headline: news.headline, time: 18 },
      { image: news.image, headline: news.headline, time: 23 },
      { image: news.image, headline: news.headline, time: 28 },
    ];

    // 5. Output path
    const outName = `blend_${date}.mp4`;
    const outPath = path.resolve(__dirname, '../../public', outName);

    // 6. Merge videos (still stub)
    await mergeTikTokVideos(downloaded, newsOverlays, outPath);

    // 7. Return result
    res.json({ success: true, url: `/public/${outName}` });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed',
    });
  }
});

export default router;
