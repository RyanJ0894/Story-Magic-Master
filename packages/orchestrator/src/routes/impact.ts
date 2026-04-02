/**
 * Impact StoryBuilder routes
 *
 * POST /impact/preview  — TTS first 150 words, return M4A binary
 * POST /impact/produce  — TTS full story, return M4A binary
 *
 * Both return raw audio/mp4 bytes. The web layer uploads to R2 and persists the URL.
 * Protected by serviceAuthMiddleware (x-service-key header).
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { execa } from 'execa';
import ffmpegStatic from 'ffmpeg-static';
import { ttsGenerate } from '../lib/audio.js';
import { log } from '../lib/logger.js';

const router = Router();
const ffmpeg = ffmpegStatic as unknown as string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function wavToM4a(wavBuffer: Buffer): Promise<Buffer> {
  const { stdout } = await execa(
    ffmpeg,
    [
      '-v', 'error',
      '-i', 'pipe:0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-f', 'mp4',
      'pipe:1',
    ],
    { input: wavBuffer, encoding: 'buffer' }
  );
  return stdout as unknown as Buffer;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PreviewSchema = z.object({
  storyText: z.string().min(1).max(8000),
  voiceId: z.string().min(1),
  voiceName: z.string().optional(),
});

const ProduceSchema = z.object({
  storyId: z.string().uuid(),
  title: z.string().optional(),
  storyText: z.string().min(1).max(8000),
  voiceId: z.string().min(1),
  voiceName: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /impact/preview — returns raw M4A binary (web uploads to R2)
// ---------------------------------------------------------------------------

router.post('/preview', async (req: Request, res: Response) => {
  const parse = PreviewSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const { storyText, voiceId } = parse.data;

  // Caller also truncates, but guard here too
  const previewText = storyText.trim().split(/\s+/).slice(0, 150).join(' ');

  try {
    log.info('Impact preview: generating TTS', { voiceId, words: previewText.split(/\s+/).length });
    const wavBuf = await ttsGenerate({ voice: { voice_id: voiceId, params_json: {} }, text: previewText });
    const m4aBuf = await wavToM4a(wavBuf);

    log.info('Impact preview: TTS complete', { bytes: m4aBuf.length });
    res.set('Content-Type', 'audio/mp4');
    res.set('Content-Length', String(m4aBuf.length));
    res.send(m4aBuf);
  } catch (err) {
    log.error('Impact preview: TTS failed', err instanceof Error ? err : undefined);
    res.status(503).json({ error: 'Audio generation failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /impact/produce — returns raw M4A binary (web uploads to R2)
// ---------------------------------------------------------------------------

router.post('/produce', async (req: Request, res: Response) => {
  const parse = ProduceSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const { storyId, storyText, voiceId } = parse.data;

  try {
    log.info('Impact produce: generating TTS', { storyId, voiceId, words: storyText.trim().split(/\s+/).length });
    const wavBuf = await ttsGenerate({ voice: { voice_id: voiceId, params_json: {} }, text: storyText });
    const m4aBuf = await wavToM4a(wavBuf);

    log.info('Impact produce: TTS complete', { storyId, bytes: m4aBuf.length });
    res.set('Content-Type', 'audio/mp4');
    res.set('Content-Length', String(m4aBuf.length));
    res.send(m4aBuf);
  } catch (err) {
    log.error('Impact produce: TTS failed', err instanceof Error ? err : undefined, { storyId });
    res.status(503).json({ error: 'Audio generation failed' });
  }
});

export default router;
