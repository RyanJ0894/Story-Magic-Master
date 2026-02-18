import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isBcryptHash } from '@/lib/password';

describe('Password Hashing', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash', { timeout: 15000 }, async () => {
      const hash = await hashPassword('testpassword');
      expect(hash).toMatch(/^\$2[aby]?\$\d{1,2}\$.{53}$/);
    });

    it('generates different hashes for the same password (salted)', { timeout: 15000 }, async () => {
      const hash1 = await hashPassword('testpassword');
      const hash2 = await hashPassword('testpassword');
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty string', { timeout: 15000 }, async () => {
      const hash = await hashPassword('');
      expect(hash).toBeTruthy();
      expect(isBcryptHash(hash)).toBe(true);
    });

    it('handles unicode characters', { timeout: 15000 }, async () => {
      const hash = await hashPassword('p@$$w0rd-日本語');
      expect(isBcryptHash(hash)).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('verifies correct password', { timeout: 15000 }, async () => {
      const hash = await hashPassword('mypassword');
      const result = await verifyPassword('mypassword', hash);
      expect(result).toBe(true);
    });

    it('rejects incorrect password', { timeout: 15000 }, async () => {
      const hash = await hashPassword('mypassword');
      const result = await verifyPassword('wrongpassword', hash);
      expect(result).toBe(false);
    });

    it('rejects empty password against real hash', { timeout: 15000 }, async () => {
      const hash = await hashPassword('mypassword');
      const result = await verifyPassword('', hash);
      expect(result).toBe(false);
    });

    it('handles special characters in password', { timeout: 15000 }, async () => {
      const password = 'p@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(password);
      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword(password + 'x', hash)).toBe(false);
    });
  });

  describe('isBcryptHash', () => {
    it('identifies bcrypt $2b$ hashes', () => {
      expect(isBcryptHash('$2b$12$LJ3m4ys3OGT2GnWK8Xl8/.hMXYbS4Y6IXnFRdj.l4H5z1n0aUXUE6')).toBe(true);
    });

    it('identifies bcrypt $2a$ hashes', () => {
      expect(isBcryptHash('$2a$10$N9qo8uLOickgx2ZMRZoMye.6Dz/TzrOx4yc8c3cPCqZZz5v7h3hXy')).toBe(true);
    });

    it('rejects SHA-256 hex strings', () => {
      expect(isBcryptHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(isBcryptHash('')).toBe(false);
    });

    it('rejects random strings', () => {
      expect(isBcryptHash('not-a-hash')).toBe(false);
    });
  });
});
