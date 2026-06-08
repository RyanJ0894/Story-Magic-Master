// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockSend = vi.fn();

// Use regular functions (not arrow functions) so they work as constructors
// when s3.ts calls `new S3Client(...)` and `new PutObjectCommand(...)`.
vi.mock('@aws-sdk/client-s3', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  S3Client: vi.fn(function(this: any) { this.send = mockSend; }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PutObjectCommand: vi.fn(function(this: any, params: any) { Object.assign(this, params); }),
}));

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), error: vi.fn() },
}));

import { isS3Configured, getS3PublicUrl, maybeUploadEpisodeToS3 } from './s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const originalEnv = { ...process.env };

let tmpFile: string;

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
  // Restore env baseline
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  delete process.env.STORAGE_PROVIDER;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_S3_BUCKET;
  delete process.env.AWS_S3_REGION;
  delete process.env.AWS_S3_PUBLIC_URL;
  // Create a real temp audio file for tests that need one
  tmpFile = path.join(os.tmpdir(), `s3-test-${Date.now()}.m4a`);
  fs.writeFileSync(tmpFile, Buffer.from('fake-audio-data'));
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

function withS3Env() {
  process.env.STORAGE_PROVIDER = 's3';
  process.env.AWS_ACCESS_KEY_ID = 'test-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
  process.env.AWS_S3_BUCKET = 'test-bucket';
  process.env.AWS_S3_REGION = 'us-east-1';
  process.env.AWS_S3_PUBLIC_URL = 'https://audio.example.com';
}

// =============================================================================
// isS3Configured
// =============================================================================

describe('isS3Configured', () => {
  it('returns false when STORAGE_PROVIDER is not set', () => {
    expect(isS3Configured()).toBe(false);
  });

  it('returns false when STORAGE_PROVIDER=local', () => {
    process.env.STORAGE_PROVIDER = 'local';
    expect(isS3Configured()).toBe(false);
  });

  it('returns false when STORAGE_PROVIDER=s3 but credentials missing', () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_S3_PUBLIC_URL = 'https://audio.example.com';
    expect(isS3Configured()).toBe(false);
  });

  it('returns false when STORAGE_PROVIDER=s3 but bucket missing', () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.AWS_S3_PUBLIC_URL = 'https://audio.example.com';
    expect(isS3Configured()).toBe(false);
  });

  it('returns true when all required vars are set', () => {
    withS3Env();
    expect(isS3Configured()).toBe(true);
  });
});

// =============================================================================
// getS3PublicUrl
// =============================================================================

describe('getS3PublicUrl', () => {
  it('constructs URL from AWS_S3_PUBLIC_URL + key', () => {
    process.env.AWS_S3_PUBLIC_URL = 'https://audio.example.com';
    expect(getS3PublicUrl('audio/proj/episode.m4a')).toBe(
      'https://audio.example.com/audio/proj/episode.m4a'
    );
  });

  it('strips trailing slash from base URL', () => {
    process.env.AWS_S3_PUBLIC_URL = 'https://audio.example.com/';
    expect(getS3PublicUrl('audio/proj/episode.m4a')).toBe(
      'https://audio.example.com/audio/proj/episode.m4a'
    );
  });

  it('throws when AWS_S3_PUBLIC_URL is not set', () => {
    expect(() => getS3PublicUrl('audio/proj/episode.m4a')).toThrow('AWS_S3_PUBLIC_URL');
  });
});

// =============================================================================
// maybeUploadEpisodeToS3
// =============================================================================

describe('maybeUploadEpisodeToS3', () => {
  it('returns null and skips S3 when not configured', async () => {
    const result = await maybeUploadEpisodeToS3(tmpFile, 'proj-uuid');
    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns S3 URL when upload succeeds', async () => {
    withS3Env();
    const result = await maybeUploadEpisodeToS3(tmpFile, 'proj-uuid');
    expect(result).toBe(`https://audio.example.com/audio/proj-uuid/${path.basename(tmpFile)}`);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('passes correct S3 key to PutObjectCommand', async () => {
    withS3Env();
    await maybeUploadEpisodeToS3(tmpFile, 'abc123');
    expect(vi.mocked(PutObjectCommand)).toHaveBeenCalledWith(
      expect.objectContaining({ Key: `audio/abc123/${path.basename(tmpFile)}` })
    );
  });

  it('returns null (not throws) when S3 upload fails', async () => {
    withS3Env();
    mockSend.mockRejectedValueOnce(new Error('Network error'));
    const result = await maybeUploadEpisodeToS3(tmpFile, 'proj-uuid');
    expect(result).toBeNull();
  });
});
