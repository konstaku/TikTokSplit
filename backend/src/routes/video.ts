import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getTopTikTokVideos } from '../scrapers/tiktok';
import { getBreakingNews } from '../scrapers/news';
import {
  mergeTikTokVideos,
  VideoInput,
  NewsOverlay,
} from '../videoProcessing/mergeVideos';

const router = Router();

router.get('/:date', (req: Request, res: Response) => {
  res.json({ message: `Hello World for ${req.params.date}` });
});

router.post('/:date/generate', async (req: Request, res: Response) => {
  const date = req.params.date;
  try {
    // 1. Get TikTok videos (stubbed)
    const tiktoks = await getTopTikTokVideos(date);

    // 2. Download or simulate download (use sample local paths for stub)
    // For now just map their video URLs to local sample files
    const downloaded: VideoInput[] = [
      { path: path.resolve(__dirname, '../../public/sample1.mp4'), speed: 2 },
      {
        path: path.resolve(__dirname, '../../public/sample2.mp4'),
        speed: 1.25,
      },
      { path: path.resolve(__dirname, '../../public/sample3.mp4'), speed: 1.5 },
    ];
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
    // 6. Merge videos (stub)
    await mergeTikTokVideos(downloaded, newsOverlays, outPath);
    // 7. Return result (serve file path)
    res.json({ success: true, url: `/public/${outName}` });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed',
    });
  }
});

export default router;
