import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, sha256 } from '@/lib/api-keys';

describe('generateApiKey', () => {
  it('returns a raw key starting with sm_live_', () => {
    const { raw } = generateApiKey();
    expect(raw).toMatch(/^sm_live_/);
  });

  it('hash matches re-hashing the raw key', () => {
    const { raw, hash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
  });

  it('prefix is the first 16 chars (sm_live_ + 8)', () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix).toBe(raw.slice(0, 16));
  });

  it('two generated keys are unique', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it('sha256 is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
    expect(sha256('hello')).not.toBe(sha256('world'));
  });
});
