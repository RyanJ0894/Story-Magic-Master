/**
 * Cloudflare R2 storage for Impact story audio.
 *
 * R2 is S3-compatible. Configure these env vars:
 *   R2_ACCOUNT_ID          — Cloudflare account ID
 *   R2_ACCESS_KEY_ID       — R2 API token Access Key
 *   R2_SECRET_ACCESS_KEY   — R2 API token Secret
 *   R2_BUCKET_NAME         — bucket name (e.g. story-magic-impact-audio)
 *   R2_PUBLIC_URL          — public base URL (e.g. https://audio.storymagicapp.net)
 *
 * Setup in Cloudflare dashboard:
 *   1. R2 → Create bucket "story-magic-impact-audio"
 *   2. Bucket settings → Public Access → Enable r2.dev (or attach custom domain)
 *   3. Manage R2 API Tokens → Create token with "Object Read & Write" for this bucket
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadImpactAudio(
  buffer: Buffer,
  key: string, // e.g. "impact/abc123.m4a"
  contentType = 'audio/mp4'
): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME not configured');

  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=604800', // 7 days
  }));

  return getPublicUrl(key);
}

export function getPublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
  if (!base) throw new Error('R2_PUBLIC_URL not configured');
  return `${base}/${key}`;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}
