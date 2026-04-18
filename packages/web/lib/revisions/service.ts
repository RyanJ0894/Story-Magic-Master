/**
 * Revision Tracking Service
 *
 * Handles creating, retrieving, and comparing script revisions.
 */

import { log } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  Revision,
  RevisionRow,
  RevisionTimeline,
  RevisionTimelineEntry,
  RevisionComparison,
  RevisionChanges,
  ScoreTrajectory,
  DiffLine,
  rowToRevision,
  calculateWordCount,
  calculatePageCount,
  calculateChanges,
  calculateTrend,
  generateDiff,
} from './types';
import { generateScore } from '@/lib/scoring/service';

// =============================================================================
// Prisma-to-Row Adapter (type-safe camelCase → snake_case mapping)
// =============================================================================

/** Map Prisma revision result to RevisionRow */
function toRevisionRow(data: Record<string, unknown>): RevisionRow {
  return {
    id: data.id as string,
    project_id: data.projectId as string,
    version_number: data.versionNumber as number,
    label: (data.label as string | null) ?? null,
    script_text: data.scriptText as string,
    word_count: data.wordCount as number,
    page_count: data.pageCount as number,
    score_id: (data.scoreId as string | null) ?? null,
    overall_score: (data.overallScore as number | null) ?? null,
    changes_summary: (data.changesSummary as RevisionChanges | null) ?? null,
    created_at: String(data.createdAt),
    created_by: (data.createdBy as string | null) ?? null,
  };
}

// =============================================================================
// Create Revision
// =============================================================================

/**
 * Create a new revision for a project
 */
