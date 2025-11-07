import ffmpeg from 'fluent-ffmpeg';

export interface VideoInput {
  path: string;
  speed: number;
}

export interface NewsOverlay {
  image: string;
  headline: string;
  time: number;
}

function buildSpeedFilter(
  index: number,
  speed: number
): { v: string; a: string } {
  const setpts = `setpts=PTS/${speed}`; // speed up video by factor
  const atempo = `atempo=${speed}`; // valid range 0.5..2.0 (our max is 2)
  // Use loop filter with proper parameters to avoid freezing
  // loop=-1 means infinite, size=32767 is max frames to buffer
  const v = `[${index}:v]loop=-1:size=32767:start=0,${setpts},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v${index}]`;
  const a = `[${index}:a]aloop=-1:size=2e+09,${atempo}[a${index}]`;
  return { v, a };
}

export async function mergeTikTokVideos(
  videoInputs: VideoInput[],
  newsOverlays: NewsOverlay[],
  outputPath: string
): Promise<void> {
  if (videoInputs.length !== 3)
    throw new Error('mergeTikTokVideos requires exactly 3 inputs');

  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();

    // Add inputs (looping handled via loop filter in filtergraph)
    for (const vi of videoInputs) {
      cmd.input(vi.path);
    }

    // Build filter graph
    const fparts: string[] = [];
    const speeds = videoInputs.map(v => v.speed);

    // Speed adjustments and prep
    for (let i = 0; i < 3; i++) {
      const { v, a } = buildSpeedFilter(i, speeds[i]);
      fparts.push(v);
      fparts.push(a);
    }

    // Alpha overlays: base v0, overlay v1 then v2 at 33% opacity
    // Convert to rgba for alpha manipulation, then blend
    // Use shortest=0 to ensure all streams continue (they loop via -stream_loop)
    fparts.push(`[v0]format=rgba[v0rgba]`);
    fparts.push(`[v1]format=rgba,colorchannelmixer=aa=0.33[v1a]`);
    fparts.push(`[v2]format=rgba,colorchannelmixer=aa=0.33[v2a]`);
    fparts.push(`[v0rgba][v1a]overlay=shortest=0[v01]`);
    fparts.push(`[v01][v2a]overlay=shortest=0[vout]`);

    // Audio mix
    fparts.push(`[a0][a1][a2]amix=inputs=3:normalize=0[amix]`);

    const complex = fparts.join(';');

    cmd
      .complexFilter(complex)
      .outputOptions([
        '-map [vout]',
        '-map [amix]',
        '-t 30', // cut to 30 seconds
        '-preset veryfast',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .videoCodec('libx264')
      .audioCodec('aac')
      .on('start', (c: string) => {
        // eslint-disable-next-line no-console
        console.log('[ffmpeg] start:', c);
      })
      .on('error', (err: Error) => {
        // eslint-disable-next-line no-console
        console.error('[ffmpeg] error:', err.message);
        reject(err);
      })
      .on('end', () => {
        resolve();
      })
      .save(outputPath);
  });
}
