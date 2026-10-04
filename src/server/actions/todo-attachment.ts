'use server';

// Teacher attachments on to-dos (quick 261004-gid). Every export runs requireRole(TEACHER) and
// assertTodoEditor for EVERY target to-do. One upload can be attached to several copies of the same
// assignment: all rows share one file_key, and the R2 object is removed only when the last row goes.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { todos, todoAttachments } from '@/db/schema/todos';
import { classroomTaskFiles } from '@/db/schema/classroomTasks';
import { and, asc, count, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { getCurrentUserId, requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { getR2Config, presignPut, validateAttachmentFile } from '@/lib/r2';
import { actionError, type ActionResult } from '@/lib/action-result';
import {
  ATTACHMENT_ERRORS,
  buildAttachmentKey,
  checkAttachmentCapacity,
  isAttachmentKeyInScope,
  resolveAttachmentScope,
} from '@/lib/todo-attachments';
import { assertTodoEditor, cleanupR2Objects, type DbLike } from '@/server/phase-helpers';

const ERR_NOT_AUTHORIZED = 'ไม่มีสิทธิ์แก้ไขงานนี้';
const ERR_NOT_FOUND = 'ไม่พบไฟล์แนบ';
const ERR_DUPLICATE = 'ไฟล์นี้ถูกแนบแล้ว';

export interface TodoAttachmentDTO {
  id: string;
  todoId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

type EditorScope = { todoId: string; classroomId: string; groupId: string };

function revalidateTodoPages(scopes: readonly EditorScope[]) {
  for (const s of scopes) {
    revalidatePath(`/todo/${s.todoId}`);
    revalidatePath(`/teacher/classroom/${s.classroomId}/group/${s.groupId}`);
    revalidatePath(`/student/classroom/${s.classroomId}/group/${s.groupId}`);
  }
}

/**
 * Per-copy file edits on classroom-task copies (261004-j6h) mark 'attachments' overridden so later
 * classroom file changes skip those copies. No-op for ordinary to-dos.
 */
async function markAttachmentsOverridden(tx: DbLike, todoIds: readonly string[]) {
  await tx
    .update(todos)
    .set({ overriddenFields: sql`array(select distinct unnest(${todos.overriddenFields} || '{attachments}'::text[]))` })
    .where(and(inArray(todos.id, [...todoIds]), isNotNull(todos.classroomTaskId)));
}

/** Per-to-do attachment counts (0 for to-dos without attachments). */
async function countAttachments(
  tx: DbLike,
  todoIds: readonly string[],
): Promise<Record<string, number>> {
  const rows = await tx
    .select({ todoId: todoAttachments.todoId, n: count() })
    .from(todoAttachments)
    .where(inArray(todoAttachments.todoId, [...todoIds]))
    .groupBy(todoAttachments.todoId);
  const counts: Record<string, number> = Object.fromEntries(todoIds.map((id) => [id, 0]));
  for (const r of rows) counts[r.todoId] = r.n;
  return counts;
}

async function loadScope(todoIds: readonly string[]) {
  const rows = await db
    .select({ id: todos.id, assignmentId: todos.assignmentId })
    .from(todos)
    .where(inArray(todos.id, [...todoIds]));
  if (rows.length !== todoIds.length) return { ok: false as const };
  return resolveAttachmentScope(rows);
}

// ---------------------------------------------------------------------------------------------
// Presigned upload URL (called AFTER the to-do(s) exist; the create dialog stages files client-side)

const uploadUrlSchema = z.object({
  todoIds: z.array(z.string().min(1)).min(1).max(20),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(200),
  size: z.number().int().nonnegative(),
});

export async function createAttachmentUploadUrl(
  input: z.infer<typeof uploadUrlSchema>,
): Promise<ActionResult<{ key: string; url: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = uploadUrlSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);
  const data = parsed.data;
  const ids = [...new Set(data.todoIds)];

  try {
    for (const id of ids) await assertTodoEditor(id, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  if (!getR2Config()) return actionError(ATTACHMENT_ERRORS.noStorage);
  if (!validateAttachmentFile(data.contentType, data.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);

  const scope = await loadScope(ids);
  if (!scope.ok) return actionError(ATTACHMENT_ERRORS.input);

  const capacity = checkAttachmentCapacity(await countAttachments(db, ids), 1);
  if (!capacity.ok) return actionError(ATTACHMENT_ERRORS.tooMany);

  const key = buildAttachmentKey(scope.scope, createId(), data.fileName);
  try {
    const url = await presignPut(key, data.contentType);
    return { success: true, key, url };
  } catch {
    return actionError(ATTACHMENT_ERRORS.noStorage);
  }
}

// ---------------------------------------------------------------------------------------------
// Insert the rows after the browser uploaded the object (one row per to-do, same file_key)

const addSchema = z.object({
  todoIds: z.array(z.string().min(1)).min(1).max(20),
  key: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(200),
  size: z.number().int().nonnegative(),
});

export async function addTodoAttachment(
  input: z.infer<typeof addSchema>,
): Promise<ActionResult<{ attachments: TodoAttachmentDTO[] }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);
  const data = parsed.data;
  const ids = [...new Set(data.todoIds)];

  const scopes: EditorScope[] = [];
  try {
    for (const id of ids) {
      const { todo, classroom } = await assertTodoEditor(id, userId);
      scopes.push({ todoId: todo.id, classroomId: classroom.id, groupId: todo.groupId });
    }
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  if (!validateAttachmentFile(data.contentType, data.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);
  const scope = await loadScope(ids);
  if (!scope.ok || !isAttachmentKeyInScope(data.key, scope.scope)) return actionError(ATTACHMENT_ERRORS.input);

  const result = await db.transaction(async (tx) => {
    // Lock the target to-dos (stable order) so concurrent adds cannot exceed the per-to-do limit.
    await tx.select({ id: todos.id }).from(todos).where(inArray(todos.id, ids)).orderBy(asc(todos.id)).for('update');

    // A key is attached exactly once (by this call): no re-attaching or cross-attaching an existing object.
    const [existing] = await tx
      .select({ n: count() })
      .from(todoAttachments)
      .where(eq(todoAttachments.fileKey, data.key));
    const [existingTaskFile] = await tx
      .select({ n: count() })
      .from(classroomTaskFiles)
      .where(eq(classroomTaskFiles.fileKey, data.key));
    if ((existing?.n ?? 0) > 0 || (existingTaskFile?.n ?? 0) > 0) {
      return { kind: 'error' as const, error: ERR_DUPLICATE };
    }

    const capacity = checkAttachmentCapacity(await countAttachments(tx, ids), 1);
    if (!capacity.ok) return { kind: 'error' as const, error: ATTACHMENT_ERRORS.tooMany };

    const rows = await tx
      .insert(todoAttachments)
      .values(
        ids.map((todoId) => ({
          todoId,
          fileName: data.fileName,
          fileKey: data.key,
          contentType: data.contentType,
          fileSize: data.size,
          uploadedBy: userId,
        })),
      )
      .returning({
        id: todoAttachments.id,
        todoId: todoAttachments.todoId,
        fileName: todoAttachments.fileName,
        contentType: todoAttachments.contentType,
        fileSize: todoAttachments.fileSize,
      });
    await markAttachmentsOverridden(tx, ids);
    return { kind: 'ok' as const, rows };
  });

  if (result.kind === 'error') return actionError(result.error);
  revalidateTodoPages(scopes);
  return { success: true, attachments: result.rows };
}

// ---------------------------------------------------------------------------------------------
// Remove one copy's row; delete the R2 object only when no row references its key any more

const removeSchema = z.object({ attachmentId: z.string().min(1) });

export async function removeTodoAttachment(
  input: z.infer<typeof removeSchema>,
): Promise<ActionResult<{ objectRemoved: boolean }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return actionError(ATTACHMENT_ERRORS.input);

  const row = await db.query.todoAttachments.findFirst({
    where: eq(todoAttachments.id, parsed.data.attachmentId),
  });
  if (!row) return actionError(ERR_NOT_FOUND);

  let scope: EditorScope;
  try {
    const { todo, classroom } = await assertTodoEditor(row.todoId, userId);
    scope = { todoId: todo.id, classroomId: classroom.id, groupId: todo.groupId };
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const remaining = await db.transaction(async (tx) => {
    // Locks every row sharing the key: concurrent removals of sibling copies serialise here, so
    // exactly one of them observes 0 remaining rows.
    await tx
      .select({ id: todoAttachments.id })
      .from(todoAttachments)
      .where(eq(todoAttachments.fileKey, row.fileKey))
      .orderBy(asc(todoAttachments.id))
      .for('update');
    // Inherited classroom-task files are also referenced by classroom_task_files (261004-j6h).
    await tx
      .select({ id: classroomTaskFiles.id })
      .from(classroomTaskFiles)
      .where(eq(classroomTaskFiles.fileKey, row.fileKey))
      .orderBy(asc(classroomTaskFiles.id))
      .for('update');
    await tx.delete(todoAttachments).where(eq(todoAttachments.id, row.id));
    await markAttachmentsOverridden(tx, [row.todoId]);
    const [left] = await tx
      .select({ n: count() })
      .from(todoAttachments)
      .where(eq(todoAttachments.fileKey, row.fileKey));
    const [leftTaskFiles] = await tx
      .select({ n: count() })
      .from(classroomTaskFiles)
      .where(eq(classroomTaskFiles.fileKey, row.fileKey));
    return (left?.n ?? 0) + (leftTaskFiles?.n ?? 0);
  });

  // After commit, best-effort and never throws.
  const objectRemoved = remaining === 0;
  if (objectRemoved) await cleanupR2Objects([row.fileKey]);

  revalidateTodoPages([scope]);
  return { success: true, objectRemoved };
}
