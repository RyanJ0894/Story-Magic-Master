/**
 * Tests for the adaptive chunk sizer (Phase D-3).
 *
 * The sizer takes a script and a configured max-output-token cap, and
 * returns a recommended scenes-per-chunk value that targets ~70 % of
 * the cap given the script's per-scene density.
 *
 * Critical guards:
 *   - Always returns a value in [min, max]
 *   - Dense scripts get smaller chunks than sparse ones
 *   - Reasoning telemetry is populated so callers can log "why"
 *   - Edge cases (no scenes, single scene) don't crash
 */

import { describe, it, expect } from 'vitest';
import { pickChunkSize } from './adaptive-chunk-sizer.js';

const OPTIONS = {
  maxOutputTokens: 32_768,
  fallbackScenesPerChunk: 10,
  maxScenesPerChunk: 15,
  minScenesPerChunk: 4,
  targetUtilization: 0.7,
};

function buildScript(sceneCount: number, charsPerScene: number): string {
  const out: string[] = [];
  for (let i = 0; i < sceneCount; i++) {
    out.push(`INT. LOCATION ${i} - DAY`);
    // Fill the rest of the budget with action lines so total chars-per-scene
    // hits the target.
    const filler = 'A'.repeat(Math.max(0, charsPerScene - 25));
    out.push(filler);
  }
  return out.join('\n\n');
}

describe('pickChunkSize — basic density buckets', () => {
  it('returns sparse → larger chunks', () => {
    // 800 chars/scene * 0.09 tokens/char = 72 tokens per scene output.
    // 70% of 32K = ~23K target → 23000 / 72 ≈ 319 ideal, clamped to max 15.
    const result = pickChunkSize(buildScript(20, 800), OPTIONS);
    expect(result.reasoning.densityBucket).toBe('sparse');
    expect(result.scenesPerChunk).toBe(15);
    expect(result.reasoning.clampedTo).toBe('max');
  });

  it('returns moderate → between-extremes chunks', () => {
    // 1500 chars/scene * 0.09 = 135 tokens/scene. 23K / 135 ≈ 170, clamped to 15.
    const result = pickChunkSize(buildScript(20, 1500), OPTIONS);
    expect(result.reasoning.densityBucket).toBe('moderate');
    expect(result.scenesPerChunk).toBeGreaterThanOrEqual(4);
    expect(result.scenesPerChunk).toBeLessThanOrEqual(15);
  });

  it('returns dense → smaller chunks', () => {
    // 2500 chars/scene * 0.09 = 225 tokens/scene. 23K / 225 ≈ 102, clamped to 15.
    const result = pickChunkSize(buildScript(20, 2500), OPTIONS);
    expect(result.reasoning.densityBucket).toBe('dense');
    expect(result.scenesPerChunk).toBeGreaterThanOrEqual(4);
    expect(result.scenesPerChunk).toBeLessThanOrEqual(15);
  });

  it('returns very_dense → minimum chunks (clamped at floor)', () => {
    // 200K chars/scene × 0.09 tokens/char = 18000 tokens/scene output.
    // 23K target / 18K per-scene = 1 ideal — below min=4, so clamped to floor.
    const result = pickChunkSize(buildScript(20, 200_000), OPTIONS);
    expect(result.reasoning.densityBucket).toBe('very_dense');
    expect(result.scenesPerChunk).toBe(4);
    expect(result.reasoning.clampedTo).toBe('min');
  });
});

describe('pickChunkSize — invariants', () => {
  it('always returns a value within [min, max]', () => {
    const inputs = [
      buildScript(5, 500),
      buildScript(50, 2000),
      buildScript(100, 5000),
      buildScript(200, 100),
    ];
    for (const script of inputs) {
      const result = pickChunkSize(script, OPTIONS);
      expect(result.scenesPerChunk).toBeGreaterThanOrEqual(4);
      expect(result.scenesPerChunk).toBeLessThanOrEqual(15);
    }
  });

  it('dense scripts get smaller or equal chunks than sparse scripts at the same scene count', () => {
    const dense = pickChunkSize(buildScript(20, 5000), OPTIONS);
    const sparse = pickChunkSize(buildScript(20, 500), OPTIONS);
    expect(dense.scenesPerChunk).toBeLessThanOrEqual(sparse.scenesPerChunk);
  });

  it('reasoning telemetry includes the density bucket and clamping reason', () => {
    const result = pickChunkSize(buildScript(20, 2000), OPTIONS);
    expect(result.reasoning.sceneCount).toBe(20);
    expect(result.reasoning.avgCharsPerScene).toBeGreaterThan(0);
    expect(['sparse', 'moderate', 'dense', 'very_dense', 'unknown']).toContain(
      result.reasoning.densityBucket,
    );
    expect(['min', 'max', 'computed']).toContain(result.reasoning.clampedTo);
  });

  it('handles a script with zero scenes by returning the fallback', () => {
    const result = pickChunkSize('plain prose with no slug lines', OPTIONS);
    expect(result.scenesPerChunk).toBe(OPTIONS.fallbackScenesPerChunk);
    expect(result.reasoning.densityBucket).toBe('unknown');
    expect(result.reasoning.sceneCount).toBe(0);
  });

  it('handles a single-scene script (degenerate but valid)', () => {
    const result = pickChunkSize(buildScript(1, 2000), OPTIONS);
    // Chunk size > scene count is fine; the chunker just produces one chunk.
    expect(result.scenesPerChunk).toBeGreaterThanOrEqual(4);
  });
});

describe('pickChunkSize — projected output telemetry', () => {
  it('reports projected output tokens at the chosen chunk size', () => {
    const result = pickChunkSize(buildScript(20, 1500), OPTIONS);
    expect(result.reasoning.projectedOutputTokens).toBeGreaterThan(0);
  });

  it('targetOutputTokens reflects the configured utilization', () => {
    // 32K * 0.7 = 22937.6 → rounded
    const result = pickChunkSize(buildScript(20, 1500), OPTIONS);
    expect(result.reasoning.targetOutputTokens).toBeCloseTo(32_768 * 0.7, -1);
  });
});
