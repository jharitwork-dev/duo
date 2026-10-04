// Framework-free (NO 'use server' / 'use client') so it can be imported from Server Actions.
import { AwsClient } from 'aws4fetch';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function endpointFor(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'application/zip',
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateFile(contentType: string, size: number): boolean {
  return ALLOWED_TYPES.has(contentType) && size <= MAX_FILE_SIZE;
}

// Student submissions: same allow-list as teacher attachments, but capped at 10 MB per file.
export const SUBMISSION_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateSubmissionFile(contentType: string, size: number): boolean {
  return ALLOWED_TYPES.has(contentType) && size > 0 && size <= SUBMISSION_MAX_FILE_SIZE;
}

// Value for <input type="file" accept>: extensions + MIME types of the allow-list.
export const SUBMISSION_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pptx',
  '.xlsx',
  '.zip',
  '.mp4',
  ...ALLOWED_TYPES,
].join(',');

// build.Innovator object key pattern: submissions/{userId}/{todoId}/{filename}
export function submissionKey(userId: string, todoId: string, filename: string): string {
  return `submissions/${userId}/${todoId}/${filename}`;
}

// Teacher attachments (quick 261004-gid): the student allow-list plus common office/image/text types, 25 MB.
export const ATTACHMENT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const ATTACHMENT_ALLOWED_TYPES = new Set([
  ...ALLOWED_TYPES,
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'image/gif',
  'text/plain',
  'text/csv',
]);

export function validateAttachmentFile(contentType: string, size: number): boolean {
  return ATTACHMENT_ALLOWED_TYPES.has(contentType) && size > 0 && size <= ATTACHMENT_MAX_FILE_SIZE;
}

// Value for the teacher <input type="file" accept>.
export const ATTACHMENT_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.txt',
  '.csv',
  '.zip',
  '.mp4',
  ...ATTACHMENT_ALLOWED_TYPES,
].join(',');

// Teacher attachment key pattern: attachments/{scope}/{uploadId}-{safeName}
// scope = the to-do id, or the shared assignmentId when one upload is attached to several copies.
export function attachmentKey(scope: string, uploadId: string, safeName: string): string {
  return `attachments/${scope}/${uploadId}-${safeName}`;
}

export async function presignPut(key: string, contentType: string, expiresSec = 1800): Promise<string> {
  const cfg = getR2Config();
  if (!cfg) throw new Error('R2 not configured');
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  const url = `${endpointFor(cfg.accountId)}/${cfg.bucket}/${key}?X-Amz-Expires=${expiresSec}`;
  const signed = await client.sign(url, {
    method: 'PUT',
    aws: { signQuery: true },
    headers: { 'content-type': contentType },
  });
  return signed.url;
}

export async function presignGet(key: string, expiresSec = 3600, disposition?: string): Promise<string> {
  const cfg = getR2Config();
  if (!cfg) throw new Error('R2 not configured');
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  const u = new URL(`${endpointFor(cfg.accountId)}/${cfg.bucket}/${key}`);
  u.searchParams.set('X-Amz-Expires', String(expiresSec));
  if (disposition) u.searchParams.set('response-content-disposition', disposition);
  const signed = await client.sign(u.toString(), {
    method: 'GET',
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function deleteObject(key: string): Promise<void> {
  const cfg = getR2Config();
  if (!cfg) return;
  try {
    const client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: 's3',
      region: 'auto',
    });
    await client.fetch(`${endpointFor(cfg.accountId)}/${cfg.bucket}/${key}`, { method: 'DELETE' });
  } catch {
    /* best-effort */
  }
}
