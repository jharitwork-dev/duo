'use server';

import { z } from 'zod';
import { db } from '@/db';
import { todos } from '@/db/schema/todos';
import { todoAttachments } from '@/db/schema/todos';
import { groups } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { submissions } from '@/db/schema/submissions';
import { eq, and, max, inArray, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { presignGet } from '@/lib/r2';
import { createId } from '@/lib/ids';
import {
  assertClassroomEditor,
  assertPhaseEditor,
  assertTodoEditor,
  cleanupR2Objects,
  collectFileKeys,
  getPhaseClassroomId,
} from '@/server/phase-helpers';
import { checkDeleteConfirmation } from '@/lib/group-rules';
import { actionError, type ActionResult } from '@/lib/action-result';

const createTodoSchema = z.object({
  phaseId: z.string().min(1),
  groupIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(200),
  submissionMode: z.enum(['group', 'individual']).optional(),
  description: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
});

/**
 * D-2: creates one independent copy of the to-do per selected group. Copies created
 * together share an assignmentId (only when there is more than one group); no sync.
 */
export async function createTodo(input: z.infer<typeof createTodoSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = createTodoSchema.parse(input);
  const groupIds = [...new Set(data.groupIds)];

  const classroomId = await getPhaseClassroomId(data.phaseId);
  await assertClassroomEditor(classroomId, userId);

  const validGroups = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.classroomId, classroomId), inArray(groups.id, groupIds)));
  if (validGroups.length !== groupIds.length) {
    throw new Error('Some groups do not belong to this classroom');
  }

  const assignmentId = groupIds.length > 1 ? createId() : null;

  const todoIds = await db.transaction(async (tx) => {
    const ids: string[] = [];
    for (const groupId of groupIds) {
      const result = await tx
        .select({ maxOrder: max(todos.orderIndex) })
        .from(todos)
        .where(
          and(eq(todos.phaseId, data.phaseId), eq(todos.groupId, groupId), eq(todos.isArchived, false)),
        );
      const nextOrder = (result[0]?.maxOrder ?? -1) + 1;

      const [inserted] = await tx
        .insert(todos)
        .values({
          phaseId: data.phaseId,
          groupId,
          assignmentId,
          title: data.title,
          description: data.description,
          notes: data.notes,
          submissionMode: data.submissionMode ?? 'group',
          orderIndex: nextOrder,
          createdBy: userId,
        })
        .returning({ id: todos.id });
      ids.push(inserted.id);
    }
    return ids;
  });

  return { success: true, todoIds };
}

const updateTodoSchema = z.object({
  todoId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
  submissionMode: z.enum(['group', 'individual']).optional(),
  deadline: z.date().nullable().optional(),
});

export async function updateTodo(input: z.infer<typeof updateTodoSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = updateTodoSchema.parse(input);
  const { todoId, ...updates } = data;
  await assertTodoEditor(todoId, userId);

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.title !== undefined) updateFields.title = updates.title;
  if (updates.description !== undefined) updateFields.description = updates.description;
  if (updates.notes !== undefined) updateFields.notes = updates.notes;
  if (updates.submissionMode !== undefined) updateFields.submissionMode = updates.submissionMode;
  if (updates.deadline !== undefined) updateFields.deadline = updates.deadline;

  await db.update(todos).set(updateFields).where(eq(todos.id, todoId));

  return { success: true };
}

const reorderTodosSchema = z.object({
  phaseId: z.string().min(1),
  groupId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function reorderTodos(input: z.infer<typeof reorderTodosSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = reorderTodosSchema.parse(input);
  await assertPhaseEditor(data.phaseId, userId);

  // Verify all IDs belong to this (phase, group) and are not archived
  const existingTodos = await db
    .select({ id: todos.id })
    .from(todos)
    .where(
      and(
        eq(todos.phaseId, data.phaseId),
        eq(todos.groupId, data.groupId),
        eq(todos.isArchived, false),
        inArray(todos.id, data.orderedIds),
      ),
    );

  if (existingTodos.length !== data.orderedIds.length) {
    throw new Error('Some todo IDs are invalid, archived, or do not belong to this phase and group');
  }

  // Update all orderIndex values atomically in a transaction
  await db.transaction(async (tx) => {
    for (let i = 0; i < data.orderedIds.length; i++) {
      await tx
        .update(todos)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(eq(todos.id, data.orderedIds[i]));
    }
  });

  return { success: true };
}

const archiveTodoSchema = z.object({
  todoId: z.string().min(1),
});

export async function archiveTodo(input: z.infer<typeof archiveTodoSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = archiveTodoSchema.parse(input);
  await assertTodoEditor(data.todoId, userId);

  await db
    .update(todos)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(todos.id, data.todoId));

  return { success: true };
}

const restoreTodoSchema = z.object({
  todoId: z.string().min(1),
});

export async function restoreTodo(input: z.infer<typeof restoreTodoSchema>) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = restoreTodoSchema.parse(input);
  await assertTodoEditor(data.todoId, userId);

  await db
    .update(todos)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(todos.id, data.todoId));

  return { success: true };
}

