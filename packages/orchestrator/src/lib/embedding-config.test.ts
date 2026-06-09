/**
 * Tests for the embedding-config invariants.
 *
 * Catches the class of bug Peter ran into: catalog vectors and query vectors
 * silently produced by different models with different dimensions, where
 * cosineSimilarity would either throw a misleading "length mismatch" or
 * return nonsense scores.
 */

import { describe, it, expect } from 'vitest';
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  assertEmbeddingDimension,
} from './embedding-config.js';

describe('embedding-config', () => {
  it('declares text-embedding-3-small as the canonical model', () => {
    // If you intentionally change the model, update this test AND regenerate
    // the audio catalog JSONs in the same PR via
    // scripts/regenerate-audio-embeddings.ts.
    expect(EMBEDDING_MODEL).toBe('text-embedding-3-small');
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });

  describe('assertEmbeddingDimension', () => {
    it('accepts a vector matching the canonical dimension', () => {
      const ok = new Array(EMBEDDING_DIMENSIONS).fill(0);
      expect(() => assertEmbeddingDimension(ok, 'test')).not.toThrow();
    });

    it('throws with a clear, actionable message on dimension mismatch', () => {
      const wrong = new Array(384).fill(0); // MiniLM-style legacy
      expect(() => assertEmbeddingDimension(wrong, 'load music_embeddings.json')).toThrow(
        /dimension mismatch.*expected 1536.*got 384.*regenerate/i,
      );
    });

    it('throws on empty vector input', () => {
      expect(() => assertEmbeddingDimension([], 'test')).toThrow(/expected 1536.*got 0/);
    });
  });
});
