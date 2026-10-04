// Access helpers for work pages and to-do files (plain module — not a server action file).

import { db } from '@/db';
import { todos } from '@/db/schema/todos';
import { groupMembers } from '@/db/schema/groups';
import { classroomMembers } from '@/db/schema/classrooms';
import { submissions } from '@/db/schema/submissions';
import { workPages } from '@/db/schema/workPages';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { isPhaseViewable, statusFromSubmission, type SubmissionStatus } from '@/lib/node-path';
import { EMPTY_DOC, getWorkPageLock, workPageOwnerKey, type SubmissionMode } from '@/lib/work-page';
import { getEffectiveDeadline } from '@/lib/deadline';
import { resolveStudentTodoAccess } from '@/server/queries/submission';
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

export interface ScopedSubmissionRow {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Latest in-scope submission for (to-do, group/user), filtered in SQL: group mode = the group's
 * rows, individual = the student's rows. `lock` takes a row lock (FOR UPDATE) inside a transaction.
 */
export async function latestScopedSubmission(
  tx: DbLike,
  todoId: string,
  mode: SubmissionMode,
  groupId: string,
  userId: string,
  opts?: { lock?: boolean },
): Promise<ScopedSubmissionRow | null> {
  const query = tx
    .select({
      id: submissions.id,
      status: submissions.status,
      reviewedAt: submissions.reviewedAt,
      reviewedBy: submissions.reviewedBy,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.todoId, todoId),
        mode === 'group' ? eq(submissions.groupId, groupId) : eq(submissions.submittedBy, userId),
      ),
    )
    .orderBy(desc(submissions.createdAt))
    .limit(1);
  const [row] = opts?.lock ? await query.for('update') : await query;
  return row ?? null;
}

/** Latest in-scope submission status for (to-do, group/user). */
export async function latestScopedStatus(
  tx: DbLike,
  todoId: string,
  mode: SubmissionMode,
  groupId: string,
  userId: string,
): Promise<SubmissionStatus> {
  const row = await latestScopedSubmission(tx, todoId, mode, groupId, userId);
  return statusFromSubmission(row?.status);
}

/** Non-throwing variant of resolveWorkPageAccess (null = no student access). */
export async function loadWorkPageAccess(todoId: string, userId: string) {
  const access = await resolveStudentTodoAccess(todoId, userId);
  if (!access) return null;
  const { todo, phase, groupId, classroomId } = access;
  const owner = workPageOwnerKey(todo.submissionMode, groupId, userId);
  const [page, latestSubmission] = await Promise.all([
    findPage(db, todoId, owner),
    latestScopedSubmission(db, todoId, todo.submissionMode, groupId, userId),
  ]);
  const latestStatus = statusFromSubmission(latestSubmission?.status);
  const phaseViewable = isPhaseViewable(phase);
  // Effective deadline: to-do deadline, else the phase deadline (261004-03i).
  const deadline = getEffectiveDeadline(todo, todo.phase);
  const lock = getWorkPageLock({ latestStatus, phaseViewable, deadline, now: new Date() });
  const canEdit = lock === null;
  return {
    todo,
    phase,
    groupId,
    classroomId,
    owner,
    page,
    latestStatus,
    latestSubmission,
    latestSubmissionId: latestSubmission?.id ?? null,
    phaseViewable,
    deadline,
    lock,
    canEdit,
  };
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
