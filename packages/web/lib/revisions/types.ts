/**
 * Revision Tracking Type Definitions
 *
 * Tracks script versions and score trajectory over time.
 * Each revision captures the script state and associated StoryScore.
 */

// =============================================================================
// Core Revision Types
// =============================================================================

/**
 * A single revision (snapshot) of a script
 */
export interface Revision {
  id: string;
  projectId: string;

  // Version info
  versionNumber: number;
  label?: string; // User-provided label (e.g., "After feedback from John")

  // Content
  scriptText: string;
  wordCount: number;
  pageCount: number;

  // Associated score (optional - may not be scored yet)
  scoreId?: string;
  overallScore?: number;

  // Change summary from previous revision
  changesSummary?: RevisionChanges;

  // Metadata
  createdAt: string;
  createdBy?: string; // User ID or 'system' for auto-saves
}

/**
 * Summary of changes between revisions
 */
export interface RevisionChanges {
  // Text changes
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;

  // Score changes (if both revisions have scores)
  scoreChange?: number; // Delta from previous
  improvedDimensions?: string[];
  declinedDimensions?: string[];
}

/**
 * Comparison between two revisions
 */
export interface RevisionComparison {
  fromRevision: Revision;
  toRevision: Revision;

  // Diff details
  changes: RevisionChanges;

  // Line-by-line diff (for display)
  diff: DiffLine[];

  // Score comparison
  scoreComparison?: ScoreComparison;
}

/**
 * A single line in a diff
 */
export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  lineNumber: {
    from?: number;
    to?: number;
  };
  content: string;
  oldContent?: string; // For modified lines
}

/**
 * Comparison of scores between two revisions
 */
export interface ScoreComparison {
  fromScore: number;
  toScore: number;
  change: number;
  percentChange: number;

  // Per-dimension changes
  dimensions: Array<{
    key: string;
    label: string;
    fromScore: number;
    toScore: number;
    change: number;
  }>;
}

// =============================================================================
// Timeline Types
// =============================================================================

/**
 * Timeline of revisions for a project
 */
export interface RevisionTimeline {
  projectId: string;
  revisions: RevisionTimelineEntry[];

  // Stats
  totalRevisions: number;
  firstRevision: string; // Date
  latestRevision: string;

  // Score trajectory
  scoreTrajectory?: ScoreTrajectory;
}

/**
 * A single entry in the timeline (lightweight)
 */
export interface RevisionTimelineEntry {
  id: string;
  versionNumber: number;
  label?: string;

  // Summary stats
  wordCount: number;
  pageCount: number;
  overallScore?: number;

  // Changes from previous
  changesSummary?: {
    linesAdded: number;
    linesRemoved: number;
    scoreChange?: number;
  };

  createdAt: string;
}

/**
 * Score trajectory over revisions
 */
export interface ScoreTrajectory {
  dataPoints: Array<{
    revisionId: string;
    versionNumber: number;
    score: number;
    date: string;
  }>;

  // Overall trend
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  averageImprovement?: number; // Per revision
}

// =============================================================================
// Database Row Types
// =============================================================================

