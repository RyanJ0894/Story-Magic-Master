/**
 * S3 upload utility for final audio output files.
 *
 * Used to store generated episode.m4a files in S3 so they are accessible
 * across multiple orchestrator instances (Render horizontal scale).
 *
 * Required env vars (when STORAGE_PROVIDER=s3):
 *   AWS_ACCESS_KEY_ID       — IAM access key (or R2 S3 Access Key ID)
 *   AWS_SECRET_ACCESS_KEY   — IAM secret key (or R2 S3 Secret Access Key)
 *   AWS_S3_BUCKET           — bucket name
 *   AWS_S3_REGION           — AWS region (default: us-east-1) or "auto" for Cloudflare R2
 *   AWS_S3_PUBLIC_URL       — public base URL (e.g. https://audio.storymagicapp.net)
 *   AWS_S3_ENDPOINT         — optional; custom endpoint for R2 / MinIO / non-AWS stores
 *                             (e.g. https://<account-id>.r2.cloudflarestorage.com)
 *
 * When not configured, all functions no-op and callers fall back to local paths.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { log } from './logger.js';

function getClient(): S3Client {
  const region = process.env.AWS_S3_REGION ?? 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    // endpoint + forcePathStyle required for Cloudflare R2 and other S3-compatible stores
    ...(endpoint && { endpoint, forcePathStyle: true }),
  });
}

export function isS3Configured(): boolean {
  return !!(
    process.env.STORAGE_PROVIDER === 's3' &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_S3_PUBLIC_URL
  );
}

/**
 * Upload a local audio file to S3 and return its public URL.
 *
 * Key format: `audio/${projectId}/${filename}` — mirrors the local path structure
 * so existing URL patterns are preserved if we ever need to migrate back.
 */
export async function uploadAudioToS3(localPath: string, projectId: string): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET not configured');

  const filename = path.basename(localPath);
  const key = `audio/${projectId}/${filename}`;

  const body = fs.readFileSync(localPath);
  const client = getClient();

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'audio/mp4',
    CacheControl: 'public, max-age=86400', // 24 hours
  }));

  const publicUrl = getS3PublicUrl(key);
  log.info('S3 upload complete', { projectId, key, publicUrl });
  return publicUrl;
}

export function getS3PublicUrl(key: string): string {
  const base = (process.env.AWS_S3_PUBLIC_URL ?? '').replace(/\/$/, '');
  if (!base) throw new Error('AWS_S3_PUBLIC_URL not configured');
  return `${base}/${key}`;
}

/**
 * Upload episode.m4a (or episode-N.m4a) to S3 if configured.
 * Returns the S3 public URL on success, or null if S3 is not configured.
 * Never throws — upload failure is logged and the caller falls back to local.
 */
export async function maybeUploadEpisodeToS3(
  localPath: string,
  projectId: string
): Promise<string | null> {
  if (!isS3Configured()) return null;

  try {
    return await uploadAudioToS3(localPath, projectId);
  } catch (err) {
    log.error('S3 upload failed — falling back to local URL', err instanceof Error ? err : new Error(String(err)), { projectId, localPath });
    return null;
  }
}
