// Shared server helpers for classroom-level phases (plain module — not a server action file).

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos, todoAttachments } from '@/db/schema/todos';
import { submissions, submissionFiles } from '@/db/schema/submissions';
import { workPages, workPageFiles } from '@/db/schema/workPages';
import { groupPhaseProgress } from '@/db/schema/groupPhaseProgress';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { getCurrentRole } from '@/lib/auth';
import { decideClassroomAccess } from '@/lib/classroom-access';
import { canDeleteGroup, type DeleteGroupDecision } from '@/lib/group-rules';
import { planProgressSync, type ProgressSyncGroup } from '@/lib/phase-progress';

export { cleanupR2Objects } from '@/lib/r2-cleanup';

export type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const NOT_AUTHORIZED = 'Classroom not found or not authorized';

type ClassroomRow = typeof classrooms.$inferSelect;

/** Loads a classroom and decides (without throwing) whether the caller may edit it. */
export async function loadClassroomAccess(
  classroomId: string,
  userId: string,
): Promise<{ classroom: ClassroomRow | undefined; allowed: boolean }> {
  const [classroom, member, role] = await Promise.all([
    db.query.classrooms.findFirst({ where: eq(classrooms.id, classroomId) }),
    db.query.classroomMembers.findFirst({
      where: and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId)),
      columns: { role: true },
    }),
    getCurrentRole(),
  ]);
  if (!classroom) return { classroom, allowed: false };
  const allowed = decideClassroomAccess({
    createdBy: classroom.createdBy,
    userId,
    role,
    isTeacherMember: member?.role === 'teacher',
  });
  return { classroom, allowed };
}

/**
 * Passes for the classroom owner, a teacher member of the classroom (global role teacher),
 * or a superadmin. Returns the classroom row; throws otherwise.
 */
export async function assertClassroomEditor(classroomId: string, userId: string): Promise<ClassroomRow> {
  const { classroom, allowed } = await loadClassroomAccess(classroomId, userId);
  if (!classroom || !allowed) throw new Error(NOT_AUTHORIZED);
  return classroom;
}

/** assertClassroomEditor for the classroom owning a group. */
export async function assertGroupEditor(groupId: string, userId: string) {
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group) throw new Error(NOT_AUTHORIZED);
  const classroom = await assertClassroomEditor(group.classroomId, userId);
  return { group, classroom };
}

/** assertClassroomEditor for the classroom owning a phase. */
export async function assertPhaseEditor(phaseId: string, userId: string) {
  const phase = await db.query.phases.findFirst({ where: eq(phases.id, phaseId) });
  if (!phase) throw new Error(NOT_AUTHORIZED);
  const classroom = await assertClassroomEditor(phase.classroomId, userId);
  return { phase, classroom };
}

/** assertClassroomEditor for the classroom owning a to-do (via its phase). */
export async function assertTodoEditor(todoId: string, userId: string) {
  const todo = await db.query.todos.findFirst({ where: eq(todos.id, todoId) });
  if (!todo) throw new Error(NOT_AUTHORIZED);
  const phase = await db.query.phases.findFirst({
    where: eq(phases.id, todo.phaseId),
    columns: { classroomId: true },
  });
  if (!phase) throw new Error(NOT_AUTHORIZED);
  const classroom = await assertClassroomEditor(phase.classroomId, userId);
  return { todo, classroom };
}

/** Number of submissions on the to-dos owned by a group. */
export async function countGroupSubmissions(tx: DbLike, groupId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(submissions)
    .innerJoin(todos, eq(todos.id, submissions.todoId))
    .where(eq(todos.groupId, groupId));
  return row?.n ?? 0;
}

/**
 * Group deletion authorization (see canDeleteGroup): classroom editors always (type-to-confirm when
 * submissions exist); the self_create creator only while the group has zero submissions; nobody else.
 * Throws when the group does not exist or the caller is unrelated; returns the decision otherwise.
 */
export async function authorizeGroupDelete(groupId: string, userId: string) {
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group) throw new Error('Group not found or not authorized');
  const { classroom, allowed } = await loadClassroomAccess(group.classroomId, userId);
  if (!classroom) throw new Error('Group not found or not authorized');

  let isGroupCreator = false;
  if (!allowed && group.createdBy === userId) {
    const member = await db.query.classroomMembers.findFirst({
      where: and(eq(classroomMembers.classroomId, classroom.id), eq(classroomMembers.userId, userId)),
      columns: { role: true },
    });
    isGroupCreator = member?.role === 'student';
  }
  if (!allowed && !isGroupCreator) throw new Error('Group not found or not authorized');

  const submissionCount = await countGroupSubmissions(db, groupId);
  const decision: DeleteGroupDecision = canDeleteGroup({
    isClassroomEditor: allowed,
    isGroupCreator,
    groupMode: classroom.groupMode,
    submissionCount,
  });
  return { group, classroom, submissionCount, isClassroomEditor: allowed, decision };
}

