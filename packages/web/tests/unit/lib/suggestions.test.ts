import { describe, it, expect } from 'vitest';
import {
  Suggestion,
  SuggestionCategory,
  SeverityLevel,
  SuggestionStatus,
  Rewrite,
  SUGGESTION_CATEGORIES,
  SEVERITY_LEVELS,
  SUGGESTION_STATUS,
  rowToSuggestion,
  suggestionToRow,
  rowToRewrite,
  sortSuggestions,
  groupByCategory,
  categoryFromDimension,
  calculateStats,
} from '@/lib/adviser/types';

describe('Adviser Types', () => {
  describe('SUGGESTION_CATEGORIES', () => {
    it('should have all 12 categories matching StoryScore dimensions', () => {
      expect(Object.keys(SUGGESTION_CATEGORIES)).toHaveLength(12);
    });

    it('should have correct properties for each category', () => {
      Object.values(SUGGESTION_CATEGORIES).forEach((cat) => {
        expect(cat).toHaveProperty('key');
        expect(cat).toHaveProperty('dimension');
        expect(cat).toHaveProperty('label');
        expect(cat).toHaveProperty('description');
        expect(cat).toHaveProperty('icon');
        expect(cat).toHaveProperty('color');
      });
    });

    it('should map to StoryScore dimensions', () => {
      expect(SUGGESTION_CATEGORIES.premise.dimension).toBe('premiseOriginality');
      expect(SUGGESTION_CATEGORIES.structure.dimension).toBe('threeActIntegrity');
      expect(SUGGESTION_CATEGORIES.dialogue.dimension).toBe('dialogueQuality');
    });
  });

  describe('SEVERITY_LEVELS', () => {
    it('should have all severity levels defined', () => {
      expect(SEVERITY_LEVELS).toHaveProperty('critical');
      expect(SEVERITY_LEVELS).toHaveProperty('important');
      expect(SEVERITY_LEVELS).toHaveProperty('minor');
    });

    it('should have correct properties for each severity', () => {
      Object.values(SEVERITY_LEVELS).forEach((config) => {
        expect(config).toHaveProperty('key');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('color');
        expect(config).toHaveProperty('priority');
      });
    });

    it('should have priorities in correct order', () => {
      expect(SEVERITY_LEVELS.critical.priority).toBe(1);
      expect(SEVERITY_LEVELS.important.priority).toBe(2);
      expect(SEVERITY_LEVELS.minor.priority).toBe(3);
    });
  });

  describe('SUGGESTION_STATUS', () => {
    it('should have all status levels defined', () => {
      expect(SUGGESTION_STATUS).toHaveProperty('pending');
      expect(SUGGESTION_STATUS).toHaveProperty('accepted');
      expect(SUGGESTION_STATUS).toHaveProperty('rejected');
      expect(SUGGESTION_STATUS).toHaveProperty('dismissed');
    });
  });

  describe('sortSuggestions', () => {
    it('should sort by severity priority first', () => {
      const suggestions: Suggestion[] = [
        createMockSuggestion({ severity: 'minor', startLine: 1 }),
        createMockSuggestion({ severity: 'critical', startLine: 2 }),
        createMockSuggestion({ severity: 'important', startLine: 3 }),
      ];

      const sorted = sortSuggestions(suggestions);

      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('important');
      expect(sorted[2].severity).toBe('minor');
    });

    it('should sort by line number within same severity', () => {
      const suggestions: Suggestion[] = [
        createMockSuggestion({ severity: 'critical', startLine: 30 }),
        createMockSuggestion({ severity: 'critical', startLine: 10 }),
        createMockSuggestion({ severity: 'critical', startLine: 20 }),
      ];

      const sorted = sortSuggestions(suggestions);

      expect(sorted[0].location.startLine).toBe(10);
      expect(sorted[1].location.startLine).toBe(20);
      expect(sorted[2].location.startLine).toBe(30);
    });
  });

  describe('groupByCategory', () => {
    it('should group suggestions by category', () => {
      const suggestions: Suggestion[] = [
        createMockSuggestion({ category: 'dialogue' }),
        createMockSuggestion({ category: 'dialogue' }),
        createMockSuggestion({ category: 'structure' }),
        createMockSuggestion({ category: 'premise' }),
      ];

      const groups = groupByCategory(suggestions);

      expect(groups.dialogue).toHaveLength(2);
      expect(groups.structure).toHaveLength(1);
      expect(groups.premise).toHaveLength(1);
      expect(groups.visual).toHaveLength(0);
    });
  });

  describe('categoryFromDimension', () => {
    it('should return correct category for dimension', () => {
      expect(categoryFromDimension('premiseOriginality')).toBe('premise');
      expect(categoryFromDimension('threeActIntegrity')).toBe('structure');
      expect(categoryFromDimension('dialogueQuality')).toBe('dialogue');
      expect(categoryFromDimension('protagonistArc')).toBe('protagonist');
    });
  });

  describe('calculateStats', () => {
    it('should calculate stats correctly', () => {
      const suggestions: Suggestion[] = [
        createMockSuggestion({ severity: 'critical', status: 'pending', category: 'dialogue' }),
        createMockSuggestion({ severity: 'critical', status: 'accepted', category: 'dialogue' }),
        createMockSuggestion({ severity: 'important', status: 'pending', category: 'structure' }),
        createMockSuggestion({ severity: 'minor', status: 'rejected', category: 'premise' }),
      ];

      const stats = calculateStats(suggestions);

      expect(stats.total).toBe(4);
      expect(stats.bySeverity.critical).toBe(2);
      expect(stats.bySeverity.important).toBe(1);
      expect(stats.bySeverity.minor).toBe(1);
      expect(stats.byStatus.pending).toBe(2);
      expect(stats.byStatus.accepted).toBe(1);
      expect(stats.byStatus.rejected).toBe(1);
      expect(stats.byCategory.dialogue).toBe(2);
    });
  });

  describe('rowToSuggestion', () => {
    it('should convert database row to Suggestion object', () => {
      const row = {
        id: 'sug-123',
        project_id: 'project-456',
        score_id: 'score-789',
        start_line: 10,
        end_line: 15,
        start_char: null,
        end_char: null,
        excerpt: 'Sample dialogue',
        scene_number: 1,
        scene_heading: 'INT. ROOM - DAY',
        category: 'dialogue' as SuggestionCategory,
        severity: 'important' as SeverityLevel,
        title: 'Add subtext',
        explanation: 'The dialogue is too on-the-nose',
        suggestion: 'Add subtext through action',
        status: 'pending' as SuggestionStatus,
        user_feedback: null,
        confidence: 0.85,
        created_at: '2026-01-22T12:00:00Z',
        responded_at: null,
      };

      const suggestion = rowToSuggestion(row);

      expect(suggestion.id).toBe('sug-123');
      expect(suggestion.projectId).toBe('project-456');
      expect(suggestion.scoreId).toBe('score-789');
      expect(suggestion.location.startLine).toBe(10);
      expect(suggestion.location.endLine).toBe(15);
      expect(suggestion.location.excerpt).toBe('Sample dialogue');
      expect(suggestion.category).toBe('dialogue');
      expect(suggestion.severity).toBe('important');
      expect(suggestion.status).toBe('pending');
    });
  });

  describe('suggestionToRow', () => {
    it('should convert Suggestion to database row format', () => {
      const suggestion: Omit<Suggestion, 'id' | 'createdAt'> = {
        projectId: 'project-456',
        scoreId: 'score-789',
        location: {
          startLine: 10,
          endLine: 15,
          excerpt: 'Sample dialogue',
          sceneNumber: 1,
          sceneHeading: 'INT. ROOM - DAY',
        },
        category: 'dialogue',
        severity: 'important',
        title: 'Add subtext',
        explanation: 'The dialogue is too on-the-nose',
        suggestion: 'Add subtext through action',
        status: 'pending',
        confidence: 0.85,
      };

      const row = suggestionToRow(suggestion);

      expect(row.project_id).toBe('project-456');
      expect(row.score_id).toBe('score-789');
      expect(row.start_line).toBe(10);
      expect(row.end_line).toBe(15);
      expect(row.category).toBe('dialogue');
      expect(row.severity).toBe('important');
    });
  });

  describe('rowToRewrite', () => {
    it('should convert database row to Rewrite object', () => {
      const row = {
        id: 'rew-123',
        suggestion_id: 'sug-456',
        original_text: 'Original dialogue',
        rewritten_text: 'Improved dialogue',
        explanation: 'Added subtext',
        style: 'moderate',
        selected: true,
        created_at: '2026-01-22T12:00:00Z',
      };

      const rewrite = rowToRewrite(row);

      expect(rewrite.id).toBe('rew-123');
      expect(rewrite.suggestionId).toBe('sug-456');
      expect(rewrite.originalText).toBe('Original dialogue');
      expect(rewrite.rewrittenText).toBe('Improved dialogue');
      expect(rewrite.style).toBe('moderate');
      expect(rewrite.selected).toBe(true);
      expect(rewrite.isSelected).toBe(true); // Alias
    });
  });

  describe('Suggestion interface', () => {
    it('should create valid suggestion objects', () => {
      const suggestion = createMockSuggestion({
        category: 'dialogue',
        severity: 'important',
        status: 'pending',
      });

      expect(suggestion.id).toBeDefined();
      expect(suggestion.category).toBe('dialogue');
      expect(suggestion.severity).toBe('important');
      expect(suggestion.status).toBe('pending');
    });
  });
});

// Helper function to create mock suggestions
function createMockSuggestion(overrides: Partial<{
  category: SuggestionCategory;
  severity: SeverityLevel;
  status: SuggestionStatus;
  startLine: number;
}>): Suggestion {
  return {
    id: `sug-${Math.random().toString(36).substring(7)}`,
    projectId: 'project-123',
    location: {
      startLine: overrides.startLine ?? 10,
      endLine: (overrides.startLine ?? 10) + 5,
      excerpt: 'Sample text',
    },
    category: overrides.category ?? 'dialogue',
    severity: overrides.severity ?? 'important',
    title: 'Test Suggestion',
    explanation: 'Test explanation',
    suggestion: 'Test suggestion text',
    status: overrides.status ?? 'pending',
    confidence: 0.85,
    createdAt: new Date().toISOString(),
  };
}
