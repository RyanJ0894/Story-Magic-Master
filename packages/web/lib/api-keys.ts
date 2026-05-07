import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'sm_live_';
const MAX_KEYS_PER_USER = 10;

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = KEY_PREFIX + randomBytes(24).toString('hex');
  const hash = sha256(raw);
  const prefix = raw.slice(0, KEY_PREFIX.length + 8);
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return sha256(raw);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export { MAX_KEYS_PER_USER };
