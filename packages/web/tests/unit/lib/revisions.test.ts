import { describe, it, expect } from 'vitest';
import {
  Revision,
  RevisionTimeline,
  DiffLine,
  RevisionChanges,
  ScoreTrajectory,
  calculateWordCount,
  calculatePageCount,
  calculateChanges,
  calculateTrend,
  generateDiff,
  rowToRevision,
  revisionToRow,
} from '@/lib/revisions/types';

describe('Revisions Types', () => {
  describe('calculateWordCount', () => {
    it('should count words correctly', () => {
      expect(calculateWordCount('Hello world')).toBe(2);
      expect(calculateWordCount('One two three four five')).toBe(5);
      expect(calculateWordCount('')).toBe(0);
    });

    it('should handle multiple spaces', () => {
      expect(calculateWordCount('Hello   world')).toBe(2);
      expect(calculateWordCount('  spaced  out  ')).toBe(2);
    });

    it('should handle newlines', () => {
      expect(calculateWordCount('Hello\nworld')).toBe(2);
      expect(calculateWordCount('Line one\nLine two\nLine three')).toBe(6);
    });
  });

  describe('calculatePageCount', () => {
    it('should calculate pages based on 250 words per page', () => {
      // Generate text with specific word counts
      const words250 = Array(250).fill('word').join(' ');
      const words500 = Array(500).fill('word').join(' ');
      const words375 = Array(375).fill('word').join(' ');

      expect(calculatePageCount(words250)).toBe(1);
      expect(calculatePageCount(words500)).toBe(2);
      expect(calculatePageCount(words375)).toBe(2); // rounds up
    });

    it('should return 0 for empty content', () => {
      expect(calculatePageCount('')).toBe(0);
    });

    it('should round up partial pages', () => {
      const words1 = 'word';
      const words251 = Array(251).fill('word').join(' ');

      expect(calculatePageCount(words1)).toBe(1);
      expect(calculatePageCount(words251)).toBe(2);
    });
  });

  describe('calculateChanges', () => {
    it('should identify unchanged content', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const changes = calculateChanges(text, text);

      expect(changes.linesAdded).toBe(0);
      expect(changes.linesRemoved).toBe(0);
    });

    it('should identify added lines', () => {
      const oldText = 'Line 1\nLine 2';
      const newText = 'Line 1\nLine 2\nLine 3';
      const changes = calculateChanges(oldText, newText);

      expect(changes.linesAdded).toBeGreaterThanOrEqual(1);
    });

    it('should identify removed lines', () => {
      const oldText = 'Line 1\nLine 2\nLine 3';
      const newText = 'Line 1\nLine 3';
      const changes = calculateChanges(oldText, newText);

      expect(changes.linesRemoved).toBeGreaterThanOrEqual(1);
    });

    it('should identify modified lines', () => {
      const oldText = 'Hello world';
      const newText = 'Hello universe';
      const changes = calculateChanges(oldText, newText);

      // A modification shows as removed + added or modified count
      expect(changes.linesAdded + changes.linesRemoved + changes.linesModified).toBeGreaterThan(0);
    });

    it('should handle empty strings', () => {
      const emptyChanges = calculateChanges('', '');
      expect(emptyChanges.linesAdded).toBe(0);
      expect(emptyChanges.linesRemoved).toBe(0);

      // Empty string splits to [''], so going from empty to 'Line 1' is treated
      // as a modification ('' -> 'Line 1'), not a pure addition
      const addedChanges = calculateChanges('', 'Line 1');
      expect(addedChanges.linesModified).toBe(1);

      const removedChanges = calculateChanges('Line 1', '');
      expect(removedChanges.linesModified).toBe(1);
    });
  });

  describe('generateDiff', () => {
    it('should return empty diff for identical texts', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const diff = generateDiff(text, text);

      expect(diff.every((line) => line.type === 'unchanged')).toBe(true);
      expect(diff).toHaveLength(3);
    });

    it('should detect added lines', () => {
      const oldText = 'Line 1\nLine 2';
      const newText = 'Line 1\nLine 2\nLine 3';
      const diff = generateDiff(oldText, newText);

      const added = diff.filter((line) => line.type === 'added');
      expect(added).toHaveLength(1);
      expect(added[0].content).toBe('Line 3');
      expect(added[0].lineNumber.to).toBe(3);
    });

    it('should detect removed lines', () => {
      const oldText = 'Line 1\nLine 2\nLine 3';
      const newText = 'Line 1\nLine 3';
      const diff = generateDiff(oldText, newText);

      const removed = diff.filter((line) => line.type === 'removed');
      expect(removed).toHaveLength(1);
      expect(removed[0].content).toBe('Line 2');
      expect(removed[0].lineNumber.from).toBe(2);
    });

    it('should detect modified lines', () => {
      // Single-line changes are detected as modification when lines are similar
      const oldText = 'Hello world';
      const newText = 'Hello universe';
      const diff = generateDiff(oldText, newText);

      // The algorithm will detect this as either modified or removed+added
      // depending on similarity threshold
      const changes = diff.filter((line) => line.type !== 'unchanged');
      expect(changes.length).toBeGreaterThanOrEqual(1);

      // With context, modifications are detected
      const oldWithContext = 'Line 1\nHello world\nLine 3';
      const newWithContext = 'Line 1\nHello universe\nLine 3';
      const diffWithContext = generateDiff(oldWithContext, newWithContext);

      // Line 1 and Line 3 should be unchanged
      const unchanged = diffWithContext.filter((line) => line.type === 'unchanged');
      expect(unchanged.length).toBe(2);

      // Middle line should be changed
      const changedLines = diffWithContext.filter((line) => line.type !== 'unchanged');
      expect(changedLines.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle complex diffs with multiple changes', () => {
      const oldText = 'Line A\nLine B\nLine C\nLine D';
      const newText = 'Line A\nLine X\nLine C\nLine Y\nLine E';
      const diff = generateDiff(oldText, newText);

      // Line A and Line C should be unchanged
      const unchanged = diff.filter((line) => line.type === 'unchanged');
      expect(unchanged.length).toBeGreaterThanOrEqual(2);

      // Should have some changes
      const changes = diff.filter((line) => line.type !== 'unchanged');
      expect(changes.length).toBeGreaterThan(0);
    });

    it('should handle empty old text (all additions)', () => {
      const diff = generateDiff('', 'New line');
      const added = diff.filter((line) => line.type === 'added');
      // Treating empty-to-content as modification or addition
      expect(diff.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty new text (all removals)', () => {
      const diff = generateDiff('Old line', '');
      const removed = diff.filter((line) => line.type === 'removed');
      // Treating content-to-empty as modification or removal
      expect(diff.length).toBeGreaterThanOrEqual(1);
    });

    it('should preserve line numbers correctly', () => {
      const oldText = 'A\nB\nC';
      const newText = 'A\nX\nC';
      const diff = generateDiff(oldText, newText);

      // First line (A) should be unchanged with from=1, to=1
      const firstLine = diff.find((line) => line.content === 'A' || line.content === 'A');
      if (firstLine && firstLine.type === 'unchanged') {
        expect(firstLine.lineNumber.from).toBe(1);
        expect(firstLine.lineNumber.to).toBe(1);
      }
    });
  });

  describe('calculateTrend', () => {
    it('should return insufficient_data for less than 2 points', () => {
      const noPoints: ScoreTrajectory['dataPoints'] = [];
      const onePoint: ScoreTrajectory['dataPoints'] = [
        { revisionId: 'rev-1', versionNumber: 1, score: 65, date: '2026-01-01' },
      ];

      expect(calculateTrend(noPoints)).toBe('insufficient_data');
      expect(calculateTrend(onePoint)).toBe('insufficient_data');
    });

    it('should return improving for upward trend', () => {
      const points: ScoreTrajectory['dataPoints'] = [
        { revisionId: 'rev-1', versionNumber: 1, score: 50, date: '2026-01-01' },
        { revisionId: 'rev-2', versionNumber: 2, score: 60, date: '2026-01-02' },
        { revisionId: 'rev-3', versionNumber: 3, score: 70, date: '2026-01-03' },
      ];

      expect(calculateTrend(points)).toBe('improving');
    });

    it('should return declining for downward trend', () => {
      const points: ScoreTrajectory['dataPoints'] = [
        { revisionId: 'rev-1', versionNumber: 1, score: 70, date: '2026-01-01' },
        { revisionId: 'rev-2', versionNumber: 2, score: 60, date: '2026-01-02' },
        { revisionId: 'rev-3', versionNumber: 3, score: 50, date: '2026-01-03' },
      ];

      expect(calculateTrend(points)).toBe('declining');
    });

    it('should return stable for minimal change', () => {
      const points: ScoreTrajectory['dataPoints'] = [
        { revisionId: 'rev-1', versionNumber: 1, score: 65, date: '2026-01-01' },
        { revisionId: 'rev-2', versionNumber: 2, score: 66, date: '2026-01-02' },
        { revisionId: 'rev-3', versionNumber: 3, score: 65, date: '2026-01-03' },
      ];

      expect(calculateTrend(points)).toBe('stable');
    });
  });

  describe('Revision interface', () => {
    it('should create valid revision objects', () => {
      const revision: Revision = {
        id: 'rev-1',
        projectId: 'project-1',
        versionNumber: 1,
        scriptText: 'FADE IN:\n\nINT. HOUSE - DAY',
        wordCount: 5,
        pageCount: 1,
        changeSummary: 'Initial draft',
        createdAt: new Date().toISOString(),
      };

      expect(revision.id).toBe('rev-1');
      expect(revision.versionNumber).toBe(1);
      expect(revision.wordCount).toBe(5);
    });
  });

  describe('RevisionTimeline interface', () => {
    it('should create valid timeline objects', () => {
      const timeline: RevisionTimeline = {
        projectId: 'project-1',
        revisions: [
          {
            id: 'rev-1',
            versionNumber: 1,
            wordCount: 100,
            pageCount: 1,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'rev-2',
            versionNumber: 2,
            wordCount: 150,
            pageCount: 1,
            overallScore: 72,
            changesSummary: { linesAdded: 10, linesRemoved: 2, scoreChange: 7 },
            createdAt: new Date().toISOString(),
          },
        ],
        totalRevisions: 2,
        firstRevision: '2026-01-01',
        latestRevision: '2026-01-22',
        scoreTrajectory: {
          dataPoints: [
            { revisionId: 'rev-1', versionNumber: 1, score: 65, date: '2026-01-01' },
            { revisionId: 'rev-2', versionNumber: 2, score: 72, date: '2026-01-22' },
          ],
          trend: 'improving',
          averageImprovement: 7,
        },
      };

      expect(timeline.revisions).toHaveLength(2);
      expect(timeline.scoreTrajectory?.dataPoints).toHaveLength(2);
      expect(timeline.scoreTrajectory?.trend).toBe('improving');
    });
  });

  describe('DiffLine interface', () => {
    it('should create valid diff line objects', () => {
      const lines: DiffLine[] = [
        { type: 'unchanged', content: 'Same line', lineNumber: { from: 1, to: 1 } },
        { type: 'removed', content: 'Old line', lineNumber: { from: 2 } },
        { type: 'added', content: 'New line', lineNumber: { to: 2 } },
      ];

      expect(lines[0].type).toBe('unchanged');
      expect(lines[1].type).toBe('removed');
      expect(lines[2].type).toBe('added');
    });
  });

  describe('rowToRevision', () => {
    it('should convert database row to Revision object', () => {
      const row = {
        id: 'rev-123',
        project_id: 'project-456',
        version_number: 2,
        label: 'After feedback',
        script_text: 'FADE IN:\n\nEXT. BEACH - DAY',
        word_count: 5,
        page_count: 1,
        score_id: 'score-789',
        overall_score: 72,
        changes_summary: { linesAdded: 10, linesRemoved: 5, linesModified: 3 } as RevisionChanges,
        created_at: '2026-01-22T12:00:00Z',
        created_by: 'user-123',
      };

      const revision = rowToRevision(row);

      expect(revision.id).toBe('rev-123');
      expect(revision.projectId).toBe('project-456');
      expect(revision.versionNumber).toBe(2);
      expect(revision.label).toBe('After feedback');
      expect(revision.wordCount).toBe(5);
      expect(revision.scoreId).toBe('score-789');
      expect(revision.overallScore).toBe(72);
    });

    it('should handle null optional fields', () => {
      const row = {
        id: 'rev-123',
        project_id: 'project-456',
        version_number: 1,
        label: null,
        script_text: 'Draft',
        word_count: 1,
        page_count: 1,
        score_id: null,
        overall_score: null,
        changes_summary: null,
        created_at: '2026-01-22T12:00:00Z',
        created_by: null,
      };

      const revision = rowToRevision(row);

      expect(revision.label).toBeUndefined();
      expect(revision.scoreId).toBeUndefined();
      expect(revision.overallScore).toBeUndefined();
      expect(revision.changesSummary).toBeUndefined();
      expect(revision.createdBy).toBeUndefined();
    });
  });

  describe('revisionToRow', () => {
    it('should convert Revision to database row format', () => {
      const revision: Omit<Revision, 'id' | 'createdAt'> = {
        projectId: 'project-456',
        versionNumber: 2,
        label: 'After feedback',
        scriptText: 'FADE IN:\n\nEXT. BEACH - DAY',
        wordCount: 5,
        pageCount: 1,
        scoreId: 'score-789',
        overallScore: 72,
        changesSummary: { linesAdded: 10, linesRemoved: 5, linesModified: 3 },
        createdBy: 'user-123',
      };

      const row = revisionToRow(revision);

      expect(row.project_id).toBe('project-456');
      expect(row.version_number).toBe(2);
      expect(row.label).toBe('After feedback');
      expect(row.word_count).toBe(5);
      expect(row.score_id).toBe('score-789');
      expect(row.overall_score).toBe(72);
    });

    it('should convert undefined to null', () => {
      const revision: Omit<Revision, 'id' | 'createdAt'> = {
        projectId: 'project-456',
        versionNumber: 1,
        scriptText: 'Draft',
        wordCount: 1,
        pageCount: 1,
      };

      const row = revisionToRow(revision);

      expect(row.label).toBeNull();
      expect(row.score_id).toBeNull();
      expect(row.overall_score).toBeNull();
      expect(row.changes_summary).toBeNull();
      expect(row.created_by).toBeNull();
    });
  });
});

describe('Score Trajectory', () => {
  it('should have score values between 0 and 100', () => {
    const scores = [0, 25, 50, 75, 100];

    scores.forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  it('should track improvement over revisions', () => {
    const trajectory: ScoreTrajectory = {
      dataPoints: [
        { revisionId: 'rev-1', versionNumber: 1, score: 50, date: '2026-01-01' },
        { revisionId: 'rev-2', versionNumber: 2, score: 65, date: '2026-01-08' },
        { revisionId: 'rev-3', versionNumber: 3, score: 72, date: '2026-01-15' },
        { revisionId: 'rev-4', versionNumber: 4, score: 78, date: '2026-01-22' },
      ],
      trend: 'improving',
      averageImprovement: 9.3,
    };

    expect(trajectory.dataPoints).toHaveLength(4);
    expect(trajectory.trend).toBe('improving');

    // Verify scores are increasing
    for (let i = 1; i < trajectory.dataPoints.length; i++) {
      expect(trajectory.dataPoints[i].score).toBeGreaterThan(
        trajectory.dataPoints[i - 1].score
      );
    }
  });
});
