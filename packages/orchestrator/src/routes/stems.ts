/**
 * Stems Route
 *
 * GET /stems/:project_id        — list available stem files for a project
 * GET /stems/:project_id/zip    — stream a zip archive of all stems
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { getOutputDir } from '../lib/env.js';
import { log } from '../lib/logger.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function projectPath(projectId: string): string {
  return path.join(getOutputDir(), projectId);
}

function listStems(projectId: string): Array<{ name: string; sizeBytes: number; type: string }> {
  const dir = projectPath(projectId);
  if (!fs.existsSync(dir)) return [];

  const stems: Array<{ name: string; sizeBytes: number; type: string }> = [];

  // Episode (full mix)
  const episode = path.join(dir, 'episode.m4a');
  if (fs.existsSync(episode)) {
    stems.push({ name: 'episode.m4a', sizeBytes: fs.statSync(episode).size, type: 'episode' });
  }

  // Per-scene mixes and dialogue stems
  const scenesDir = path.join(dir, 'scenes');

  // Root-level per-scene mixes: scene-{id}.m4a
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith('scene-') && file.endsWith('.m4a')) {
      stems.push({ name: file, sizeBytes: fs.statSync(path.join(dir, file)).size, type: 'scene_mix' });
    }
  }

  // Dialogue-only stems: scenes/dialogue-{id}.m4a
  if (fs.existsSync(scenesDir)) {
    for (const file of fs.readdirSync(scenesDir)) {
      if (file.startsWith('dialogue-') && file.endsWith('.m4a')) {
        stems.push({ name: `scenes/${file}`, sizeBytes: fs.statSync(path.join(scenesDir, file)).size, type: 'dialogue' });
      }
    }
  }

  return stems;
}

// GET /stems/:project_id — list available stems
router.get('/stems/:project_id', (req: Request, res: Response): void => {
  const { project_id } = req.params;

  if (!UUID_RE.test(project_id)) {
    res.status(400).json({ error: 'Invalid project ID format' });
    return;
  }

  const stems = listStems(project_id);

  if (stems.length === 0) {
    res.status(404).json({ error: 'No stems found — audio may not have been generated yet', stems: [] });
    return;
  }

  res.json({ project_id, stems });
});

// GET /stems/:project_id/zip — stream a zip (tar.gz) of all stems
router.get('/stems/:project_id/zip', (req: Request, res: Response): void => {
  const { project_id } = req.params;

  if (!UUID_RE.test(project_id)) {
    res.status(400).json({ error: 'Invalid project ID format' });
    return;
  }

  const stems = listStems(project_id);
  if (stems.length === 0) {
    res.status(404).json({ error: 'No stems found for project' });
    return;
  }

  const dir = projectPath(project_id);
  const gzip = createGzip();
  const filename = `stems-${project_id.slice(0, 8)}.tar.gz`;

  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Build a simple POSIX tar in memory and gzip-stream it
  gzip.pipe(res);
  gzip.on('error', (err) => {
    log.error('Stems zip stream error', err, { projectId: project_id });
    if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
  });

  (async () => {
    try {
      for (const stem of stems) {
        const filePath = path.join(dir, stem.name);
        if (!fs.existsSync(filePath)) continue;

        const data = fs.readFileSync(filePath);
        const name = stem.name.replace(/\//g, '_'); // flatten path for tar entry name

        // Minimal POSIX tar header (512 bytes)
        const header = Buffer.alloc(512);
        Buffer.from(name.slice(0, 99)).copy(header, 0);      // filename
        Buffer.from('0000644\0').copy(header, 100);           // file mode
        Buffer.from('0000000\0').copy(header, 108);           // uid
        Buffer.from('0000000\0').copy(header, 116);           // gid
        const sizeOctal = data.length.toString(8).padStart(11, '0') + '\0';
        Buffer.from(sizeOctal).copy(header, 124);             // file size
        Buffer.from(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0').copy(header, 136); // mtime
        Buffer.from('        ').copy(header, 148);            // checksum placeholder
        header[156] = 0x30;                                   // type '0' = regular file
        Buffer.from('ustar\0').copy(header, 257);             // magic
        // Compute checksum
        let chk = 0;
        for (let i = 0; i < 512; i++) chk += header[i];
        Buffer.from(chk.toString(8).padStart(6, '0') + '\0 ').copy(header, 148);

        gzip.write(header);
        gzip.write(data);
        // Pad to 512-byte block boundary
        const pad = (512 - (data.length % 512)) % 512;
        if (pad) gzip.write(Buffer.alloc(pad));
      }
      // End-of-archive: two 512-byte zero blocks
      gzip.write(Buffer.alloc(1024));
      gzip.end();
    } catch (err) {
      log.error('Stems zip build error', err instanceof Error ? err : new Error(String(err)), { projectId: project_id });
      gzip.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();
});

export default router;
