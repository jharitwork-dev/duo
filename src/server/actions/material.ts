'use server';

// Learning materials ("สื่อการเรียน", quick 261113-lz7): teacher-shared content (title, description,
// link, files) for a whole classroom or one phase. No submission, no todos, never part of progress /
// phase unlocking (D-03). Teacher exports run requireRole(TEACHER) + assertClassroomEditor; file
// downloads are open to every classroom member via authorizeMaterialViewer. Material file keys are
// never shared with other rows (D-02), so R2 objects are removed after commit without ref counting.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { materials, materialFiles } from '@/db/schema/materials';
import { phases } from '@/db/schema/phases';
import { groups } from '@/db/schema/groups';
import { classroomMembers } from '@/db/schema/classrooms';
import { and, count, eq, isNull, max } from 'drizzle-orm';
import { getCurrentUserId, requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { getR2Config, presignGet, presignPut, validateAttachmentFile } from '@/lib/r2';
import { actionError, type ActionResult } from '@/lib/action-result';
import { ATTACHMENT_ERRORS, MAX_ATTACHMENTS_PER_TODO } from '@/lib/todo-attachments';
import {
  MATERIAL_ERRORS,
  buildMaterialFileKey,
  isMaterialFileKeyInScope,
  normalizeMaterialLinkUrl,
} from '@/lib/material-files';
import { assertClassroomEditor, cleanupR2Objects, loadClassroomAccess, type DbLike } from '@/server/phase-helpers';

export interface MaterialFileDTO {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

type MaterialRow = { id: string; classroomId: string; phaseId: string | null };

async function revalidateMaterialPages(classroomId: string) {
  revalidatePath(`/teacher/classroom/${classroomId}`);
  revalidatePath(`/student/classroom/${classroomId}`);
  const rows = await db.select({ id: groups.id }).from(groups).where(eq(groups.classroomId, classroomId));
  for (const g of rows) revalidatePath(`/student/classroom/${classroomId}/group/${g.id}`);
}

async function loadMaterial(tx: DbLike, materialId: string, opts: { lock?: boolean } = {}) {
  const q = tx
    .select({ id: materials.id, classroomId: materials.classroomId, phaseId: materials.phaseId })
    .from(materials)
    .where(eq(materials.id, materialId));
  const [row] = opts.lock ? await q.for('update') : await q;
  return row as MaterialRow | undefined;
}

async function loadFile(fileId: string) {
  const [row] = await db
    .select({
      id: materialFiles.id,
      fileName: materialFiles.fileName,
      fileKey: materialFiles.fileKey,
      materialId: materialFiles.materialId,
      classroomId: materials.classroomId,
      phaseId: materials.phaseId,
    })
    .from(materialFiles)
    .innerJoin(materials, eq(materials.id, materialFiles.materialId))
    .where(eq(materialFiles.id, fileId));
  return row;
}

async function countMaterialFiles(tx: DbLike, materialId: string): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(materialFiles).where(eq(materialFiles.materialId, materialId));
  return row?.n ?? 0;
}

/** null phase = whole classroom; otherwise the phase must belong to the classroom and be active. */
async function isValidTargetPhase(classroomId: string, phaseId: string | null): Promise<boolean> {
  if (phaseId === null) return true;
  const [phase] = await db
    .select({ classroomId: phases.classroomId, isArchived: phases.isArchived })
    .from(phases)
    .where(eq(phases.id, phaseId));
  return !!phase && phase.classroomId === classroomId && !phase.isArchived;
}

/**
 * Viewer rule: classroom editors see everything (incl. archived phases); any other classroom member
 * sees classroom-wide materials and materials of non-archived phases (D-03, D-04).
 */
async function authorizeMaterialViewer(material: MaterialRow, userId: string): Promise<boolean> {
  const access = await loadClassroomAccess(material.classroomId, userId);
  if (!access.classroom) return false;
  if (access.allowed) return true;
  const [member] = await db
    .select({ userId: classroomMembers.userId })
    .from(classroomMembers)
    .where(and(eq(classroomMembers.classroomId, material.classroomId), eq(classroomMembers.userId, userId)));
  if (!member) return false;
  if (material.phaseId === null) return true;
  const [phase] = await db
    .select({ isArchived: phases.isArchived })
    .from(phases)
    .where(eq(phases.id, material.phaseId));
  return !!phase && !phase.isArchived;
}

// ---------------------------------------------------------------------------------------------
// Create / update / delete

const fieldsSchema = {
  phaseId: z.string().min(1).nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  linkUrl: z.string().max(2100).optional().nullable(),
};

const createSchema = z.object({ classroomId: z.string().min(1), ...fieldsSchema });

export async function createMaterial(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ materialId: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return actionError(MATERIAL_ERRORS.badTitle);
  const data = parsed.data;

  try {
    await assertClassroomEditor(data.classroomId, userId);
  } catch {
    return actionError(MATERIAL_ERRORS.notAuthorized);
  }

  const link = normalizeMaterialLinkUrl(data.linkUrl);
  if (!link.ok) return actionError(MATERIAL_ERRORS.badLink);
  if (!(await isValidTargetPhase(data.classroomId, data.phaseId))) return actionError(MATERIAL_ERRORS.badPhase);

  const id = await db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({ maxOrder: max(materials.orderIndex) })
      .from(materials)
      .where(
        and(
          eq(materials.classroomId, data.classroomId),
          data.phaseId === null ? isNull(materials.phaseId) : eq(materials.phaseId, data.phaseId),
        ),
      );
    const [row] = await tx
      .insert(materials)
      .values({
        classroomId: data.classroomId,
        phaseId: data.phaseId,
        title: data.title,
        description: data.description?.trim() || null,
        linkUrl: link.url,
        orderIndex: (maxRow?.maxOrder ?? -1) + 1,
        createdBy: userId,
      })
      .returning({ id: materials.id });
    return row.id;
  });

  await revalidateMaterialPages(data.classroomId);
  return { success: true, materialId: id };
}