export async function createRevision(
  projectId: string,
  scriptText: string,
  options?: {
    label?: string;
    autoScore?: boolean;
    userId?: string;
  }
): Promise<Revision> {
  // Get the next version number
  const versionResult = await prisma.$queryRaw<[{ get_next_version_number: number }]>`
    SELECT get_next_version_number(${projectId}::uuid)
  `;

  const versionNumber = versionResult?.[0]?.get_next_version_number;
  if (versionNumber == null) {
    throw new Error('Failed to get version number');
  }

  // Calculate text metrics
  const wordCount = calculateWordCount(scriptText);
  const pageCount = calculatePageCount(scriptText);

  // Get previous revision for change calculation
  let changesSummary: RevisionChanges | null = null;
  if (versionNumber > 1) {
    const prevRevision = await prisma.revision.findFirst({
      where: {
        projectId,
        versionNumber: versionNumber - 1,
      },
      select: { scriptText: true, overallScore: true },
    });

    if (prevRevision) {
      changesSummary = calculateChanges(prevRevision.scriptText, scriptText);
    }
  }

  // Insert the revision
  let revision;
  try {
    revision = await prisma.revision.create({
      data: {
        projectId,
        versionNumber,
        label: options?.label || null,
        scriptText,
        wordCount,
        pageCount,
        changesSummary: (changesSummary ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        createdBy: options?.userId || null,
      },
    });
  } catch (error) {
    throw new Error(`Failed to create revision: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Also update the project's script_text
  await prisma.project.update({
    where: { id: projectId },
    data: {
      scriptText,
      pageCount,
    },
  });

  // Optionally generate a StoryScore for this revision
  if (options?.autoScore) {
    try {
      const score = await generateScore(projectId, scriptText);

      // Update revision with score
      await prisma.revision.update({
        where: { id: revision.id },
        data: {
          scoreId: score.id,
          overallScore: score.overallScore,
        },
      });

      // Mutate for return value
      (revision as Record<string, unknown>).scoreId = score.id;
      (revision as Record<string, unknown>).overallScore = score.overallScore;

      // Update changes_summary with score change if previous had score
      if (changesSummary) {
        const prevRevision = await prisma.revision.findFirst({
          where: {
            projectId,
            versionNumber: versionNumber - 1,
          },
          select: { overallScore: true },
        });

        if (prevRevision?.overallScore) {
          changesSummary.scoreChange = score.overallScore - Number(prevRevision.overallScore);
          await prisma.revision.update({
            where: { id: revision.id },
            data: { changesSummary: changesSummary as unknown as Prisma.InputJsonValue },
          });
        }
      }
    } catch (error) {
      log.error('Failed to auto-score revision', error);
      // Don't throw - revision was created successfully
    }
  }

  return rowToRevision(toRevisionRow(revision));
}

// =============================================================================
// Get Revisions
// =============================================================================

/**
 * Get a single revision by ID
 */
export async function getRevision(revisionId: string): Promise<Revision | null> {
  const data = await prisma.revision.findFirst({
    where: { id: revisionId },
  });

  if (!data) {
    return null;
  }

  return rowToRevision(toRevisionRow(data));
}

/**
 * Get all revisions for a project
 */
export async function getRevisions(projectId: string): Promise<Revision[]> {
  const data = await prisma.revision.findMany({
    where: { projectId },
    orderBy: { versionNumber: 'desc' },
  });

  return (data || []).map((row: Record<string, unknown>) => rowToRevision(toRevisionRow(row)));
}

/**
 * Get the latest revision for a project
 */
export async function getLatestRevision(projectId: string): Promise<Revision | null> {
  const data = await prisma.revision.findFirst({
    where: { projectId },
    orderBy: { versionNumber: 'desc' },
  });

  if (!data) {
    return null;
  }

  return rowToRevision(toRevisionRow(data));
}

// =============================================================================
// Timeline
// =============================================================================

/**
 * Get revision timeline for a project
 */
export async function getRevisionTimeline(projectId: string): Promise<RevisionTimeline> {
  // Get timeline entries — uses a stored procedure that may not exist in all envs
  let timelineData: Array<{
    id: string;
    version_number: number;
    label: string | null;
    word_count: number;
    page_count: number;
    overall_score: number | null;
    changes_summary: RevisionChanges | null;
    created_at: string;
  }> = [];
  try {
    timelineData = await prisma.$queryRaw`
      SELECT * FROM get_revision_timeline(${projectId}::uuid)
    `;
  } catch {
    // Stored procedure not yet deployed — return empty timeline gracefully
    const now = new Date().toISOString();
    return { projectId, revisions: [], totalRevisions: 0, firstRevision: now, latestRevision: now };
  }

  const entries: RevisionTimelineEntry[] = (timelineData || []).map((row: typeof timelineData[number]) => ({
    id: row.id,
    versionNumber: row.version_number,
    label: row.label || undefined,
    wordCount: row.word_count,
    pageCount: row.page_count,
    overallScore: row.overall_score || undefined,
    changesSummary: row.changes_summary ? {
      linesAdded: row.changes_summary.linesAdded,
      linesRemoved: row.changes_summary.linesRemoved,
      scoreChange: row.changes_summary.scoreChange,
    } : undefined,
    createdAt: row.created_at,
  }));

  // Get score trajectory
  const trajectoryData = await prisma.$queryRaw<Array<{
    revision_id: string;
    version_number: number;
    score: number;
    created_at: string;
  }>>`
    SELECT * FROM get_score_trajectory(${projectId}::uuid)
  `;

  let scoreTrajectory: ScoreTrajectory | undefined;
  if (trajectoryData && trajectoryData.length > 0) {
    const dataPoints = trajectoryData.map((row: typeof trajectoryData[number]) => ({
      revisionId: row.revision_id,
      versionNumber: row.version_number,
      score: row.score,
      date: row.created_at,
    }));

    const trend = calculateTrend(dataPoints);
    const avgImprovement = dataPoints.length > 1
      ? (dataPoints[dataPoints.length - 1].score - dataPoints[0].score) / (dataPoints.length - 1)
      : undefined;

    scoreTrajectory = {
      dataPoints,
      trend,
      averageImprovement: avgImprovement,
    };
  }

  return {
    projectId,
    revisions: entries,
    totalRevisions: entries.length,
    firstRevision: entries.length > 0 ? entries[entries.length - 1].createdAt : '',
    latestRevision: entries.length > 0 ? entries[0].createdAt : '',
    scoreTrajectory,
  };
}

// =============================================================================
// Compare Revisions
// =============================================================================

/**
 * Compare two revisions
 */
export async function compareRevisions(
  fromRevisionId: string,
  toRevisionId: string
): Promise<RevisionComparison> {
  const [fromRevision, toRevision] = await Promise.all([
    getRevision(fromRevisionId),
    getRevision(toRevisionId),
  ]);

  if (!fromRevision || !toRevision) {
    throw new Error('One or both revisions not found');
  }

  // Calculate changes
  const changes = calculateChanges(fromRevision.scriptText, toRevision.scriptText);

  // Generate line-by-line diff
  const diff = generateDiff(fromRevision.scriptText, toRevision.scriptText);

  // Score comparison if both have scores
  let scoreComparison;
  if (fromRevision.overallScore !== undefined && toRevision.overallScore !== undefined) {
    scoreComparison = {
      fromScore: fromRevision.overallScore,
      toScore: toRevision.overallScore,
      change: toRevision.overallScore - fromRevision.overallScore,
      percentChange: ((toRevision.overallScore - fromRevision.overallScore) / fromRevision.overallScore) * 100,
      dimensions: [], // Would need to fetch full scores to populate
    };
  }

  return {
    fromRevision,
    toRevision,
    changes,
    diff,
    scoreComparison,
  };
}

// generateDiff is now imported from types.ts with proper LCS algorithm

// =============================================================================
// Update Revision
// =============================================================================

/**
 * Update revision label
 */
export async function updateRevisionLabel(
  revisionId: string,
  label: string
): Promise<Revision> {
  try {
    const data = await prisma.revision.update({
      where: { id: revisionId },
      data: { label },
    });

    return rowToRevision(toRevisionRow(data));
  } catch (error) {
    throw new Error(`Failed to update revision: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// =============================================================================
// Delete Revision
// =============================================================================

/**
 * Delete a revision (cannot delete version 1)
 */
export async function deleteRevision(revisionId: string): Promise<void> {
  // Check if it's version 1
  const revision = await prisma.revision.findFirst({
    where: { id: revisionId },
    select: { versionNumber: true },
  });

  if (revision?.versionNumber === 1) {
    throw new Error('Cannot delete the initial revision');
  }

  try {
    await prisma.revision.delete({
      where: { id: revisionId },
    });
  } catch (error) {
    throw new Error(`Failed to delete revision: ${error instanceof Error ? error.message : String(error)}`);
  }
}
