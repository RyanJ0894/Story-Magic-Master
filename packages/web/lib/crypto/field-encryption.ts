/**
 * Field-Level Encryption — AES-256-GCM
 * Sprint 7 BL-017
 *
 * Provides transparent encrypt-on-write / decrypt-on-read for sensitive
 * database fields (initially: Project.scriptText).
 *
 * Ciphertext format (all base64):
 *   <version>:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * Version "1" = AES-256-GCM, 12-byte IV, 16-byte auth tag.
 *
 * Key: 32-byte hex string in env var FIELD_ENCRYPTION_KEY.
 * If the key is absent, encrypt() is a no-op and decrypt() returns the value
 * unchanged — this allows gradual rollout and local dev without the key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const VERSION = '1';
const SEPARATOR = ':';

function getKey(): Buffer | null {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex) return null;
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${buf.length} bytes.`,
    );
  }
  return buf;
}

/**
 * Returns true if the value looks like an encrypted ciphertext produced by this module.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}${SEPARATOR}`);
}

/**
 * Encrypts a plaintext string.
 *
 * Returns the plaintext unchanged if FIELD_ENCRYPTION_KEY is not set.
 * Returns the plaintext unchanged if it's already encrypted.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(SEPARATOR);
}

/**
 * Decrypts a ciphertext string produced by `encrypt()`.
 *
 * Returns the value unchanged if:
 *   - FIELD_ENCRYPTION_KEY is not set
 *   - The value does not look like encrypted ciphertext (plaintext passthrough)
 */
export function decrypt(value: string): string {
  const key = getKey();
  if (!key) return value;
  if (!isEncrypted(value)) return value;

  const parts = value.split(SEPARATOR);
  if (parts.length !== 4) {
    throw new Error('Invalid ciphertext format: expected 4 colon-separated parts.');
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts;

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