/**
 * R2 keys of everything that disappears with the given to-dos: submission files, teacher
 * attachments and work page files. Call INSIDE the delete transaction, right before the DELETE, then pass the
 * result to cleanupR2Objects after the transaction commits.
 */
export async function collectFileKeys(tx: DbLike, input: { todoIds: string[] }): Promise<string[]> {
  if (input.todoIds.length === 0) return [];
  const [fileRows, attachmentRows, pageFileRows] = await Promise.all([
    tx
      .select({ key: submissionFiles.fileKey })
      .from(submissionFiles)
      .innerJoin(submissions, eq(submissions.id, submissionFiles.submissionId))
      .where(inArray(submissions.todoId, input.todoIds)),
    tx
      .select({ key: todoAttachments.fileKey })
      .from(todoAttachments)
      .where(inArray(todoAttachments.todoId, input.todoIds)),
    // Work page files cascade with their to-do (261004-01i); submissions may share the same keys.
    tx
      .select({ key: workPageFiles.fileKey })
      .from(workPageFiles)
      .innerJoin(workPages, eq(workPages.id, workPageFiles.workPageId))
      .where(inArray(workPages.todoId, input.todoIds)),
  ]);
  return [...new Set([...fileRows, ...attachmentRows, ...pageFileRows].map((r) => r.key).filter(Boolean))];
}

/** classroomId of a phase; throws when the phase does not exist. */
export async function getPhaseClassroomId(phaseId: string): Promise<string> {
  const phase = await db.query.phases.findFirst({
    where: eq(phases.id, phaseId),
    columns: { classroomId: true },
  });
  if (!phase) throw new Error('Phase not found');
  return phase.classroomId;
}

/**
 * Makes group_phase_progress consistent for every group of a classroom
 * (see planProgressSync for the rules). Call after phase create / reorder /
 * archive / restore and after group create.
 */
export async function syncClassroomProgress(tx: DbLike, classroomId: string) {
  const phaseRows = await tx
    .select({ id: phases.id })
    .from(phases)
    .where(and(eq(phases.classroomId, classroomId), eq(phases.isArchived, false)))
    .orderBy(asc(phases.orderIndex), asc(phases.createdAt));
  const phaseIds = phaseRows.map((p) => p.id);

  const groupRows = await tx
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.classroomId, classroomId));
  if (phaseIds.length === 0 || groupRows.length === 0) return;
  const groupIds = groupRows.map((g) => g.id);

  const progressRows = await tx
    .select({
      groupId: groupPhaseProgress.groupId,
      phaseId: groupPhaseProgress.phaseId,
      status: groupPhaseProgress.status,
    })
    .from(groupPhaseProgress)
    .where(inArray(groupPhaseProgress.groupId, groupIds));

  // Submission existence per (group, phase). To-dos are per group, so todos.group_id
  // is the owning group of every submission on that to-do.
  const submissionRows = await tx
    .selectDistinct({ groupId: todos.groupId, phaseId: todos.phaseId })
    .from(submissions)
    .innerJoin(todos, eq(todos.id, submissions.todoId))
    .where(inArray(todos.phaseId, phaseIds));

  const syncGroups: ProgressSyncGroup[] = groupIds.map((groupId) => ({
    groupId,
    rows: progressRows
      .filter((r) => r.groupId === groupId)
      .map((r) => ({ phaseId: r.phaseId, status: r.status })),
    phaseIdsWithSubmissions: submissionRows
      .filter((r) => r.groupId === groupId)
      .map((r) => r.phaseId),
  }));

  const upserts = planProgressSync({ phaseIds, groups: syncGroups });
  if (upserts.length === 0) return;

  await tx
    .insert(groupPhaseProgress)
    .values(upserts)
    .onConflictDoUpdate({
      target: [groupPhaseProgress.groupId, groupPhaseProgress.phaseId],
      set: { status: sql`excluded.status`, updatedAt: new Date() },
    });
}
