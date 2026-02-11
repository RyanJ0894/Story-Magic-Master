/**
 * Revision Tracking Service
 *
 * Handles creating, retrieving, and comparing script revisions.
 */

import { prisma } from '@/lib/db';
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
        changesSummary: changesSummary as object | null,
        createdBy: options?.userId || null,
      },
    });
  } catch (err) {
    throw new Error(`Failed to create revision: ${err instanceof Error ? err.message : String(err)}`);
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
          changesSummary.scoreChange = score.overallScore - prevRevision.overallScore;
          await prisma.revision.update({
            where: { id: revision.id },
            data: { changesSummary: changesSummary as object },
          });
        }
      }
    } catch (err) {
      console.error('Failed to auto-score revision:', err);
      // Don't throw - revision was created successfully
    }
  }

  return rowToRevision(revision as unknown as RevisionRow);
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

  return rowToRevision(data as unknown as RevisionRow);
}

/**
 * Get all revisions for a project
 */
export async function getRevisions(projectId: string): Promise<Revision[]> {
  const data = await prisma.revision.findMany({
    where: { projectId },
    orderBy: { versionNumber: 'desc' },
  });

  return (data || []).map((row) => rowToRevision(row as unknown as RevisionRow));
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

  return rowToRevision(data as unknown as RevisionRow);
}

// =============================================================================
// Timeline
// =============================================================================

/**
 * Get revision timeline for a project
 */
export async function getRevisionTimeline(projectId: string): Promise<RevisionTimeline> {
  // Get timeline entries
  const timelineData = await prisma.$queryRaw<Array<{
    id: string;
    version_number: number;
    label: string | null;
    word_count: number;
    page_count: number;
    overall_score: number | null;
    changes_summary: RevisionChanges | null;
    created_at: string;
  }>>`
    SELECT * FROM get_revision_timeline(${projectId}::uuid)
  `;

  const entries: RevisionTimelineEntry[] = (timelineData || []).map((row) => ({
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
    const dataPoints = trajectoryData.map((row) => ({
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

    return rowToRevision(data as unknown as RevisionRow);
  } catch (err) {
    throw new Error(`Failed to update revision: ${err instanceof Error ? err.message : String(err)}`);
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
  } catch (err) {
    throw new Error(`Failed to delete revision: ${err instanceof Error ? err.message : String(err)}`);
  }
}
