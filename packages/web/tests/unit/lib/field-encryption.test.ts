/**
 * Tests for field-level encryption — Sprint 7 BL-017
 *
 * Validates AES-256-GCM encrypt/decrypt round-trip, passthrough when key absent,
 * isEncrypted detection, and error handling for malformed ciphertext.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We test via real Node.js crypto — no mocks needed.
// Key is injected via vi.stubEnv per test as needed.

const TEST_KEY = 'a'.repeat(64); // 32-byte hex key (all 0xaa bytes)
const PLAINTEXT = 'INT. OFFICE - DAY\n\nJOHN\nHello world.';

describe('field-encryption', () => {
  let encrypt: (s: string) => string;
  let decrypt: (s: string) => string;
  let isEncrypted: (s: string) => boolean;

  beforeEach(async () => {
    // Re-import fresh module each time so env changes take effect
    vi.resetModules();
    ({ encrypt, decrypt, isEncrypted } = await import('@/lib/crypto/field-encryption'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ===========================================================================
  // isEncrypted
  // ===========================================================================

  describe('isEncrypted', () => {
    it('returns false for plaintext', () => {
      expect(isEncrypted('INT. OFFICE - DAY')).toBe(false);
    });

    it('returns true for a versioned ciphertext string', () => {
      expect(isEncrypted('1:aabbcc:ddeeff:gghhii')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });
  });

  // ===========================================================================
  // No key — passthrough mode
  // ===========================================================================

  describe('when FIELD_ENCRYPTION_KEY is not set', () => {
    it('encrypt returns the plaintext unchanged', () => {
      expect(encrypt(PLAINTEXT)).toBe(PLAINTEXT);
    });

    it('decrypt returns the value unchanged', () => {
      expect(decrypt(PLAINTEXT)).toBe(PLAINTEXT);
    });

    it('decrypt returns already-ciphertext-looking strings unchanged', () => {
      const fake = '1:aabbcc:ddeeff:gghhii';
      expect(decrypt(fake)).toBe(fake);
    });
  });

  // ===========================================================================
  // With key — encrypt / decrypt round-trip
  // ===========================================================================

  describe('when FIELD_ENCRYPTION_KEY is set', () => {
    beforeEach(() => {
      vi.stubEnv('FIELD_ENCRYPTION_KEY', TEST_KEY);
    });

    it('encrypt returns a versioned ciphertext (not the plaintext)', () => {
      const ciphertext = encrypt(PLAINTEXT);
      expect(ciphertext).not.toBe(PLAINTEXT);
      expect(isEncrypted(ciphertext)).toBe(true);
    });

    it('decrypt round-trips back to original plaintext', () => {
      const ciphertext = encrypt(PLAINTEXT);
      expect(decrypt(ciphertext)).toBe(PLAINTEXT);
    });

    it('two encryptions of the same plaintext produce different ciphertexts (random IV)', () => {
      const a = encrypt(PLAINTEXT);
      const b = encrypt(PLAINTEXT);
      expect(a).not.toBe(b);
      // Both decrypt to the same plaintext
      expect(decrypt(a)).toBe(PLAINTEXT);
      expect(decrypt(b)).toBe(PLAINTEXT);
    });

    it('encrypt is a no-op when value is already encrypted', () => {
      const first = encrypt(PLAINTEXT);
      const second = encrypt(first);
      expect(second).toBe(first);
    });

    it('decrypt returns plaintext unchanged when value is not encrypted', () => {
      expect(decrypt(PLAINTEXT)).toBe(PLAINTEXT);
    });

    it('handles empty string round-trip', () => {
      const ciphertext = encrypt('');
      expect(decrypt(ciphertext)).toBe('');
    });

    it('handles unicode and special characters', () => {
      const unicode = '日本語テキスト\n"quotes" & <html> special';
      const ciphertext = encrypt(unicode);
      expect(decrypt(ciphertext)).toBe(unicode);
    });

    it('handles large script text (> 10KB)', () => {
      const large = 'INT. SCENE - DAY\n\nCHAR\nLine of dialogue.\n\n'.repeat(300);
      const ciphertext = encrypt(large);
      expect(decrypt(ciphertext)).toBe(large);
    });
  });

  // ===========================================================================
  // Key validation
  // ===========================================================================

  describe('key validation', () => {
    it('throws when FIELD_ENCRYPTION_KEY is not 32 bytes (64 hex chars)', () => {
      vi.stubEnv('FIELD_ENCRYPTION_KEY', 'abc123'); // too short
      expect(() => encrypt(PLAINTEXT)).toThrow(/64-character hex string/);
    });
  });

  // ===========================================================================
  // Malformed ciphertext
  // ===========================================================================

  describe('malformed ciphertext', () => {
    beforeEach(() => {
      vi.stubEnv('FIELD_ENCRYPTION_KEY', TEST_KEY);
    });

    it('throws when ciphertext has wrong number of parts', () => {
      expect(() => decrypt('1:onlythreeparts')).toThrow(/4 colon-separated parts/);
    });

    it('returns unknown version strings unchanged (treated as plaintext)', () => {
      // Strings not starting with '1:' are not recognized as ciphertext
      expect(decrypt('9:aaa:bbb:ccc')).toBe('9:aaa:bbb:ccc');
    });
  });
});
