import { Router, Request, Response } from 'express';
import { getHealthData } from '../lib/monitoring.js';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json(getHealthData());
});

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Story Magic Consolidated Service',
    version: '2.0.0',
    endpoints: {
      health: 'GET /health',
      generateScenes: 'POST /generate-scenes',
      orchestrate: 'POST /orchestrate',
      download: 'GET /download/:project_id/:filename',
    },
  });
});

export default router;