const updateSchema = z.object({ materialId: z.string().min(1), ...fieldsSchema });

export async function updateMaterial(input: z.infer<typeof updateSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return actionError(MATERIAL_ERRORS.badTitle);
  const data = parsed.data;

  const material = await loadMaterial(db, data.materialId);
  if (!material) return actionError(MATERIAL_ERRORS.notFound);
  try {
    await assertClassroomEditor(material.classroomId, userId);
  } catch {
    return actionError(MATERIAL_ERRORS.notAuthorized);
  }

  const link = normalizeMaterialLinkUrl(data.linkUrl);
  if (!link.ok) return actionError(MATERIAL_ERRORS.badLink);
  // Keeping the current (possibly archived) phase is allowed; moving into another phase must be valid.
  if (data.phaseId !== material.phaseId && !(await isValidTargetPhase(material.classroomId, data.phaseId))) {
    return actionError(MATERIAL_ERRORS.badPhase);
  }

  const updated = await db
    .update(materials)
    .set({
      phaseId: data.phaseId,
      title: data.title,
      description: data.description?.trim() || null,
      linkUrl: link.url,
      updatedAt: new Date(),
    })
    .where(eq(materials.id, material.id))
    .returning({ id: materials.id });
  if (updated.length === 0) return actionError(MATERIAL_ERRORS.notFound);

  await revalidateMaterialPages(material.classroomId);
  return { success: true };
}

const idSchema = z.object({ materialId: z.string().min(1) });

export async function deleteMaterial(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);

  const material = await loadMaterial(db, parsed.data.materialId);
  if (!material) return actionError(MATERIAL_ERRORS.notFound);
  try {
    await assertClassroomEditor(material.classroomId, userId);
  } catch {
    return actionError(MATERIAL_ERRORS.notAuthorized);
  }

  const keys = await db.transaction(async (tx) => {
    if (!(await loadMaterial(tx, material.id, { lock: true }))) return null;
    const rows = await tx
      .select({ key: materialFiles.fileKey })
      .from(materialFiles)
      .where(eq(materialFiles.materialId, material.id));
    // Cascades: material_files.
    await tx.delete(materials).where(eq(materials.id, material.id));
    return rows.map((r) => r.key);
  });
  if (!keys) return actionError(MATERIAL_ERRORS.notFound);

  await cleanupR2Objects(keys);
  await revalidateMaterialPages(material.classroomId);
  return { success: true };
}

// ---------------------------------------------------------------------------------------------
// Files

const uploadUrlSchema = z.object({
  materialId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(200),
  size: z.number().int().nonnegative(),
});

