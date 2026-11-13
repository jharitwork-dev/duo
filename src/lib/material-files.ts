// Pure rules for learning materials ("สื่อการเรียน", quick 261113-lz7). Framework-free, no DB, no
// network: importable from Server Actions, client components and tests.
import { sanitizeAttachmentName } from '@/lib/todo-attachments';

export const MAX_MATERIAL_LINK_LENGTH = 2000;

export const MATERIAL_ERRORS = {
  notFound: 'ไม่พบสื่อการเรียน',
  fileNotFound: 'ไม่พบไฟล์',
  badLink: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://',
  badPhase: 'Phase ไม่ถูกต้อง',
  badTitle: 'ชื่อสื่อการเรียนต้องมี 1–200 ตัวอักษร',
  notAuthorized: 'ไม่มีสิทธิ์แก้ไขสื่อการเรียนนี้',
  notViewer: 'ไม่มีสิทธิ์ดูสื่อการเรียนนี้',
  duplicate: 'ไฟล์นี้ถูกแนบแล้ว',
} as const;

/** R2 key of a material file: materials/{materialId}/{uploadId}-{safeName}. Never shared with other rows. */
export function buildMaterialFileKey(materialId: string, uploadId: string, fileName: string): string {
  return `materials/${materialId}/${uploadId}-${sanitizeAttachmentName(fileName)}`;
}

/** True when the key lives directly under materials/{materialId}/ with a non-empty, flat file part. */
export function isMaterialFileKeyInScope(key: string, materialId: string): boolean {
  if (!materialId || materialId.includes('/') || materialId.includes('..')) return false;
  const prefix = `materials/${materialId}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  return rest.length > 0 && !rest.includes('/') && !rest.includes('..');
}

export type MaterialLinkResult = { ok: true; url: string | null } | { ok: false };

/** Trims; empty means "no link"; otherwise only absolute http(s) URLs up to 2000 characters. */
export function normalizeMaterialLinkUrl(input: string | null | undefined): MaterialLinkResult {
  const value = (input ?? '').trim();
  if (!value) return { ok: true, url: null };
  if (value.length > MAX_MATERIAL_LINK_LENGTH) return { ok: false };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false };
  return { ok: true, url: value };
}
