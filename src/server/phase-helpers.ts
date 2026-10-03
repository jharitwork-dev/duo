// Shared server helpers for classroom-level phases (plain module — not a server action file).

import { db } from '@/db';
import { classrooms } from '@/db/schema/classrooms';
import { groups } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { submissions } from '@/db/schema/submissions';
import { groupPhaseProgress } from '@/db/schema/groupPhaseProgress';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getCurrentRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { planProgressSync, type ProgressSyncGroup } from '@/lib/phase-progress';

export type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Passes for the classroom owner (classrooms.createdBy) or a superadmin.
 * Returns the classroom row; throws otherwise.
 */
export async function assertClassroomEditor(classroomId: string, userId: string) {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
  });
  if (!classroom) throw new Error('Classroom not found or not authorized');
  if (classroom.createdBy === userId) return classroom;
  const role = await getCurrentRole();
  if (role === ROLES.SUPERADMIN) return classroom;
  throw new Error('Classroom not found or not authorized');
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
