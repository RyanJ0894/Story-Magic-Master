/**
 * Revision Tracking Service
 *
 * Handles creating, retrieving, and comparing script revisions.
 */

import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();

  // Get the next version number
  const { data: versionData, error: versionError } = await supabase
    .rpc('get_next_version_number', { p_project_id: projectId });

  if (versionError) {
    throw new Error(`Failed to get version number: ${versionError.message}`);
  }

  const versionNumber = versionData as number;

  // Calculate text metrics
  const wordCount = calculateWordCount(scriptText);
  const pageCount = calculatePageCount(scriptText);

  // Get previous revision for change calculation
  let changesSummary: RevisionChanges | null = null;
  if (versionNumber > 1) {
    const { data: prevRevision } = await supabase
      .from('revisions')
      .select('script_text, overall_score')
      .eq('project_id', projectId)
      .eq('version_number', versionNumber - 1)
      .single();

    if (prevRevision) {
      changesSummary = calculateChanges(prevRevision.script_text, scriptText);
    }
  }

  // Insert the revision
  const { data: revision, error } = await supabase
    .from('revisions')
    .insert({
      project_id: projectId,
      version_number: versionNumber,
      label: options?.label || null,
      script_text: scriptText,
      word_count: wordCount,
      page_count: pageCount,
      changes_summary: changesSummary,
      created_by: options?.userId || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create revision: ${error.message}`);
  }

  // Also update the project's script_text
  await supabase
    .from('projects')
    .update({
      script_text: scriptText,
      page_count: pageCount,
    })
    .eq('id', projectId);

  // Optionally generate a StoryScore for this revision
  if (options?.autoScore) {
    try {
      const score = await generateScore(projectId, scriptText);

      // Update revision with score
      await supabase
        .from('revisions')
        .update({
          score_id: score.id,
          overall_score: score.overallScore,
        })
        .eq('id', revision.id);

      revision.score_id = score.id;
      revision.overall_score = score.overallScore;

      // Update changes_summary with score change if previous had score
      if (changesSummary) {
        const { data: prevRevision } = await supabase
          .from('revisions')
          .select('overall_score')
          .eq('project_id', projectId)
          .eq('version_number', versionNumber - 1)
          .single();

        if (prevRevision?.overall_score) {
          changesSummary.scoreChange = score.overallScore - prevRevision.overall_score;
          await supabase
            .from('revisions')
            .update({ changes_summary: changesSummary })
            .eq('id', revision.id);
        }
      }
    } catch (err) {
      console.error('Failed to auto-score revision:', err);
      // Don't throw - revision was created successfully
    }
  }

  return rowToRevision(revision as RevisionRow);
}

// =============================================================================
// Get Revisions
// =============================================================================

/**
 * Get a single revision by ID
 */
export async function getRevision(revisionId: string): Promise<Revision | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('revisions')
    .select('*')
    .eq('id', revisionId)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToRevision(data as RevisionRow);
}

/**
 * Get all revisions for a project
 */
export async function getRevisions(projectId: string): Promise<Revision[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('revisions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch revisions: ${error.message}`);
  }

  return (data || []).map((row) => rowToRevision(row as RevisionRow));
}

/**
 * Get the latest revision for a project
 */
export async function getLatestRevision(projectId: string): Promise<Revision | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('revisions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToRevision(data as RevisionRow);
}

// =============================================================================
// Timeline
// =============================================================================

/**
 * Get revision timeline for a project
 */
export async function getRevisionTimeline(projectId: string): Promise<RevisionTimeline> {
  const supabase = await createClient();

  // Get timeline entries
  const { data: timelineData, error } = await supabase
    .rpc('get_revision_timeline', { p_project_id: projectId });

  if (error) {
    throw new Error(`Failed to fetch timeline: ${error.message}`);
  }

  const entries: RevisionTimelineEntry[] = (timelineData || []).map((row: {
    id: string;
    version_number: number;
    label: string | null;
    word_count: number;
    page_count: number;
    overall_score: number | null;
    changes_summary: RevisionChanges | null;
    created_at: string;
  }) => ({
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
  const { data: trajectoryData } = await supabase
    .rpc('get_score_trajectory', { p_project_id: projectId });

  let scoreTrajectory: ScoreTrajectory | undefined;
  if (trajectoryData && trajectoryData.length > 0) {
    const dataPoints = trajectoryData.map((row: {
      revision_id: string;
      version_number: number;
      score: number;
      created_at: string;
    }) => ({
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('revisions')
    .update({ label })
    .eq('id', revisionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update revision: ${error.message}`);
  }

  return rowToRevision(data as RevisionRow);
}

// =============================================================================
// Delete Revision
// =============================================================================

/**
 * Delete a revision (cannot delete version 1)
 */
export async function deleteRevision(revisionId: string): Promise<void> {
  const supabase = await createClient();

  // Check if it's version 1
  const { data: revision } = await supabase
    .from('revisions')
    .select('version_number')
    .eq('id', revisionId)
    .single();

  if (revision?.version_number === 1) {
    throw new Error('Cannot delete the initial revision');
  }

  const { error } = await supabase
    .from('revisions')
    .delete()
    .eq('id', revisionId);

  if (error) {
    throw new Error(`Failed to delete revision: ${error.message}`);
  }
}
