import { Router, Request, Response } from 'express';
import { GenerateScenesRequestSchema, GenerateScenesResponse } from '../schemas/director-json.js';
import { processScript } from '../director/pipeline.js';

const router = Router();

/**
 * POST /generate-scenes
 *
 * Parses a screenplay and generates Director JSON with voice assignments and audio cues.
 * This is the TypeScript port of the Python Director service.
 *
 * Request body:
 *   - project_id: string
 *   - script_text: string
 *
 * Response:
 *   - project_id: string
 *   - success: boolean
 *   - scene_count: number
 *   - processing_time: number (seconds)
 *   - director_json: DirectorJSON (full output)
 *   - validation_report: ValidationReport
 */
router.post('/generate-scenes', async (req: Request, res: Response): Promise<void> => {
  const start = Date.now();

  // Validate request
  const parsed = GenerateScenesRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      project_id: req.body?.project_id || 'unknown',
      success: false,
      message: 'Invalid request: ' + JSON.stringify(parsed.error.issues),
    } as GenerateScenesResponse);
    return;
  }

  const { project_id, script_text } = parsed.data;

  try {
    console.log(`🎬 [generate-scenes] Starting for project: ${project_id}`);
    console.log(`📄 Script length: ${script_text.length} characters`);

    // Run the full Director pipeline:
    // 1. DirectorAgent parses script → Director JSON with voice assignments
    // 2. AudioDirectorAgent selects audio → Scene Audio JSON
    // 3. Validators check and auto-correct business rules
    // 4. Merge results into final Director JSON
    const result = await processScript({ project_id, script_text });

    const processingTime = (Date.now() - start) / 1000;
    console.log(`✅ [generate-scenes] Complete in ${processingTime.toFixed(2)}s`);
    console.log(`📊 Scenes generated: ${result.director_json.scenes.length}`);

    res.json({
      project_id,
      success: true,
      scene_count: result.director_json.scenes.length,
      processing_time: processingTime,
      // Include full results for downstream processing
      director_json: result.director_json,
      validation_report: result.validation_report,
    });
  } catch (error) {
    console.error(`❌ [generate-scenes] Error:`, error);
    res.status(500).json({
      project_id,
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      processing_time: (Date.now() - start) / 1000,
    } as GenerateScenesResponse);
  }
});

export default router;
