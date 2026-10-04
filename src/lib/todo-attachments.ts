// Pure rules for teacher attachments on to-dos (quick 261004-gid). Framework-free, no DB, no network:
// importable from Server Actions, client components and tests.
import { attachmentKey } from '@/lib/r2';

export const MAX_ATTACHMENTS_PER_TODO = 10;

export const ATTACHMENT_ERRORS = {
  noStorage: 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์',
  invalidFile: 'ไฟล์ต้องเป็นชนิดที่รองรับ และไม่เกิน 25 MB',
  tooMany: 'แนบได้สูงสุด 10 ไฟล์ต่องาน',
  input: 'ข้อมูลไม่ถูกต้อง',
  uploadFailed: 'อัปโหลดไม่สำเร็จ',
} as const;

export const ATTACHMENT_HINT = 'PDF, Word, Excel, PowerPoint, รูปภาพ · ไม่เกิน 25 MB · สูงสุด 10 ไฟล์';

/** Same rule as work page uploads: non-word characters become '_', keep the last 100 characters. */
export function sanitizeAttachmentName(fileName: string): string {
  return fileName.replace(/[^\w.\-]/g, '_').slice(-100);
}

export type AttachmentScopeResult = { ok: true; scope: string } | { ok: false };

/**
 * Key scope of one upload: a single to-do uses its own id; several to-dos must be copies of the same
 * assignment (same non-null assignmentId), which then becomes the scope of the shared object.
 */
export function resolveAttachmentScope(
  targets: readonly { id: string; assignmentId: string | null }[],
): AttachmentScopeResult {
  if (targets.length === 0) return { ok: false };
  if (targets.length === 1) return { ok: true, scope: targets[0].id };
  const assignmentId = targets[0].assignmentId;
  if (!assignmentId) return { ok: false };
  if (!targets.every((t) => t.assignmentId === assignmentId)) return { ok: false };
  return { ok: true, scope: assignmentId };
}

export function buildAttachmentKey(scope: string, uploadId: string, fileName: string): string {
  return attachmentKey(scope, uploadId, sanitizeAttachmentName(fileName));
}

/** True when the key lives directly under attachments/{scope}/ with a non-empty, flat file part. */
export function isAttachmentKeyInScope(key: string, scope: string): boolean {
  if (!scope || scope.includes('/') || scope.includes('..')) return false;
  const prefix = `attachments/${scope}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  return rest.length > 0 && !rest.includes('/') && !rest.includes('..');
}

const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  mp4: 'video/mp4',
};

/**
 * Keeps a non-empty browser type (except the generic application/octet-stream); otherwise maps the
 * extension; unknown gives ''.
 */
export function inferAttachmentContentType(fileName: string, browserType: string): string {
  if (browserType && browserType !== 'application/octet-stream') return browserType;
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return '';
  return EXTENSION_TYPES[fileName.slice(dot + 1).toLowerCase()] ?? '';
}

export type AttachmentCapacityResult = { ok: true } | { ok: false; todoId: string };

/** Fails (naming the first full to-do) when adding `adding` files would exceed the per-to-do limit. */
export function checkAttachmentCapacity(
  counts: Readonly<Record<string, number>>,
  adding: number,
): AttachmentCapacityResult {
  for (const [todoId, n] of Object.entries(counts)) {
    if (n + adding > MAX_ATTACHMENTS_PER_TODO) return { ok: false, todoId };
  }
  return { ok: true };
}
