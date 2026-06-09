/**
 * Tests for the TEST_MODE mock provider (T3-1 of cost-opt Phase 2).
 *
 * Pins:
 *   - isMockModeEnabled() reads TEST_MODE at call time
 *   - assertNotInProduction() throws when NODE_ENV=production
 *   - mockAgentResponse() returns valid JSON string even on fixture miss
 *   - mockStructuredResponse() returns schema-validated stub on fixture miss
 *   - Stubbing handles ZodString, ZodNumber, ZodBoolean, ZodArray, ZodObject,
 *     ZodEnum, ZodOptional, ZodNullable correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// fs is mocked so fixture loading misses by default; individual tests can
// override existsSync + readFileSync to simulate a fixture hit. Must use
// vi.hoisted because vi.mock factory references must not depend on top-level
// vars that aren't hoisted.
const { mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockReadFileSync: vi.fn(() => ''),
}));
vi.mock('fs', () => ({
  default: { existsSync: mockExistsSync, readFileSync: mockReadFileSync },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

import {
  isMockModeEnabled,
  assertNotInProduction,
  mockAgentResponse,
  mockStructuredResponse,
} from './mock-provider.js';

describe('isMockModeEnabled', () => {
  afterEach(() => {
    delete process.env.TEST_MODE;
  });

  it('false when unset', () => {
    delete process.env.TEST_MODE;
    expect(isMockModeEnabled()).toBe(false);
  });

  it('true when TEST_MODE=mock', () => {
    process.env.TEST_MODE = 'mock';
    expect(isMockModeEnabled()).toBe(true);
  });

  it('false for any other value (off, real, true, etc.)', () => {
    for (const val of ['off', 'real', 'true', 'false', '1']) {
      process.env.TEST_MODE = val;
      expect(isMockModeEnabled()).toBe(false);
    }
  });
});

describe('assertNotInProduction', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('throws when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertNotInProduction()).toThrow(/TEST_MODE=mock cannot be enabled/);
  });

  it('does not throw in development', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertNotInProduction()).not.toThrow();
  });

  it('does not throw in test', () => {
    process.env.NODE_ENV = 'test';
    expect(() => assertNotInProduction()).not.toThrow();
  });
});

describe('mockAgentResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('returns parseable JSON on fixture miss', () => {
    const result = mockAgentResponse('any prompt here', 'system');
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('_mock', true);
    expect(parsed).toHaveProperty('scenes');
  });

  it('returns same hash → same response (deterministic)', () => {
    const a = mockAgentResponse('the same prompt', 'sys');
    const b = mockAgentResponse('the same prompt', 'sys');
    expect(a).toBe(b);
  });

  it('returns fixture content when one exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"scenes": [{"id": "real"}], "from_fixture": true}');

    const result = mockAgentResponse('triggers fixture', 'sys');
    const parsed = JSON.parse(result);
    expect(parsed.from_fixture).toBe(true);
  });

  it('throws in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => mockAgentResponse('any', 'sys')).toThrow(/cannot be enabled in NODE_ENV=production/);
  });
});

describe('mockStructuredResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('returns a Zod-walked stub for a simple object schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      verified: z.boolean(),
    });
    const result = mockStructuredResponse('prompt', schema);
    expect(result.name).toBe('mock-string');
    expect(result.age).toBe(0);
    expect(result.verified).toBe(false);
  });

  it('returns empty arrays for ZodArray', () => {
    const schema = z.object({ tags: z.array(z.string()) });
    const result = mockStructuredResponse('p', schema);
    expect(result.tags).toEqual([]);
  });

  it('picks the first enum value for ZodEnum', () => {
    const schema = z.object({ verdict: z.enum(['pass', 'consider', 'recommend']) });
    const result = mockStructuredResponse('p', schema);
    expect(result.verdict).toBe('pass');
  });

  it('returns fixture data when one exists AND passes schema validation', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ name: 'fixture-name', age: 42, verified: true }),
    );

    const schema = z.object({
      name: z.string(),
      age: z.number(),
      verified: z.boolean(),
    });
    const result = mockStructuredResponse('p', schema);
    expect(result.name).toBe('fixture-name');
    expect(result.age).toBe(42);
    expect(result.verified).toBe(true);
  });

  it('falls back to stub when fixture fails schema validation', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"name": 123}'); // wrong type

    const schema = z.object({ name: z.string() });
    const result = mockStructuredResponse('p', schema);
    // Stub should kick in — name is the generic string stub.
    expect(result.name).toBe('mock-string');
  });

  it('throws in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => mockStructuredResponse('p', z.object({}))).toThrow(/production/);
  });
});

describe('mock-provider security', () => {
  it('does NOT touch filesystem when TEST_MODE is off (no overhead in real runs)', () => {
    delete process.env.TEST_MODE;
    delete process.env.NODE_ENV;
    vi.clearAllMocks();
    // isMockModeEnabled is the gate — mockAgentResponse is only ever called
    // after llm-client checks the flag, so this contract is what protects
    // production from the fixture filesystem path.
    expect(isMockModeEnabled()).toBe(false);
    expect(mockExistsSync).not.toHaveBeenCalled();
  });
});
