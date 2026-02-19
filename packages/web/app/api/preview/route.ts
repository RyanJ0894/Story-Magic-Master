import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';
import { orchestratorPost } from '@/lib/orchestrator-fetch';

const PreviewRequestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  sceneId: z.string().min(1, 'Scene ID is required'),
});

export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, PreviewRequestSchema);
  if ('error' in parsed) return parsed.error;

  const { projectId, sceneId } = parsed.data;

  // Fetch project (verify ownership and get director_json)
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, userId: true, directorJson: true, audioOverrides: true, voiceAssignments: true },
  });

  if (!project) {
    return NextResponse.json({
      error: 'Project not found',
      code: 'PROJECT_NOT_FOUND',
    }, { status: 404 });
  }

  // Extract the requested scene from director_json
  const directorJson = project.directorJson as Record<string, unknown> | null;
  const scenes = directorJson?.scenes;
  if (!Array.isArray(scenes)) {
    return NextResponse.json({
      error: 'Project has no parsed scenes. Generate scenes first.',
      code: 'VALIDATION_ERROR',
    }, { status: 400 });
  }

  const scene = scenes.find((s: { scene_id: string }) => s.scene_id === sceneId);
  if (!scene) {
    return NextResponse.json({
      error: `Scene ${sceneId} not found in project`,
      code: 'VALIDATION_ERROR',
    }, { status: 404 });
  }

  // Budget check
  try {
    const result = await prisma.$queryRaw<[{ get_remaining_previews: number }]>`
      SELECT get_remaining_previews(${userId}::text)
    `;
    const remainingPreviews = result[0]?.get_remaining_previews ?? 0;

    if (remainingPreviews <= 0) {
      return NextResponse.json({
        error: 'No previews remaining. Generate audio to use page credits, which grant more previews.',
        code: 'PREVIEW_BUDGET_EXCEEDED',
        remainingPreviews: 0,
      }, { status: 403 });
    }
  } catch (error) {
    log.error('Budget check error', error);
    return NextResponse.json({
      error: 'Failed to check preview budget',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }

  // Apply audio overrides to the scene (same logic as generate route)
  const validCategories = ['music', 'ambience', 'sfx'];
  const audioOverrides = Array.isArray(project.audioOverrides)
    ? (project.audioOverrides as Array<{ user_selected?: boolean; file?: string; scene_id?: string; category?: string; cue_index?: number }>).filter(
        (o) =>
          o.user_selected && o.file && o.scene_id === sceneId && validCategories.includes(o.category || '')
      )
    : [];

  if (audioOverrides.length > 0) {
    for (const override of audioOverrides) {
      const category = override.category as 'music' | 'ambience' | 'sfx';
      const cueArray = scene[category];
      if (!Array.isArray(cueArray) || (override.cue_index ?? 0) >= cueArray.length) continue;
      cueArray[override.cue_index ?? 0] = {
        ...cueArray[override.cue_index ?? 0],
        file: override.file,
        reasoning: 'User override',
      };
    }
  }

  // Apply voice overrides to the scene
  const voiceAssignments = project.voiceAssignments as unknown[];
  if (Array.isArray(voiceAssignments)) {
    for (const assignment of voiceAssignments as Array<{ user_selected?: boolean; voice_id?: string; character_name?: string }>) {
      if (assignment.user_selected && assignment.voice_id && assignment.character_name) {
        for (const line of scene.dialogue || []) {
          if (line.character === assignment.character_name) {
            line.voice_key = assignment.voice_id;
          }
        }
      }
    }
  }

  // Call orchestrator POST /preview
  try {
    const response = await orchestratorPost('/preview', {
      project_id: projectId,
      scene,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.error('Orchestrator preview error', undefined, { errorBody });
      return NextResponse.json({
        error: 'Preview generation failed',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }

    const result = await response.json();

    // Increment preview usage on success
    try {
      await prisma.$executeRaw`
        SELECT increment_preview_usage(${userId}::text)
      `;
    } catch (incrementError) {
      log.warn('Failed to increment preview usage', { error: incrementError });
      // Don't fail the request - preview was generated successfully
    }

    // Get updated remaining count
    let updatedRemaining = 0;
    try {
      const remainingResult = await prisma.$queryRaw<[{ get_remaining_previews: number }]>`
        SELECT get_remaining_previews(${userId}::text)
      `;
      updatedRemaining = remainingResult[0]?.get_remaining_previews ?? 0;
    } catch {
      // Non-critical, use 0
    }

    return NextResponse.json({
      previewUrl: result.preview_url,
      previewPath: result.preview_path,
      durationSeconds: result.duration_seconds,
      remainingPreviews: updatedRemaining,
    });
  } catch (error) {
    log.error('Preview generation error', error);
    return NextResponse.json({
      error: 'Failed to generate preview',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}, { rateLimit: 'strict' });
