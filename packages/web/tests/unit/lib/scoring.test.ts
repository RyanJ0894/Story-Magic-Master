import { describe, it, expect } from 'vitest';
import {
  DIMENSIONS,
  RATINGS,
  CATEGORIES,
  DimensionKey,
  DimensionScores,
  Rating,
  calculateOverallScore,
  calculateCategoryScore,
  calculateRating,
  rowToStoryScore,
  storyScoreToRow,
} from '@/lib/scoring/types';

describe('Scoring Types', () => {
  describe('DIMENSIONS', () => {
    it('should have 12 dimensions defined', () => {
      const dimensionKeys = Object.keys(DIMENSIONS);
      expect(dimensionKeys).toHaveLength(12);
    });

    it('should have all required dimension properties', () => {
      Object.values(DIMENSIONS).forEach((dim) => {
        expect(dim).toHaveProperty('key');
        expect(dim).toHaveProperty('dbKey');
        expect(dim).toHaveProperty('label');
        expect(dim).toHaveProperty('description');
        expect(dim).toHaveProperty('category');
        expect(dim).toHaveProperty('weight');
        expect(dim).toHaveProperty('maxScore');
      });
    });

    it('should have dimensions in each category', () => {
      const categories = new Set(Object.values(DIMENSIONS).map((d) => d.category));
      expect(categories).toContain('concept');
      expect(categories).toContain('structure');
      expect(categories).toContain('character');
      expect(categories).toContain('craft');
    });

    it('should have weights that sum to 100', () => {
      const totalWeight = Object.values(DIMENSIONS).reduce((sum, d) => sum + d.weight, 0);
      expect(totalWeight).toBe(100);
    });
  });

  describe('RATINGS', () => {
    it('should have all 6 rating levels', () => {
      expect(RATINGS).toHaveProperty('STRONG_RECOMMEND');
      expect(RATINGS).toHaveProperty('RECOMMEND');
      expect(RATINGS).toHaveProperty('CONSIDER');
      expect(RATINGS).toHaveProperty('CONSIDER_WITH_RESERVATIONS');
      expect(RATINGS).toHaveProperty('PASS');
      expect(RATINGS).toHaveProperty('STRONG_PASS');
    });

    it('should have correct thresholds on 1-10 scale', () => {
      expect(RATINGS.STRONG_RECOMMEND.minScore).toBe(9.0);
      expect(RATINGS.RECOMMEND.minScore).toBe(8.0);
      expect(RATINGS.CONSIDER.minScore).toBe(7.0);
      expect(RATINGS.CONSIDER_WITH_RESERVATIONS.minScore).toBe(5.5);
      expect(RATINGS.PASS.minScore).toBe(3.0);
      expect(RATINGS.STRONG_PASS.minScore).toBe(1.0);
    });
  });

  describe('CATEGORIES', () => {
    it('should have 4 categories defined', () => {
      expect(Object.keys(CATEGORIES)).toHaveLength(4);
    });

    it('should map to correct dimensions', () => {
      expect(CATEGORIES.concept.dimensions).toContain('premiseOriginality');
      expect(CATEGORIES.structure.dimensions).toContain('threeActIntegrity');
      expect(CATEGORIES.character.dimensions).toContain('protagonistArc');
      expect(CATEGORIES.craft.dimensions).toContain('dialogueQuality');
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate weighted average correctly', () => {
      const dimensions: DimensionScores = {
        premiseOriginality: { score: 8, reasoning: 'test' },
        loglineClarity: { score: 8, reasoning: 'test' },
        commercialViability: { score: 8, reasoning: 'test' },
        threeActIntegrity: { score: 8, reasoning: 'test' },
        pacingMomentum: { score: 8, reasoning: 'test' },
        stakesEscalation: { score: 8, reasoning: 'test' },
        protagonistArc: { score: 8, reasoning: 'test' },
        supportingCast: { score: 8, reasoning: 'test' },
        castability: { score: 8, reasoning: 'test' },
        dialogueQuality: { score: 8, reasoning: 'test' },
        visualStorytelling: { score: 8, reasoning: 'test' },
        technicalExecution: { score: 8, reasoning: 'test' },
      };

      const score = calculateOverallScore(dimensions);
      expect(score).toBe(8);
    });

    it('should handle mixed scores correctly', () => {
      const dimensions: DimensionScores = {
        premiseOriginality: { score: 10, reasoning: 'test' },
        loglineClarity: { score: 10, reasoning: 'test' },
        commercialViability: { score: 10, reasoning: 'test' },
        threeActIntegrity: { score: 5, reasoning: 'test' },
        pacingMomentum: { score: 5, reasoning: 'test' },
        stakesEscalation: { score: 5, reasoning: 'test' },
        protagonistArc: { score: 5, reasoning: 'test' },
        supportingCast: { score: 5, reasoning: 'test' },
        castability: { score: 5, reasoning: 'test' },
        dialogueQuality: { score: 5, reasoning: 'test' },
        visualStorytelling: { score: 5, reasoning: 'test' },
        technicalExecution: { score: 5, reasoning: 'test' },
      };

      const score = calculateOverallScore(dimensions);
      expect(score).toBeGreaterThan(5);
      expect(score).toBeLessThan(10);
    });
  });

  describe('calculateCategoryScore', () => {
    const dimensions: DimensionScores = {
      premiseOriginality: { score: 9, reasoning: 'test' },
      loglineClarity: { score: 8, reasoning: 'test' },
      commercialViability: { score: 7, reasoning: 'test' },
      threeActIntegrity: { score: 6, reasoning: 'test' },
      pacingMomentum: { score: 6, reasoning: 'test' },
      stakesEscalation: { score: 6, reasoning: 'test' },
      protagonistArc: { score: 5, reasoning: 'test' },
      supportingCast: { score: 5, reasoning: 'test' },
      castability: { score: 5, reasoning: 'test' },
      dialogueQuality: { score: 4, reasoning: 'test' },
      visualStorytelling: { score: 4, reasoning: 'test' },
      technicalExecution: { score: 4, reasoning: 'test' },
    };

    it('should calculate concept category score', () => {
      const score = calculateCategoryScore(dimensions, 'concept');
      // Weighted average of premiseOriginality (w:10), loglineClarity (w:8), commercialViability (w:7)
      expect(score).toBeGreaterThan(7);
      expect(score).toBeLessThan(9);
    });

    it('should calculate structure category score', () => {
      const score = calculateCategoryScore(dimensions, 'structure');
      expect(score).toBe(6); // All structure dimensions are 6
    });

    it('should calculate character category score', () => {
      const score = calculateCategoryScore(dimensions, 'character');
      expect(score).toBe(5); // All character dimensions are 5
    });

    it('should calculate craft category score', () => {
      const score = calculateCategoryScore(dimensions, 'craft');
      expect(score).toBe(4); // All craft dimensions are 4
    });
  });

  describe('calculateRating', () => {
    it('should return STRONG_RECOMMEND for scores >= 9.0', () => {
      expect(calculateRating(9.0)).toBe('STRONG_RECOMMEND');
      expect(calculateRating(9.5)).toBe('STRONG_RECOMMEND');
      expect(calculateRating(10.0)).toBe('STRONG_RECOMMEND');
    });

    it('should return RECOMMEND for scores 8.0-8.9', () => {
      expect(calculateRating(8.0)).toBe('RECOMMEND');
      expect(calculateRating(8.5)).toBe('RECOMMEND');
      expect(calculateRating(8.9)).toBe('RECOMMEND');
    });

    it('should return CONSIDER for scores 7.0-7.9', () => {
      expect(calculateRating(7.0)).toBe('CONSIDER');
      expect(calculateRating(7.5)).toBe('CONSIDER');
      expect(calculateRating(7.9)).toBe('CONSIDER');
    });

    it('should return CONSIDER_WITH_RESERVATIONS for scores 5.5-6.9', () => {
      expect(calculateRating(5.5)).toBe('CONSIDER_WITH_RESERVATIONS');
      expect(calculateRating(6.0)).toBe('CONSIDER_WITH_RESERVATIONS');
      expect(calculateRating(6.9)).toBe('CONSIDER_WITH_RESERVATIONS');
    });

    it('should return PASS for scores 3.0-5.4', () => {
      expect(calculateRating(3.0)).toBe('PASS');
      expect(calculateRating(4.0)).toBe('PASS');
      expect(calculateRating(5.4)).toBe('PASS');
    });

    it('should return STRONG_PASS for scores < 3.0', () => {
      expect(calculateRating(1.0)).toBe('STRONG_PASS');
      expect(calculateRating(2.0)).toBe('STRONG_PASS');
      expect(calculateRating(2.9)).toBe('STRONG_PASS');
    });
  });

  describe('rowToStoryScore', () => {
    it('should convert database row to StoryScore object', () => {
      const row = {
        id: 'score-123',
        project_id: 'project-456',
        version: 1,
        premise_originality: 8,
        premise_originality_reasoning: 'Good premise',
        logline_clarity: 7,
        logline_clarity_reasoning: 'Clear logline',
        commercial_viability: 9,
        commercial_viability_reasoning: 'High commercial potential',
        three_act_integrity: 6,
        three_act_integrity_reasoning: 'Needs work',
        pacing_momentum: 7,
        pacing_momentum_reasoning: 'Good pacing',
        stakes_escalation: 8,
        stakes_escalation_reasoning: 'Strong stakes',
        protagonist_arc: 9,
        protagonist_arc_reasoning: 'Compelling arc',
        supporting_cast: 7,
        supporting_cast_reasoning: 'Good supporting chars',
        castability: 6,
        castability_reasoning: 'Average castability',
        dialogue_quality: 8,
        dialogue_quality_reasoning: 'Strong dialogue',
        visual_storytelling: 7,
        visual_storytelling_reasoning: 'Good visuals',
        technical_execution: 9,
        technical_execution_reasoning: 'Excellent execution',
        concept_score: 8.0,
        structure_score: 7.0,
        character_score: 7.3,
        craft_score: 8.0,
        overall_score: 7.6,
        rating: 'CONSIDER' as Rating,
        strengths: ['Strong premise', 'Good dialogue'],
        weaknesses: ['Pacing issues'],
        confidence: 0.85,
        model_version: 'gpt-4-turbo',
        created_at: '2026-01-22T12:00:00Z',
      };

      const score = rowToStoryScore(row);

      expect(score.id).toBe('score-123');
      expect(score.projectId).toBe('project-456');
      expect(score.dimensions.premiseOriginality.score).toBe(8);
      expect(score.dimensions.premiseOriginality.reasoning).toBe('Good premise');
      expect(score.categoryScores.concept).toBe(8.0);
      expect(score.overallScore).toBe(7.6);
      expect(score.rating).toBe('CONSIDER');
      expect(score.strengths).toContain('Strong premise');
    });
  });

  describe('storyScoreToRow', () => {
    it('should convert StoryScore to database row format', () => {
      const score = {
        id: 'score-123',
        projectId: 'project-456',
        version: 1,
        dimensions: {
          premiseOriginality: { score: 8, reasoning: 'Good premise' },
          loglineClarity: { score: 7, reasoning: 'Clear logline' },
          commercialViability: { score: 9, reasoning: 'High commercial potential' },
          threeActIntegrity: { score: 6, reasoning: 'Needs work' },
          pacingMomentum: { score: 7, reasoning: 'Good pacing' },
          stakesEscalation: { score: 8, reasoning: 'Strong stakes' },
          protagonistArc: { score: 9, reasoning: 'Compelling arc' },
          supportingCast: { score: 7, reasoning: 'Good supporting chars' },
          castability: { score: 6, reasoning: 'Average castability' },
          dialogueQuality: { score: 8, reasoning: 'Strong dialogue' },
          visualStorytelling: { score: 7, reasoning: 'Good visuals' },
          technicalExecution: { score: 9, reasoning: 'Excellent execution' },
        },
        categoryScores: {
          concept: 8.0,
          structure: 7.0,
          character: 7.3,
          craft: 8.0,
        },
        overallScore: 7.6,
        rating: 'CONSIDER' as Rating,
        strengths: ['Strong premise'],
        weaknesses: ['Pacing issues'],
        confidence: 0.85,
        modelVersion: 'gpt-4-turbo',
        createdAt: '2026-01-22T12:00:00Z',
      };

      const row = storyScoreToRow(score);

      expect(row.project_id).toBe('project-456');
      expect(row.premise_originality).toBe(8);
      expect(row.premise_originality_reasoning).toBe('Good premise');
      expect(row.concept_score).toBe(8.0);
      expect(row.overall_score).toBe(7.6);
      expect(row.rating).toBe('CONSIDER');
    });
  });
});
