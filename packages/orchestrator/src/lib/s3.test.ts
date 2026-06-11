// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockSend = vi.fn();
// Capture the constructor args passed to S3Client so we can assert region/endpoint/etc.
const s3ClientCalls: unknown[] = [];

// Use regular functions (not arrow functions) so they work as constructors
// when s3.ts calls `new S3Client(...)` and `new PutObjectCommand(...)`.
vi.mock('@aws-sdk/client-s3', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  S3Client: vi.fn(function(this: any, cfg: unknown) {
    s3ClientCalls.push(cfg);
    this.send = mockSend;
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PutObjectCommand: vi.fn(function(this: any, params: any) { Object.assign(this, params); }),
}));

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), error: vi.fn() },
}));

import { isS3Configured, getS3PublicUrl, maybeUploadEpisodeToS3, uploadAudioToS3 } from './s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const originalEnv = { ...process.env };

let tmpFile: string;

beforeEach(() => {
  // Reset call history on the mocked AWS SDK constructors so each test only
  // observes its own calls — without this, PutObjectCommand.mock.calls from
  // earlier tests leak into assertions that read calls[0].
  vi.mocked(PutObjectCommand).mockClear();
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
  s3ClientCalls.length = 0;
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

  it('returns null (not throws) when the local file does not exist', async () => {
    withS3Env();
    const missingPath = path.join(os.tmpdir(), `nope-${Date.now()}.m4a`);
    const result = await maybeUploadEpisodeToS3(missingPath, 'proj-uuid');
    expect(result).toBeNull();
    // Crucially: must not attempt the upload — the readFileSync failure should be caught early
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// =============================================================================
// uploadAudioToS3 — direct API (covers what maybeUpload wraps)
// =============================================================================

describe('uploadAudioToS3', () => {
  it('sends a PutObjectCommand with the correct Bucket, Key, ContentType, and CacheControl', async () => {
    withS3Env();
    await uploadAudioToS3(tmpFile, 'proj-abc');

    const call = vi.mocked(PutObjectCommand).mock.calls[0][0];
    expect(call).toMatchObject({
      Bucket: 'test-bucket',
      Key: `audio/proj-abc/${path.basename(tmpFile)}`,
      ContentType: 'audio/mp4',
      CacheControl: 'public, max-age=86400',
    });
    // Body is the actual file content, not a placeholder
    expect(Buffer.isBuffer(call.Body)).toBe(true);
    expect((call.Body as Buffer).toString()).toBe('fake-audio-data');
  });

  it('throws when AWS credentials are missing (called outside the safe wrapper)', async () => {
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_S3_PUBLIC_URL = 'https://audio.example.com';
    // No AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
    await expect(uploadAudioToS3(tmpFile, 'proj-uuid')).rejects.toThrow(/AWS credentials/);
  });

  it('throws when AWS_S3_BUCKET is missing (called outside the safe wrapper)', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'k';
    process.env.AWS_SECRET_ACCESS_KEY = 's';
    process.env.AWS_S3_PUBLIC_URL = 'https://audio.example.com';
    // No AWS_S3_BUCKET
    await expect(uploadAudioToS3(tmpFile, 'proj-uuid')).rejects.toThrow(/AWS_S3_BUCKET/);
  });
});

// =============================================================================
// S3 client configuration — region default + R2 endpoint application
// =============================================================================

describe('S3Client configuration', () => {
  it('defaults AWS_S3_REGION to us-east-1 when unset', async () => {
    withS3Env();
    delete process.env.AWS_S3_REGION;
    await uploadAudioToS3(tmpFile, 'proj-uuid');

    expect(s3ClientCalls).toHaveLength(1);
    expect((s3ClientCalls[0] as { region: string }).region).toBe('us-east-1');
  });

  it('passes AWS_S3_REGION through when set (real AWS deployment)', async () => {
    withS3Env();
    process.env.AWS_S3_REGION = 'eu-west-2';
    await uploadAudioToS3(tmpFile, 'proj-uuid');

    expect((s3ClientCalls[0] as { region: string }).region).toBe('eu-west-2');
  });

  it('does NOT set endpoint/forcePathStyle on pure AWS S3 (no AWS_S3_ENDPOINT)', async () => {
    withS3Env();
    // No AWS_S3_ENDPOINT — should use AWS SDK's region-derived endpoint
    await uploadAudioToS3(tmpFile, 'proj-uuid');

    const cfg = s3ClientCalls[0] as { endpoint?: string; forcePathStyle?: boolean };
    expect(cfg.endpoint).toBeUndefined();
    expect(cfg.forcePathStyle).toBeUndefined();
  });

  it('applies endpoint + forcePathStyle when AWS_S3_ENDPOINT is set (R2 / MinIO)', async () => {
    withS3Env();
    process.env.AWS_S3_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
    process.env.AWS_S3_REGION = 'auto'; // R2 convention
    await uploadAudioToS3(tmpFile, 'proj-uuid');

    const cfg = s3ClientCalls[0] as { endpoint?: string; forcePathStyle?: boolean; region: string };
    expect(cfg.endpoint).toBe('https://acct.r2.cloudflarestorage.com');
    expect(cfg.forcePathStyle).toBe(true);
    expect(cfg.region).toBe('auto');
  });

  it('passes credentials from env to the S3Client constructor', async () => {
    withS3Env();
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-FOO';
    process.env.AWS_SECRET_ACCESS_KEY = 'shhh';
    await uploadAudioToS3(tmpFile, 'proj-uuid');

    const cfg = s3ClientCalls[0] as { credentials: { accessKeyId: string; secretAccessKey: string } };
    expect(cfg.credentials).toEqual({ accessKeyId: 'AKIA-FOO', secretAccessKey: 'shhh' });
  });
});
