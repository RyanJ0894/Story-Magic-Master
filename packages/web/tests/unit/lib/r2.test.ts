/**
 * Tests for Cloudflare R2 Storage
 *
 * lib/storage/r2.ts — uploadImpactAudio, getPublicUrl, isR2Configured
 *
 * Strategy: mock @aws-sdk/client-s3 (S3Client + PutObjectCommand.send)
 * and stub the R2_* environment variables via vi.stubEnv.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── vi.hoisted ensures mockSend is available inside the hoisted vi.mock factory ─

const { mockSend } = vi.hoisted(() => {
  return { mockSend: vi.fn() };
});

vi.mock('@aws-sdk/client-s3', () => {
  // Must be regular functions (not arrow) so they can be called with `new`
  return {
    S3Client: vi.fn(function MockS3Client(this: { send: typeof mockSend }) {
      this.send = mockSend;
    }),
    PutObjectCommand: vi.fn(function MockPutObjectCommand(this: Record<string, unknown>, params: Record<string, unknown>) {
      Object.assign(this, params);
    }),
  };
});

// ── R2 env var defaults ───────────────────────────────────────────────────────

const R2_ENV = {
  R2_ACCOUNT_ID: 'test-account-id',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_BUCKET_NAME: 'test-bucket',
  R2_PUBLIC_URL: 'https://audio.test.example.com',
};

// ── Import after mocks ────────────────────────────────────────────────────────

// Use dynamic import so env stubs affect module initialization
// (r2.ts reads env vars lazily via getClient(), so static import is fine here)
import { uploadImpactAudio, getPublicUrl, isR2Configured } from '@/lib/storage/r2';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// =============================================================================
// isR2Configured
// =============================================================================

describe('isR2Configured', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns true when all 5 env vars are set', () => {
    vi.stubEnv('R2_ACCOUNT_ID', R2_ENV.R2_ACCOUNT_ID);
    vi.stubEnv('R2_ACCESS_KEY_ID', R2_ENV.R2_ACCESS_KEY_ID);
    vi.stubEnv('R2_SECRET_ACCESS_KEY', R2_ENV.R2_SECRET_ACCESS_KEY);
    vi.stubEnv('R2_BUCKET_NAME', R2_ENV.R2_BUCKET_NAME);
    vi.stubEnv('R2_PUBLIC_URL', R2_ENV.R2_PUBLIC_URL);

    expect(isR2Configured()).toBe(true);
  });

  it('returns false when R2_ACCOUNT_ID is missing', () => {
    vi.stubEnv('R2_ACCOUNT_ID', '');
    vi.stubEnv('R2_ACCESS_KEY_ID', R2_ENV.R2_ACCESS_KEY_ID);
    vi.stubEnv('R2_SECRET_ACCESS_KEY', R2_ENV.R2_SECRET_ACCESS_KEY);
    vi.stubEnv('R2_BUCKET_NAME', R2_ENV.R2_BUCKET_NAME);
    vi.stubEnv('R2_PUBLIC_URL', R2_ENV.R2_PUBLIC_URL);

    expect(isR2Configured()).toBe(false);
  });

  it('returns false when R2_PUBLIC_URL is missing', () => {
    vi.stubEnv('R2_ACCOUNT_ID', R2_ENV.R2_ACCOUNT_ID);
    vi.stubEnv('R2_ACCESS_KEY_ID', R2_ENV.R2_ACCESS_KEY_ID);
    vi.stubEnv('R2_SECRET_ACCESS_KEY', R2_ENV.R2_SECRET_ACCESS_KEY);
    vi.stubEnv('R2_BUCKET_NAME', R2_ENV.R2_BUCKET_NAME);
    vi.stubEnv('R2_PUBLIC_URL', '');

    expect(isR2Configured()).toBe(false);
  });
});

// =============================================================================
// getPublicUrl
// =============================================================================

describe('getPublicUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns correctly joined URL', () => {
    vi.stubEnv('R2_PUBLIC_URL', 'https://audio.test.example.com');

    expect(getPublicUrl('impact/abc123.m4a')).toBe(
      'https://audio.test.example.com/impact/abc123.m4a'
    );
  });

  it('strips trailing slash from base URL', () => {
    vi.stubEnv('R2_PUBLIC_URL', 'https://audio.test.example.com/');

    expect(getPublicUrl('impact/abc123.m4a')).toBe(
      'https://audio.test.example.com/impact/abc123.m4a'
    );
  });

  it('throws when R2_PUBLIC_URL is not configured', () => {
    vi.stubEnv('R2_PUBLIC_URL', '');

    expect(() => getPublicUrl('impact/abc123.m4a')).toThrow('R2_PUBLIC_URL not configured');
  });
});

// =============================================================================
// uploadImpactAudio
// =============================================================================

describe('uploadImpactAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub all required env vars
    vi.stubEnv('R2_ACCOUNT_ID', R2_ENV.R2_ACCOUNT_ID);
    vi.stubEnv('R2_ACCESS_KEY_ID', R2_ENV.R2_ACCESS_KEY_ID);
    vi.stubEnv('R2_SECRET_ACCESS_KEY', R2_ENV.R2_SECRET_ACCESS_KEY);
    vi.stubEnv('R2_BUCKET_NAME', R2_ENV.R2_BUCKET_NAME);
    vi.stubEnv('R2_PUBLIC_URL', R2_ENV.R2_PUBLIC_URL);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('uploads buffer and returns the public URL', async () => {
    mockSend.mockResolvedValueOnce({});

    const buffer = Buffer.from('audio-data');
    const url = await uploadImpactAudio(buffer, 'impact/story123.m4a');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(url).toBe('https://audio.test.example.com/impact/story123.m4a');
  });

  it('passes correct bucket, key, and body to PutObjectCommand', async () => {
    mockSend.mockResolvedValueOnce({});

    const buffer = Buffer.from('test-audio');
    await uploadImpactAudio(buffer, 'impact/test.m4a');

    // PutObjectCommand is called with `new`, so inspect constructor call args
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'impact/test.m4a',
        Body: buffer,
      })
    );
  });

  it('uses default content type audio/mp4', async () => {
    mockSend.mockResolvedValueOnce({});

    await uploadImpactAudio(Buffer.from('data'), 'impact/x.m4a');

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: 'audio/mp4' })
    );
  });

  it('accepts a custom content type', async () => {
    mockSend.mockResolvedValueOnce({});

    await uploadImpactAudio(Buffer.from('data'), 'impact/x.mp3', 'audio/mpeg');

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: 'audio/mpeg' })
    );
  });

  it('sets cache-control header for 7-day public caching', async () => {
    mockSend.mockResolvedValueOnce({});

    await uploadImpactAudio(Buffer.from('data'), 'impact/x.m4a');

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ CacheControl: 'public, max-age=604800' })
    );
  });

  it('initializes S3Client with correct R2 endpoint', async () => {
    mockSend.mockResolvedValueOnce({});

    await uploadImpactAudio(Buffer.from('data'), 'impact/x.m4a');

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: `https://${R2_ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ENV.R2_ACCESS_KEY_ID,
          secretAccessKey: R2_ENV.R2_SECRET_ACCESS_KEY,
        },
      })
    );
  });

  it('throws when R2 credentials are not configured', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', '');

    await expect(
      uploadImpactAudio(Buffer.from('data'), 'impact/x.m4a')
    ).rejects.toThrow('R2 credentials not configured');
  });

  it('throws when R2_BUCKET_NAME is not configured', async () => {
    vi.stubEnv('R2_BUCKET_NAME', '');

    await expect(
      uploadImpactAudio(Buffer.from('data'), 'impact/x.m4a')
    ).rejects.toThrow('R2_BUCKET_NAME not configured');
  });

  it('propagates S3Client send errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(
      uploadImpactAudio(Buffer.from('data'), 'impact/x.m4a')
    ).rejects.toThrow('Network timeout');
  });
});
