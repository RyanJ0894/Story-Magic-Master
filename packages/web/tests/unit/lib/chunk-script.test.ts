import { describe, it, expect } from 'vitest';
import {
  chunkScriptForScoring,
  snapToNewline,
  estimatePages,
  CHUNK_THRESHOLD,
  SECTION_SIZE,
} from '@/lib/scoring/chunk-script';

// =============================================================================
// chunkScriptForScoring
// =============================================================================

describe('chunkScriptForScoring', () => {
  describe('short scripts — no chunking', () => {
    it('returns the full text unchanged when under the threshold', () => {
      const script = 'A'.repeat(CHUNK_THRESHOLD - 1);
      const result = chunkScriptForScoring(script);
      expect(result.wasChunked).toBe(false);
      expect(result.text).toBe(script);
      expect(result.originalLength).toBe(script.length);
      expect(result.chunkedLength).toBe(script.length);
      expect(result.note).toBeNull();
    });

    it('returns the full text unchanged when exactly at the threshold', () => {
      const script = 'A'.repeat(CHUNK_THRESHOLD);
      const result = chunkScriptForScoring(script);
      expect(result.wasChunked).toBe(false);
    });
  });

  describe('long scripts — chunking', () => {
    function makeScript(chars: number): string {
      // Build a realistic-ish script with newlines every ~80 chars
      let text = '';
      while (text.length < chars) {
        text += 'INT. SCENE - DAY\n\nDIALOGUE LINE WITH SOME TEXT TO FILL SPACE AND SIMULATE A SCREENPLAY FORMAT.\n\n';
      }
      return text.slice(0, chars);
    }

    it('returns wasChunked=true for scripts over the threshold', () => {
      const script = makeScript(CHUNK_THRESHOLD + 1000);
      const result = chunkScriptForScoring(script);
      expect(result.wasChunked).toBe(true);
    });

    it('chunked text is shorter than the original', () => {
      const script = makeScript(200_000);
      const result = chunkScriptForScoring(script);
      expect(result.chunkedLength).toBeLessThan(result.originalLength);
    });

    it('chunked text includes Act 1, Act 2, and Act 3 section headers', () => {
      const script = makeScript(200_000);
      const result = chunkScriptForScoring(script);
      expect(result.text).toContain('ACT 1 SAMPLE');
      expect(result.text).toContain('ACT 2 MIDPOINT SAMPLE');
      expect(result.text).toContain('ACT 3 SAMPLE');
    });

    it('note describes the page count and section ranges', () => {
      const script = makeScript(120_000);
      const result = chunkScriptForScoring(script);
      expect(result.note).toContain('SCORING NOTE');
      expect(result.note).toContain('page screenplay');
    });

    it('respects custom threshold option', () => {
      const script = 'A'.repeat(5000);
      const shortThreshold = chunkScriptForScoring(script, { threshold: 4000 });
      const longThreshold = chunkScriptForScoring(script, { threshold: 6000 });
      expect(shortThreshold.wasChunked).toBe(true);
      expect(longThreshold.wasChunked).toBe(false);
    });

    it('respects custom sectionSize option', () => {
      const script = makeScript(200_000);
      const smallSections = chunkScriptForScoring(script, { sectionSize: 2000 });
      const largeSections = chunkScriptForScoring(script, { sectionSize: 20_000 });
      expect(smallSections.chunkedLength).toBeLessThan(largeSections.chunkedLength);
    });

    it('chunked output length is approximately 3 × sectionSize plus headers', () => {
      const script = makeScript(200_000);
      const sectionSize = 10_000;
      const result = chunkScriptForScoring(script, { sectionSize });
      // 3 sections + structural headers + note — should be under 4× section size
      expect(result.chunkedLength).toBeLessThan(sectionSize * 4 + 1000);
    });
  });
});

// =============================================================================
// snapToNewline
// =============================================================================

describe('snapToNewline', () => {
  const text = 'line one\nline two\nline three\nline four\nline five\n';

  it('returns a non-empty string for valid inputs', () => {
    const result = snapToNewline(text, 0, 20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('clamps start to 0 when start is negative', () => {
    const result = snapToNewline(text, -100, 20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('clamps end to text length when start + size exceeds text', () => {
    const result = snapToNewline(text, 40, 1000);
    expect(result.length).toBeLessThanOrEqual(text.length);
  });

  it('returns empty string for zero-length text', () => {
    const result = snapToNewline('', 0, 100);
    expect(result).toBe('');
  });

  it('does not include a leading or trailing newline', () => {
    const result = snapToNewline(text, 0, text.length);
    expect(result).not.toMatch(/^\n/);
    expect(result).not.toMatch(/\n$/);
  });
});

// =============================================================================
// estimatePages
// =============================================================================

describe('estimatePages', () => {
  it('estimates 1 page for 1000 chars', () => {
    expect(estimatePages(1000)).toBe(1);
  });

  it('estimates 90 pages for 90000 chars', () => {
    expect(estimatePages(90_000)).toBe(90);
  });

  it('estimates 120 pages for 120000 chars', () => {
    expect(estimatePages(120_000)).toBe(120);
  });

  it('rounds to nearest page', () => {
    expect(estimatePages(1499)).toBe(1);
    expect(estimatePages(1500)).toBe(2);
  });
});

// =============================================================================
// Constants
// =============================================================================

describe('constants', () => {
  it('CHUNK_THRESHOLD is set to 80000 chars (~80 pages)', () => {
    expect(CHUNK_THRESHOLD).toBe(80_000);
  });

  it('SECTION_SIZE is set to 15000 chars (~15 pages)', () => {
    expect(SECTION_SIZE).toBe(15_000);
  });
});
