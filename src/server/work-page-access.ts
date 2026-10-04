// Access helpers for work pages and to-do files (plain module — not a server action file).

import { db } from '@/db';
import { todos } from '@/db/schema/todos';
import { groupMembers } from '@/db/schema/groups';
import { classroomMembers } from '@/db/schema/classrooms';
import { submissions } from '@/db/schema/submissions';
import { workPages } from '@/db/schema/workPages';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { isPhaseViewable, statusFromSubmission, type SubmissionStatus } from '@/lib/node-path';
import { EMPTY_DOC, canEditWorkPage, workPageOwnerKey, type SubmissionMode } from '@/lib/work-page';
import { isInSubmissionScope, resolveStudentTodoAccess } from '@/server/queries/submission';
import { loadClassroomAccess, type DbLike } from '@/server/phase-helpers';

const NOT_AUTHORIZED = 'To-do not found or not authorized';

export type WorkPageOwner = { groupId: string; userId: string | null };
export type WorkPageRow = typeof workPages.$inferSelect;

/**
 * Who may view a to-do's files / pages: classroom editors (owner, teacher member, superadmin) or
 * students who are members of the classroom AND of the to-do's group. Throws otherwise.
 */
export async function authorizeTodoViewer(todoId: string, userId: string) {
  const todo = await db.query.todos.findFirst({
    where: eq(todos.id, todoId),
    with: { group: true, phase: true },
  });
  if (!todo) throw new Error(NOT_AUTHORIZED);
  const classroomId = todo.group.classroomId;

  const { classroom, allowed } = await loadClassroomAccess(classroomId, userId);
  if (!classroom) throw new Error(NOT_AUTHORIZED);
  if (allowed) return { kind: 'editor' as const, todo, classroomId };

  const [classroomMember, groupMember] = await Promise.all([
    db.query.classroomMembers.findFirst({
      where: and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)),
      columns: { id: true },
    }),
    db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, todo.groupId), eq(groupMembers.userId, userId)),
      columns: { id: true },
    }),
  ]);
  if (!classroomMember || !groupMember) throw new Error(NOT_AUTHORIZED);
  return { kind: 'student' as const, todo, classroomId, groupId: todo.groupId };
}

/** Owner-key predicate for a work page row. */
function ownerWhere(todoId: string, owner: WorkPageOwner) {
  return and(
    eq(workPages.todoId, todoId),
    eq(workPages.groupId, owner.groupId),
    owner.userId === null ? isNull(workPages.userId) : eq(workPages.userId, owner.userId),
  );
}

export function isPageOwnedBy(page: Pick<WorkPageRow, 'groupId' | 'userId'>, owner: WorkPageOwner): boolean {
  return page.groupId === owner.groupId && (page.userId ?? null) === owner.userId;
}

/** Loads the page for an owner key; `lock` takes a row lock (FOR UPDATE) inside a transaction. */
export async function findPage(
  tx: DbLike,
  todoId: string,
  owner: WorkPageOwner,
  opts?: { lock?: boolean },
): Promise<WorkPageRow | null> {
  const query = tx.select().from(workPages).where(ownerWhere(todoId, owner)).limit(1);
  const [row] = opts?.lock ? await query.for('update') : await query;
  return row ?? null;
}

/**
 * Returns the owner's page, creating an empty one if missing (concurrent creators are
 * resolved by the partial unique indexes + ON CONFLICT DO NOTHING, then a re-select).
 * `markAuthor: false` (default true) creates the page with updatedBy NULL — used when a page is
 * created only to hold a comment thread, so the commenter is not shown as the page's last editor.
 */
export async function getOrCreatePage(
  tx: DbLike,
  todoId: string,
  owner: WorkPageOwner,
  userId: string,
  opts?: { lock?: boolean; markAuthor?: boolean },
): Promise<WorkPageRow> {
  const existing = await findPage(tx, todoId, owner, opts);
  if (existing) return existing;
  await tx
    .insert(workPages)
    .values({
      todoId,
      groupId: owner.groupId,
      userId: owner.userId,
      content: EMPTY_DOC,
      updatedAt: new Date(),
      updatedBy: opts?.markAuthor === false ? null : userId,
    })
    .onConflictDoNothing();
  const created = await findPage(tx, todoId, owner, opts);
  if (!created) throw new Error('Work page could not be created');
  return created;
}

/** Latest in-scope submission status for (to-do, group/user). */
export async function latestScopedStatus(
  tx: DbLike,
  todoId: string,
  mode: SubmissionMode,
  groupId: string,
  userId: string,
): Promise<SubmissionStatus> {
  const rows = await tx
    .select({ status: submissions.status, groupId: submissions.groupId, submittedBy: submissions.submittedBy })
    .from(submissions)
    .where(eq(submissions.todoId, todoId))
    .orderBy(desc(submissions.createdAt));
  const latest = rows.find((row) => isInSubmissionScope(row, mode, groupId, userId));
  return statusFromSubmission(latest?.status);
}

/** Non-throwing variant of resolveWorkPageAccess (null = no student access). */
export async function loadWorkPageAccess(todoId: string, userId: string) {
  const access = await resolveStudentTodoAccess(todoId, userId);
  if (!access) return null;
  const { todo, phase, groupId, classroomId } = access;
  const owner = workPageOwnerKey(todo.submissionMode, groupId, userId);
  const [page, latestStatus] = await Promise.all([
    findPage(db, todoId, owner),
    latestScopedStatus(db, todoId, todo.submissionMode, groupId, userId),
  ]);
  const phaseViewable = isPhaseViewable(phase);
  const canEdit = canEditWorkPage(latestStatus, phaseViewable);
  return { todo, phase, groupId, classroomId, owner, page, latestStatus, phaseViewable, canEdit };
}

/**
 * Student access to a to-do's work page: classroom + group member, to-do/phase not archived.
 * Throws when the caller has no access (auth failures throw, per conventions).
 */
export async function resolveWorkPageAccess(todoId: string, userId: string) {
  const access = await loadWorkPageAccess(todoId, userId);
  if (!access) throw new Error(NOT_AUTHORIZED);
  return access;
}

export type WorkPageAccess = NonNullable<Awaited<ReturnType<typeof loadWorkPageAccess>>>;
