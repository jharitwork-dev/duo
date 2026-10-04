'use server';

// Classroom-level tasks ("งานของห้องเรียน", quick 261004-j6h). A classroom task is defined once per
// phase and materialized as one todos row per group by syncClassroomTasks (phase-helpers). Every export
// runs requireRole(TEACHER) + assertPhaseEditor / assertClassroomTaskEditor. R2 objects are removed
// only after commit, and only when neither todo_attachments nor classroom_task_files references them.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { classroomTasks, classroomTaskFiles } from '@/db/schema/classroomTasks';
import { todos, todoAttachments } from '@/db/schema/todos';
import { submissions } from '@/db/schema/submissions';
import { asc, count, eq, max } from 'drizzle-orm';
import { getCurrentUserId, requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { getR2Config, presignPut, validateAttachmentFile } from '@/lib/r2';
import { actionError, type ActionResult } from '@/lib/action-result';
import { FILE_REQUIREMENTS } from '@/lib/work-page';
import {
  ATTACHMENT_ERRORS,
  MAX_ATTACHMENTS_PER_TODO,
  buildAttachmentKey,
  isAttachmentKeyInScope,
} from '@/lib/todo-attachments';
import { summarizeDelete } from '@/lib/classroom-task-sync';
import {
  assertClassroomTaskEditor,
  assertPhaseEditor,
  cleanupR2Objects,
  collectFileKeys,
  syncClassroomTasks,
  type DbLike,
} from '@/server/phase-helpers';

const ERR_NOT_AUTHORIZED = 'ไม่มีสิทธิ์แก้ไขงานนี้';
const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';
const ERR_NOT_FOUND = 'ไม่พบงานของห้องเรียนนี้';
const ERR_FILE_NOT_FOUND = 'ไม่พบไฟล์แนบ';
const ERR_DUPLICATE = 'ไฟล์นี้ถูกแนบแล้ว';

export interface ClassroomTaskFileDTO {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

function revalidateClassroomTaskPages(classroomId: string, groupIds: readonly string[]) {
  revalidatePath(`/teacher/classroom/${classroomId}`);
  revalidatePath(`/student/classroom/${classroomId}`);
  for (const groupId of groupIds) {
    revalidatePath(`/teacher/classroom/${classroomId}/group/${groupId}`);
    revalidatePath(`/student/classroom/${classroomId}/group/${groupId}`);
  }
}

async function lockTask(tx: DbLike, classroomTaskId: string) {
  const [row] = await tx
    .select({ id: classroomTasks.id })
    .from(classroomTasks)
    .where(eq(classroomTasks.id, classroomTaskId))
    .for('update');
  return row;
}

async function countTaskFiles(tx: DbLike, classroomTaskId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(classroomTaskFiles)
    .where(eq(classroomTaskFiles.classroomTaskId, classroomTaskId));
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------------------------
// Create / update

const fieldsSchema = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
  submissionMode: z.enum(['group', 'individual']).optional(),
  fileRequirement: z.enum(FILE_REQUIREMENTS).optional(),
  deadline: z.date().nullable().optional(),
};

const createSchema = z.object({ phaseId: z.string().min(1), ...fieldsSchema });

export async function createClassroomTask(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ classroomTaskId: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return actionError('ชื่องานต้องมี 1–200 ตัวอักษร');
  const data = parsed.data;

  let classroomId: string;
  try {
    ({
      classroom: { id: classroomId },
    } = await assertPhaseEditor(data.phaseId, userId));
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const result = await db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({ maxOrder: max(classroomTasks.orderIndex) })
      .from(classroomTasks)
      .where(eq(classroomTasks.phaseId, data.phaseId));
    const [task] = await tx
      .insert(classroomTasks)
      .values({
        phaseId: data.phaseId,
        title: data.title,
        description: data.description || null,
        notes: data.notes || null,
        submissionMode: data.submissionMode ?? 'group',
        fileRequirement: data.fileRequirement ?? 'optional',
        deadline: data.deadline ?? null,
        orderIndex: (maxRow?.maxOrder ?? -1) + 1,
        createdBy: userId,
      })
      .returning({ id: classroomTasks.id });
    const sync = await syncClassroomTasks(tx, classroomId);
    return { id: task.id, sync };
  });

  await cleanupR2Objects(result.sync.r2Keys);
  revalidateClassroomTaskPages(classroomId, result.sync.groupIds);
  return { success: true, classroomTaskId: result.id };
}

const updateSchema = z.object({
  classroomTaskId: z.string().min(1),
  ...fieldsSchema,
  title: fieldsSchema.title.optional(),
});

export async function updateClassroomTask(input: z.infer<typeof updateSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return actionError('ชื่องานต้องมี 1–200 ตัวอักษร');
  const { classroomTaskId, ...updates } = parsed.data;

  let classroomId: string;
  try {
    ({
      classroom: { id: classroomId },
    } = await assertClassroomTaskEditor(classroomTaskId, userId));
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const set: Partial<typeof classroomTasks.$inferInsert> = { updatedAt: new Date() };
  if (updates.title !== undefined) set.title = updates.title;
  if (updates.description !== undefined) set.description = updates.description || null;
  if (updates.notes !== undefined) set.notes = updates.notes || null;
  if (updates.submissionMode !== undefined) set.submissionMode = updates.submissionMode;
  if (updates.fileRequirement !== undefined) set.fileRequirement = updates.fileRequirement;
  if (updates.deadline !== undefined) set.deadline = updates.deadline;

  const sync = await db.transaction(async (tx) => {
    if (!(await lockTask(tx, classroomTaskId))) return null;
    await tx.update(classroomTasks).set(set).where(eq(classroomTasks.id, classroomTaskId));
    return syncClassroomTasks(tx, classroomId);
  });
  if (!sync) return actionError(ERR_NOT_FOUND);

  await cleanupR2Objects(sync.r2Keys);
  revalidateClassroomTaskPages(classroomId, sync.groupIds);
  return { success: true };
}

// ---------------------------------------------------------------------------------------------
// Delete (D-2: unsubmitted copies are removed, submitted copies are kept as ordinary group tasks)

const idSchema = z.object({ classroomTaskId: z.string().min(1) });

async function copyImpact(tx: DbLike, classroomTaskId: string) {
  const rows = await tx
    .select({ id: todos.id, n: count(submissions.id) })
    .from(todos)
    .leftJoin(submissions, eq(submissions.todoId, todos.id))
    .where(eq(todos.classroomTaskId, classroomTaskId))
    .groupBy(todos.id);
  return summarizeDelete(rows.map((r) => ({ hasSubmission: r.n > 0 })));
}

export async function getClassroomTaskDeleteImpact(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult<{ name: string; removed: number; kept: number }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);

  let name: string;
  try {
    ({
      task: { title: name },
    } = await assertClassroomTaskEditor(parsed.data.classroomTaskId, userId));
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }
  const impact = await copyImpact(db, parsed.data.classroomTaskId);
  return { success: true, name, ...impact };
}

export async function deleteClassroomTask(
  input: z.infer<typeof idSchema>,
): Promise<ActionResult<{ removed: number; kept: number }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { classroomTaskId } = parsed.data;

  let classroomId: string;
  try {
    ({
      classroom: { id: classroomId },
    } = await assertClassroomTaskEditor(classroomTaskId, userId));
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const result = await db.transaction(async (tx) => {
    // (a) lock; (b) remove/detach copies BEFORE deleting the row (FK ON DELETE SET NULL would
    // otherwise detach every copy); (c) collect the task's own file keys; (d) delete.
    if (!(await lockTask(tx, classroomTaskId))) return null;
    const impact = await copyImpact(tx, classroomTaskId);
    const sync = await syncClassroomTasks(tx, classroomId, { excludeTaskIds: [classroomTaskId] });
    const ownKeys = await collectFileKeys(tx, { todoIds: [], classroomTaskIds: [classroomTaskId] });
    await tx.delete(classroomTasks).where(eq(classroomTasks.id, classroomTaskId));
    return { impact, sync, keys: [...new Set([...sync.r2Keys, ...ownKeys])] };
  });
  if (!result) return actionError(ERR_NOT_FOUND);

  await cleanupR2Objects(result.keys);
  revalidateClassroomTaskPages(classroomId, result.sync.groupIds);
  return { success: true, ...result.impact };
}

// ---------------------------------------------------------------------------------------------
// Files (shared keys: copies get todo_attachments rows with the same file_key)

const uploadUrlSchema = z.object({
  classroomTaskId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(200),
  size: z.number().int().nonnegative(),
});

export async function createClassroomTaskUploadUrl(
  input: z.infer<typeof uploadUrlSchema>,
): Promise<ActionResult<{ key: string; url: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = uploadUrlSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);
  const data = parsed.data;

  try {
    await assertClassroomTaskEditor(data.classroomTaskId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  if (!getR2Config()) return actionError(ATTACHMENT_ERRORS.noStorage);
  if (!validateAttachmentFile(data.contentType, data.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);
  if ((await countTaskFiles(db, data.classroomTaskId)) >= MAX_ATTACHMENTS_PER_TODO) {
    return actionError(ATTACHMENT_ERRORS.tooMany);
  }

  const key = buildAttachmentKey(data.classroomTaskId, createId(), data.fileName);
  try {
    const url = await presignPut(key, data.contentType);
    return { success: true, key, url };
  } catch {
    return actionError(ATTACHMENT_ERRORS.noStorage);
  }
}

const addFileSchema = z.object({
  classroomTaskId: z.string().min(1),
  key: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(200),
  size: z.number().int().nonnegative(),
});

export async function addClassroomTaskFile(
  input: z.infer<typeof addFileSchema>,
): Promise<ActionResult<{ file: ClassroomTaskFileDTO }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = addFileSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);
  const data = parsed.data;

  let classroomId: string;
  try {
    ({
      classroom: { id: classroomId },
    } = await assertClassroomTaskEditor(data.classroomTaskId, userId));
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  if (!validateAttachmentFile(data.contentType, data.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);
  if (!isAttachmentKeyInScope(data.key, data.classroomTaskId)) return actionError(ATTACHMENT_ERRORS.input);

  const result = await db.transaction(async (tx) => {
    if (!(await lockTask(tx, data.classroomTaskId))) return { kind: 'error' as const, error: ERR_NOT_FOUND };

    // A key is attached exactly once (by this call): never re-attach or cross-attach an existing object.
    const [inAttachments] = await tx
      .select({ n: count() })
      .from(todoAttachments)
      .where(eq(todoAttachments.fileKey, data.key));
    const [inTaskFiles] = await tx
      .select({ n: count() })
      .from(classroomTaskFiles)
      .where(eq(classroomTaskFiles.fileKey, data.key));
    if ((inAttachments?.n ?? 0) > 0 || (inTaskFiles?.n ?? 0) > 0) {
      return { kind: 'error' as const, error: ERR_DUPLICATE };
    }
    if ((await countTaskFiles(tx, data.classroomTaskId)) >= MAX_ATTACHMENTS_PER_TODO) {
      return { kind: 'error' as const, error: ATTACHMENT_ERRORS.tooMany };
    }

    const [file] = await tx
      .insert(classroomTaskFiles)
      .values({
        classroomTaskId: data.classroomTaskId,
        fileName: data.fileName,
        fileKey: data.key,
        contentType: data.contentType,
        fileSize: data.size,
        uploadedBy: userId,
      })
      .returning({
        id: classroomTaskFiles.id,
        fileName: classroomTaskFiles.fileName,
        contentType: classroomTaskFiles.contentType,
        fileSize: classroomTaskFiles.fileSize,
      });
    const sync = await syncClassroomTasks(tx, classroomId);
    return { kind: 'ok' as const, file, sync };
  });

  if (result.kind === 'error') return actionError(result.error);
  await cleanupR2Objects(result.sync.r2Keys);
  revalidateClassroomTaskPages(classroomId, result.sync.groupIds);
  return { success: true, file: result.file };
}

const removeFileSchema = z.object({ fileId: z.string().min(1) });

export async function removeClassroomTaskFile(
  input: z.infer<typeof removeFileSchema>,
): Promise<ActionResult<{ objectRemoved: boolean }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = removeFileSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);

  const row = await db.query.classroomTaskFiles.findFirst({
    where: eq(classroomTaskFiles.id, parsed.data.fileId),
  });
  if (!row) return actionError(ERR_FILE_NOT_FOUND);

  let classroomId: string;
  try {
    ({
      classroom: { id: classroomId },
    } = await assertClassroomTaskEditor(row.classroomTaskId, userId));
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const result = await db.transaction(async (tx) => {
    if (!(await lockTask(tx, row.classroomTaskId))) return null;
    // Same lock order as removeTodoAttachment: todo_attachments rows, then classroom_task_files rows.
    await tx
      .select({ id: todoAttachments.id })
      .from(todoAttachments)
      .where(eq(todoAttachments.fileKey, row.fileKey))
      .orderBy(asc(todoAttachments.id))
      .for('update');
    await tx
      .select({ id: classroomTaskFiles.id })
      .from(classroomTaskFiles)
      .where(eq(classroomTaskFiles.fileKey, row.fileKey))
      .orderBy(asc(classroomTaskFiles.id))
      .for('update');
    await tx.delete(classroomTaskFiles).where(eq(classroomTaskFiles.id, row.id));
    // Removes the file from every non-overridden copy (orphan keys come back in r2Keys).
    const sync = await syncClassroomTasks(tx, classroomId);
    const [left] = await tx
      .select({ n: count() })
      .from(todoAttachments)
      .where(eq(todoAttachments.fileKey, row.fileKey));
    const [leftTaskFiles] = await tx
      .select({ n: count() })
      .from(classroomTaskFiles)
      .where(eq(classroomTaskFiles.fileKey, row.fileKey));
    const remaining = (left?.n ?? 0) + (leftTaskFiles?.n ?? 0);
    return { sync, remaining };
  });
  if (!result) return actionError(ERR_NOT_FOUND);

  const objectRemoved = result.remaining === 0;
  const keys = new Set(result.sync.r2Keys);
  if (objectRemoved) keys.add(row.fileKey);
  await cleanupR2Objects([...keys]);
  revalidateClassroomTaskPages(classroomId, result.sync.groupIds);
  return { success: true, objectRemoved };
}
