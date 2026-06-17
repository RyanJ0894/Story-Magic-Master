/**
 * Tests for the DirectorJson shared types — narrows the contract between
 * the orchestrator's zod schema and the web's Prisma JsonValue reads.
 */

import { describe, it, expect } from 'vitest';
import { isDirectorJson, asDirectorJson } from './director-json.js';

describe('isDirectorJson', () => {
  it('accepts a minimal shape with scenes array', () => {
    expect(isDirectorJson({ scenes: [] })).toBe(true);
    expect(isDirectorJson({ scenes: [{ scene_id: 's1', dialogue: [] }] })).toBe(true);
  });

  it('accepts a shape with project_id present', () => {
    expect(isDirectorJson({ project_id: 'p1', scenes: [] })).toBe(true);
  });

  it('accepts a legacy shape WITHOUT project_id (load-bearing back-compat)', () => {
    // Persisted rows from before the orchestrator validation boundary may
    // omit project_id. The guard must not invalidate them — otherwise the
    // processor would fall through to a fresh /generate-scenes call on
    // every retry of a partially-rendered project.
    expect(isDirectorJson({ scenes: [{ scene_id: 's1', dialogue: [] }] })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isDirectorJson(null)).toBe(false);
    expect(isDirectorJson(undefined)).toBe(false);
  });

  it('rejects primitives', () => {
    expect(isDirectorJson('not an object')).toBe(false);
    expect(isDirectorJson(42)).toBe(false);
    expect(isDirectorJson(true)).toBe(false);
  });

  it('rejects objects missing scenes', () => {
    expect(isDirectorJson({})).toBe(false);
    expect(isDirectorJson({ project_id: 'p1' })).toBe(false);
  });

  it('rejects objects where scenes is not an array', () => {
    expect(isDirectorJson({ scenes: 'oops' })).toBe(false);
    expect(isDirectorJson({ scenes: null })).toBe(false);
    expect(isDirectorJson({ scenes: { 0: { scene_id: 's1' } } })).toBe(false);
  });
});

describe('asDirectorJson', () => {
  it('returns the value when shape matches', () => {
    const value = { scenes: [{ scene_id: 's1', dialogue: [] }] };
    expect(asDirectorJson(value)).toBe(value);
  });

  it('returns null when shape does not match', () => {
    expect(asDirectorJson(null)).toBeNull();
    expect(asDirectorJson(undefined)).toBeNull();
    expect(asDirectorJson({})).toBeNull();
    expect(asDirectorJson('string')).toBeNull();
  });
});