const deleteTodoSchema = z.object({
  todoId: z.string().min(1),
  /** Also delete every copy sharing this to-do's assignmentId (same classroom). */
  allCopies: z.boolean().optional(),
  confirmName: z.string().optional(),
});

/** To-do ids in a delete scope: the to-do itself, or all copies of its assignment in the classroom. */
async function todoDeleteScope(
  todo: { id: string; assignmentId: string | null },
  classroomId: string,
  allCopies: boolean | undefined,
) {
  if (!allCopies || !todo.assignmentId) {
    return db
      .select({ id: todos.id, groupId: todos.groupId })
      .from(todos)
      .where(eq(todos.id, todo.id));
  }
  return db
    .select({ id: todos.id, groupId: todos.groupId })
    .from(todos)
    .innerJoin(phases, eq(phases.id, todos.phaseId))
    .where(and(eq(todos.assignmentId, todo.assignmentId), eq(phases.classroomId, classroomId)));
}

/**
 * Permanently deletes a to-do (or all copies of its assignment) with its attachments and
 * submissions. Typing the to-do title is required when anything was submitted in scope.
 * R2 objects are removed after the transaction commits.
 */
export async function deleteTodo(
  input: z.infer<typeof deleteTodoSchema>,
): Promise<ActionResult<{ deleted: number }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const data = deleteTodoSchema.parse(input);
  const { todo, classroom } = await assertTodoEditor(data.todoId, userId);

  const scope = await todoDeleteScope(todo, classroom.id, data.allCopies);
  const todoIds = scope.map((t) => t.id);
  const [row] = await db
    .select({ n: count() })
    .from(submissions)
    .where(inArray(submissions.todoId, todoIds));
  const confirmation = checkDeleteConfirmation({
    submissionCount: row?.n ?? 0,
    expectedName: todo.title,
    typed: data.confirmName,
  });
  if (!confirmation.ok) return actionError(confirmation.error);

  const keys = await db.transaction(async (tx) => {
    const fileKeys = await collectFileKeys(tx, { todoIds });
    // Cascades: submissions -> files/comments, todo_attachments.
    await tx.delete(todos).where(inArray(todos.id, todoIds));
    return fileKeys;
  });

  await cleanupR2Objects(keys);
  for (const groupId of new Set(scope.map((t) => t.groupId))) {
    revalidatePath(`/teacher/classroom/${classroom.id}/group/${groupId}`);
    revalidatePath(`/student/classroom/${classroom.id}/group/${groupId}`);
  }
  return { success: true, deleted: todoIds.length };
}

const getAttachmentUrlSchema = z.object({
  attachmentId: z.string().min(1),
});

/**
 * Returns a presigned download URL for a todo attachment.
 * Any authenticated user with classroom membership can download.
 */
export async function getAttachmentDownloadUrl(input: z.infer<typeof getAttachmentUrlSchema>) {
  await getCurrentUserId();
  const data = getAttachmentUrlSchema.parse(input);

  const attachment = await db.query.todoAttachments.findFirst({
    where: eq(todoAttachments.id, data.attachmentId),
  });

  if (!attachment) {
    throw new Error('Attachment not found');
  }

  const disposition = `attachment; filename="${encodeURIComponent(attachment.fileName)}"`;
  const url = await presignGet(attachment.fileKey, 3600, disposition);

  return { url, fileName: attachment.fileName };
}