export interface RevisionRow {
  id: string;
  project_id: string;
  version_number: number;
  label: string | null;
  script_text: string;
  word_count: number;
  page_count: number;
  score_id: string | null;
  overall_score: number | null;
  changes_summary: RevisionChanges | null;
  created_at: string;
  created_by: string | null;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Request to create a new revision
 */
export interface CreateRevisionRequest {
  projectId: string;
  scriptText: string;
  label?: string;
  autoScore?: boolean; // Whether to generate a StoryScore for this revision
}

/**
 * Request to compare two revisions
 */
export interface CompareRevisionsRequest {
  fromRevisionId: string;
  toRevisionId: string;
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Convert database row to Revision object
 */
export function rowToRevision(row: RevisionRow): Revision {
  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    label: row.label || undefined,
    scriptText: row.script_text,
    wordCount: row.word_count,
    pageCount: row.page_count,
    scoreId: row.score_id || undefined,
    overallScore: row.overall_score || undefined,
    changesSummary: row.changes_summary || undefined,
    createdAt: row.created_at,
    createdBy: row.created_by || undefined,
  };
}

/**
 * Convert Revision to database row format
 */
export function revisionToRow(
  revision: Omit<Revision, 'id' | 'createdAt'>
): Omit<RevisionRow, 'id' | 'created_at'> {
  return {
    project_id: revision.projectId,
    version_number: revision.versionNumber,
    label: revision.label || null,
    script_text: revision.scriptText,
    word_count: revision.wordCount,
    page_count: revision.pageCount,
    score_id: revision.scoreId || null,
    overall_score: revision.overallScore || null,
    changes_summary: revision.changesSummary || null,
    created_by: revision.createdBy || null,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate word count from script text
 */
export function calculateWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Estimate page count from script (industry standard: ~250 words/page)
 */
export function calculatePageCount(text: string): number {
  const wordCount = calculateWordCount(text);
  return Math.ceil(wordCount / 250);
}

/**
 * Calculate basic diff between two texts
 */
export function calculateChanges(oldText: string, newText: string): RevisionChanges {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Simple line-based comparison
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of newLines) {
    if (!oldSet.has(line)) {
      linesAdded++;
    }
  }

  for (const line of oldLines) {
    if (!newSet.has(line)) {
      linesRemoved++;
    }
  }

  // Modified = min of added/removed that aren't pure additions/removals
  const linesModified = Math.min(linesAdded, linesRemoved);

  return {
    linesAdded: linesAdded - linesModified,
    linesRemoved: linesRemoved - linesModified,
    linesModified,
  };
}

/**
 * Generate line-by-line diff between two texts using LCS algorithm
 */
export function generateDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  let i = m;
  let j = n;
  const diffStack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Unchanged line
      diffStack.push({
        type: 'unchanged',
        content: oldLines[i - 1],
        lineNumber: { from: i, to: j },
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Added line
      diffStack.push({
        type: 'added',
        content: newLines[j - 1],
        lineNumber: { to: j },
      });
      j--;
    } else if (i > 0) {
      // Removed line
      diffStack.push({
        type: 'removed',
        content: oldLines[i - 1],
        lineNumber: { from: i },
      });
      i--;
    }
  }

  // Reverse to get correct order
  while (diffStack.length > 0) {
    result.push(diffStack.pop()!);
  }

  // Post-process to detect modifications (adjacent removed + added)
  const processed: DiffLine[] = [];
  for (let k = 0; k < result.length; k++) {
    const current = result[k];
    const next = result[k + 1];

    if (
      current.type === 'removed' &&
      next?.type === 'added' &&
      isSimilarLine(current.content, next.content)
    ) {
      // Convert to modified
      processed.push({
        type: 'modified',
        content: next.content,
        oldContent: current.content,
        lineNumber: { from: current.lineNumber.from, to: next.lineNumber.to },
      });
      k++; // Skip next line
    } else {
      processed.push(current);
    }
  }

  return processed;
}

/**
 * Check if two lines are similar enough to be considered a modification
 */
function isSimilarLine(line1: string, line2: string): boolean {
  if (!line1 || !line2) return false;

  // Calculate Levenshtein similarity
  const maxLen = Math.max(line1.length, line2.length);
  if (maxLen === 0) return true;

  const distance = levenshteinDistance(line1, line2);
  const similarity = 1 - distance / maxLen;

  // Consider similar if > 50% match
  return similarity > 0.5;
}

/**
 * Calculate Levenshtein edit distance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Determine score trajectory trend
 */
export function calculateTrend(
  dataPoints: ScoreTrajectory['dataPoints']
): ScoreTrajectory['trend'] {
  if (dataPoints.length < 2) return 'insufficient_data';

  // Calculate average change
  let totalChange = 0;
  for (let i = 1; i < dataPoints.length; i++) {
    totalChange += dataPoints[i].score - dataPoints[i - 1].score;
  }
  const avgChange = totalChange / (dataPoints.length - 1);

  if (avgChange > 2) return 'improving';
  if (avgChange < -2) return 'declining';
  return 'stable';
}
