/**
 * Tests for Idempotency utilities
 * Validates cache key generation for TTS stems
 */

import { describe, it, expect } from 'vitest';
import { hash, ttsKey, ttskey } from './idempotency.js';

describe('hash', () => {
  it('should generate consistent SHA256 hash', () => {
    const input = 'hello world';
    const hash1 = hash(input);
    const hash2 = hash(input);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA256 hex string length
  });

  it('should generate different hashes for different inputs', () => {
    const hash1 = hash('hello');
    const hash2 = hash('world');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const result = hash('');
    expect(result).toHaveLength(64);
    // SHA256 of empty string is a known constant
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle special characters', () => {
    const result = hash('Hello! @#$%^&*() World');
    expect(result).toHaveLength(64);
  });

  it('should handle unicode characters', () => {
    const result = hash('Hello 世界 🌍');
    expect(result).toHaveLength(64);
  });

  it('should be case sensitive', () => {
    const hash1 = hash('Hello');
    const hash2 = hash('hello');

    expect(hash1).not.toBe(hash2);
  });
});

describe('ttsKey', () => {
  it('should generate consistent cache key', () => {
    const key1 = ttsKey('proj1', 'scene1', 'line1', 'voice1', { stability: 0.5 }, 'Hello world');
    const key2 = ttsKey('proj1', 'scene1', 'line1', 'voice1', { stability: 0.5 }, 'Hello world');

    expect(key1).toBe(key2);
  });

  it('should include all components in key', () => {
    const key = ttsKey('proj1', 'scene1', 'line1', 'voice1', { stability: 0.5 }, 'Hello world');

    // Key should contain identifiable parts
    expect(key).toContain('proj1');
    expect(key).toContain('scene1');
    expect(key).toContain('line1');
  });

  it('should generate different keys for different projects', () => {
    const key1 = ttsKey('proj1', 'scene1', 'line1', 'voice1', {}, 'Hello');
    const key2 = ttsKey('proj2', 'scene1', 'line1', 'voice1', {}, 'Hello');

    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different voices', () => {
    const key1 = ttsKey('proj1', 'scene1', 'line1', 'voice1', {}, 'Hello');
    const key2 = ttsKey('proj1', 'scene1', 'line1', 'voice2', {}, 'Hello');

    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different text', () => {
    const key1 = ttsKey('proj1', 'scene1', 'line1', 'voice1', {}, 'Hello');
    const key2 = ttsKey('proj1', 'scene1', 'line1', 'voice1', {}, 'World');

    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different params', () => {
    const key1 = ttsKey('proj1', 'scene1', 'line1', 'voice1', { stability: 0.5 }, 'Hello');
    const key2 = ttsKey('proj1', 'scene1', 'line1', 'voice1', { stability: 0.8 }, 'Hello');

    expect(key1).not.toBe(key2);
  });

  it('should handle empty params object', () => {
    const key = ttsKey('proj1', 'scene1', 'line1', 'voice1', {}, 'Hello');
    expect(key).toBeTruthy();
  });

  it('should handle complex params object', () => {
    const params = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
    };

    const key = ttsKey('proj1', 'scene1', 'line1', 'voice1', params, 'Hello');
    expect(key).toBeTruthy();
  });
});

describe('ttskey alias', () => {
  it('should be an alias for ttsKey', () => {
    const key1 = ttsKey('proj1', 'scene1', 'line1', 'voice1', {}, 'Hello');
    const key2 = ttskey('proj1', 'scene1', 'line1', 'voice1', {}, 'Hello');

    expect(key1).toBe(key2);
  });
});

describe('Cache Key Uniqueness', () => {
  it('should generate unique keys for different line IDs', () => {
    const keys = new Set<string>();
    const numLines = 100;

    for (let i = 0; i < numLines; i++) {
      const key = ttsKey('proj1', 'scene1', `line_${i}`, 'voice1', {}, `Text ${i}`);
      keys.add(key);
    }

    expect(keys.size).toBe(numLines);
  });

  it('should generate unique keys for same text different contexts', () => {
    const text = 'The same text';
    const keys = new Set<string>();

    // Same text in different scenes/lines
    keys.add(ttsKey('proj1', 'scene1', 'line1', 'voice1', {}, text));
    keys.add(ttsKey('proj1', 'scene1', 'line2', 'voice1', {}, text));
    keys.add(ttsKey('proj1', 'scene2', 'line1', 'voice1', {}, text));
    keys.add(ttsKey('proj2', 'scene1', 'line1', 'voice1', {}, text));

    expect(keys.size).toBe(4);
  });
});
