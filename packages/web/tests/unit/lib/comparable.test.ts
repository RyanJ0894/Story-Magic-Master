import { describe, it, expect } from 'vitest';
import {
  ComparableScript,
  ProductionStatus,
  BudgetTier,
  ComparableDisplay,
  getMatchLabel,
  getStatusBadge,
  toComparableDisplay,
  formatBudgetTier,
  formatBoxOffice,
} from '@/lib/comparable/types';

describe('Comparable Types', () => {
  describe('ProductionStatus', () => {
    it('should have all valid statuses', () => {
      const statuses: ProductionStatus[] = ['sold', 'produced', 'optioned', 'unproduced'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('BudgetTier', () => {
    it('should have all valid tiers', () => {
      const tiers: BudgetTier[] = ['micro', 'indie', 'mid', 'tentpole'];
      expect(tiers).toHaveLength(4);
    });
  });

  describe('getMatchLabel', () => {
    it('should return Strong Match for similarity >= 0.85', () => {
      expect(getMatchLabel(0.85)).toBe('Strong Match');
      expect(getMatchLabel(0.90)).toBe('Strong Match');
      expect(getMatchLabel(1.0)).toBe('Strong Match');
    });

    it('should return Good Match for similarity 0.75-0.84', () => {
      expect(getMatchLabel(0.75)).toBe('Good Match');
      expect(getMatchLabel(0.80)).toBe('Good Match');
      expect(getMatchLabel(0.84)).toBe('Good Match');
    });

    it('should return Related for similarity 0.65-0.74', () => {
      expect(getMatchLabel(0.65)).toBe('Related');
      expect(getMatchLabel(0.70)).toBe('Related');
      expect(getMatchLabel(0.74)).toBe('Related');
    });

    it('should return Weak Match for similarity < 0.65', () => {
      expect(getMatchLabel(0.64)).toBe('Weak Match');
      expect(getMatchLabel(0.50)).toBe('Weak Match');
      expect(getMatchLabel(0.0)).toBe('Weak Match');
    });
  });

  describe('getStatusBadge', () => {
    it('should return correct badge for produced', () => {
      const badge = getStatusBadge('produced');
      expect(badge.label).toBe('Produced');
      expect(badge.color).toBe('green');
    });

    it('should return correct badge for sold', () => {
      const badge = getStatusBadge('sold');
      expect(badge.label).toBe('Sold');
      expect(badge.color).toBe('blue');
    });

    it('should return correct badge for optioned', () => {
      const badge = getStatusBadge('optioned');
      expect(badge.label).toBe('Optioned');
      expect(badge.color).toBe('yellow');
    });

    it('should return correct badge for null/unproduced', () => {
      const badge = getStatusBadge(null);
      expect(badge.label).toBe('Unproduced');
      expect(badge.color).toBe('gray');
    });
  });

  describe('toComparableDisplay', () => {
    it('should convert ComparableScript to ComparableDisplay', () => {
      const script: ComparableScript = {
        id: 'script-1',
        title: 'Test Script',
        logline: 'A test logline',
        genre: ['Drama', 'Thriller'],
        tone: 'Dark',
        productionStatus: 'produced',
        studio: 'Test Studio',
        budgetTier: 'mid',
        boxOfficeMillions: 150,
        similarity: 0.82,
      };

      const display = toComparableDisplay(script);

      expect(display.matchLabel).toBe('Good Match');
      expect(display.statusBadge.label).toBe('Produced');
      expect(display.statusBadge.color).toBe('green');
      expect(display.relevancePercent).toBe(82);
    });

    it('should preserve all original properties', () => {
      const script: ComparableScript = {
        id: 'script-1',
        title: 'Original Title',
        logline: 'Original logline',
        genre: ['Comedy'],
        tone: 'Light',
        productionStatus: 'sold',
        studio: 'Comedy Studio',
        budgetTier: 'indie',
        boxOfficeMillions: 50,
        similarity: 0.90,
      };

      const display = toComparableDisplay(script);

      expect(display.id).toBe(script.id);
      expect(display.title).toBe(script.title);
      expect(display.logline).toBe(script.logline);
      expect(display.genre).toEqual(script.genre);
      expect(display.tone).toBe(script.tone);
      expect(display.productionStatus).toBe(script.productionStatus);
      expect(display.studio).toBe(script.studio);
      expect(display.budgetTier).toBe(script.budgetTier);
      expect(display.boxOfficeMillions).toBe(script.boxOfficeMillions);
      expect(display.similarity).toBe(script.similarity);
    });
  });

  describe('formatBudgetTier', () => {
    it('should format micro budget correctly', () => {
      expect(formatBudgetTier('micro')).toBe('Micro Budget (<$1M)');
    });

    it('should format indie budget correctly', () => {
      expect(formatBudgetTier('indie')).toBe('Independent ($1-15M)');
    });

    it('should format mid budget correctly', () => {
      expect(formatBudgetTier('mid')).toBe('Mid-Budget ($15-80M)');
    });

    it('should format tentpole budget correctly', () => {
      expect(formatBudgetTier('tentpole')).toBe('Tentpole ($80M+)');
    });

    it('should handle null correctly', () => {
      expect(formatBudgetTier(null)).toBe('Unknown');
    });
  });

  describe('formatBoxOffice', () => {
    it('should format millions correctly', () => {
      expect(formatBoxOffice(100)).toBe('$100M');
      expect(formatBoxOffice(500)).toBe('$500M');
      expect(formatBoxOffice(50.5)).toBe('$50.5M');
    });

    it('should format billions correctly', () => {
      expect(formatBoxOffice(1000)).toBe('$1.0B');
      expect(formatBoxOffice(2500)).toBe('$2.5B');
      expect(formatBoxOffice(1234)).toBe('$1.2B');
    });

    it('should handle null correctly', () => {
      expect(formatBoxOffice(null)).toBe('N/A');
    });
  });

  describe('ComparableScript interface', () => {
    it('should create valid comparable script objects', () => {
      const script: ComparableScript = {
        id: 'script-123',
        title: 'The Godfather',
        logline: 'An organized crime patriarch transfers control to his reluctant son.',
        genre: ['Crime', 'Drama'],
        tone: 'Dark, Epic',
        productionStatus: 'produced',
        studio: 'Paramount',
        budgetTier: 'tentpole',
        boxOfficeMillions: 250,
        similarity: 0.87,
      };

      expect(script.title).toBe('The Godfather');
      expect(script.genre).toContain('Crime');
      expect(script.productionStatus).toBe('produced');
      expect(script.similarity).toBe(0.87);
    });

    it('should allow null optional fields', () => {
      const script: ComparableScript = {
        id: 'script-456',
        title: 'Unknown Script',
        logline: null,
        genre: [],
        tone: null,
        productionStatus: null,
        studio: null,
        budgetTier: null,
        boxOfficeMillions: null,
        similarity: 0.65,
      };

      expect(script.logline).toBeNull();
      expect(script.tone).toBeNull();
      expect(script.productionStatus).toBeNull();
    });
  });
});

describe('Similarity Calculations', () => {
  it('should have similarity values between 0 and 1', () => {
    const similarities = [0.0, 0.25, 0.5, 0.75, 1.0];

    similarities.forEach((sim) => {
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  it('should calculate relevance percent correctly', () => {
    const testCases = [
      { similarity: 0.0, expected: 0 },
      { similarity: 0.5, expected: 50 },
      { similarity: 0.75, expected: 75 },
      { similarity: 0.999, expected: 100 },
      { similarity: 1.0, expected: 100 },
    ];

    testCases.forEach(({ similarity, expected }) => {
      expect(Math.round(similarity * 100)).toBe(expected);
    });
  });
});