export async function createMaterialUploadUrl(
  input: z.infer<typeof uploadUrlSchema>,
): Promise<ActionResult<{ key: string; url: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = uploadUrlSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);
  const data = parsed.data;

  const material = await loadMaterial(db, data.materialId);
  if (!material) return actionError(MATERIAL_ERRORS.notFound);
  try {
    await assertClassroomEditor(material.classroomId, userId);
  } catch {
    return actionError(MATERIAL_ERRORS.notAuthorized);
  }

  if (!getR2Config()) return actionError(ATTACHMENT_ERRORS.noStorage);
  if (!validateAttachmentFile(data.contentType, data.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);
  if ((await countMaterialFiles(db, material.id)) >= MAX_ATTACHMENTS_PER_TODO) {
    return actionError(ATTACHMENT_ERRORS.tooMany);
  }

  const key = buildMaterialFileKey(material.id, createId(), data.fileName);
  try {
    const url = await presignPut(key, data.contentType);
    return { success: true, key, url };
  } catch {
    return actionError(ATTACHMENT_ERRORS.noStorage);
  }
}

const addFileSchema = z.object({
  materialId: z.string().min(1),
  key: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(200),
  size: z.number().int().nonnegative(),
});

export async function addMaterialFile(
  input: z.infer<typeof addFileSchema>,
): Promise<ActionResult<{ file: MaterialFileDTO }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = addFileSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);
  const data = parsed.data;

  const material = await loadMaterial(db, data.materialId);
  if (!material) return actionError(MATERIAL_ERRORS.notFound);
  try {
    await assertClassroomEditor(material.classroomId, userId);
  } catch {
    return actionError(MATERIAL_ERRORS.notAuthorized);
  }

  if (!validateAttachmentFile(data.contentType, data.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);
  if (!isMaterialFileKeyInScope(data.key, material.id)) return actionError(ATTACHMENT_ERRORS.input);

  const result = await db.transaction(async (tx) => {
    if (!(await loadMaterial(tx, material.id, { lock: true }))) {
      return { kind: 'error' as const, error: MATERIAL_ERRORS.notFound };
    }
    const [dup] = await tx.select({ n: count() }).from(materialFiles).where(eq(materialFiles.fileKey, data.key));
    if ((dup?.n ?? 0) > 0) return { kind: 'error' as const, error: MATERIAL_ERRORS.duplicate };
    if ((await countMaterialFiles(tx, material.id)) >= MAX_ATTACHMENTS_PER_TODO) {
      return { kind: 'error' as const, error: ATTACHMENT_ERRORS.tooMany };
    }
    const [file] = await tx
      .insert(materialFiles)
      .values({
        materialId: material.id,
        fileName: data.fileName,
        fileKey: data.key,
        contentType: data.contentType,
        fileSize: data.size,
        uploadedBy: userId,
      })
      .returning({
        id: materialFiles.id,
        fileName: materialFiles.fileName,
        contentType: materialFiles.contentType,
        fileSize: materialFiles.fileSize,
      });
    return { kind: 'ok' as const, file };
  });

  if (result.kind === 'error') return actionError(result.error);
  await revalidateMaterialPages(material.classroomId);
  return { success: true, file: result.file };
}

const fileIdSchema = z.object({ fileId: z.string().min(1) });

export async function removeMaterialFile(input: z.infer<typeof fileIdSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);

  const row = await loadFile(parsed.data.fileId);
  if (!row) return actionError(MATERIAL_ERRORS.fileNotFound);
  try {
    await assertClassroomEditor(row.classroomId, userId);
  } catch {
    return actionError(MATERIAL_ERRORS.notAuthorized);
  }

  const deleted = await db
    .delete(materialFiles)
    .where(eq(materialFiles.id, row.id))
    .returning({ key: materialFiles.fileKey });
  if (deleted.length === 0) return actionError(MATERIAL_ERRORS.fileNotFound);

  await cleanupR2Objects(deleted.map((d) => d.key));
  await revalidateMaterialPages(row.classroomId);
  return { success: true };
}

// ---------------------------------------------------------------------------------------------
// Download — any classroom member (not teacher-only)

export async function getMaterialFileUrl(
  input: z.infer<typeof fileIdSchema>,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  const userId = await getCurrentUserId();
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);

  const row = await loadFile(parsed.data.fileId);
  if (!row) return actionError(MATERIAL_ERRORS.fileNotFound);
  const allowed = await authorizeMaterialViewer(
    { id: row.materialId, classroomId: row.classroomId, phaseId: row.phaseId },
    userId,
  );
  if (!allowed) return actionError(MATERIAL_ERRORS.notViewer);

  if (!getR2Config()) return actionError(ATTACHMENT_ERRORS.noStorage);
  const disposition = `attachment; filename="${encodeURIComponent(row.fileName)}"`;
  try {
    const url = await presignGet(row.fileKey, 3600, disposition);
    return { success: true, url, fileName: row.fileName };
  } catch {
    return actionError(ATTACHMENT_ERRORS.noStorage);
  }
}
