import { db } from '@/db';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { groups } from '@/db/schema/groups';
import { groupPhaseProgress, type PhaseStatus } from '@/db/schema/groupPhaseProgress';
import { eq, and, asc } from 'drizzle-orm';
import { resolveGroupPhaseStatuses } from '@/lib/node-path';
import { sortTodosByDeadline } from '@/lib/todo-order';

/**
 * The classroom's non-archived phases (same list for every group) with THIS group's
 * status (group_phase_progress, missing row -> default rule) and THIS group's
 * non-archived to-dos. Same name and shape the student UI has always used.
 * Returns [] when the group does not exist.
 */
export async function getActivePhases(groupId: string) {
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    columns: { classroomId: true },
  });
  if (!group) return [];

  const [phaseRows, progressRows] = await Promise.all([
    db.query.phases.findMany({
      where: and(eq(phases.classroomId, group.classroomId), eq(phases.isArchived, false)),
      orderBy: [asc(phases.orderIndex), asc(phases.createdAt)],
      with: {
        todos: {
          where: and(eq(todos.groupId, groupId), eq(todos.isArchived, false)),
          orderBy: [asc(todos.orderIndex), asc(todos.createdAt)],
          // Teacher attachment metadata for the edit form (261004-gid); file keys are never exposed.
          with: {
            attachments: {
              columns: { id: true, fileName: true, contentType: true, fileSize: true },
              orderBy: (a, { asc: byAsc }) => [byAsc(a.createdAt)],
            },
          },
        },
      },
    }),
    db
      .select({ phaseId: groupPhaseProgress.phaseId, status: groupPhaseProgress.status })
      .from(groupPhaseProgress)
      .where(eq(groupPhaseProgress.groupId, groupId)),
  ]);

  const statuses = resolveGroupPhaseStatuses(phaseRows, progressRows);
  // D-3' (261004-j6h): deadline ascending, undated last by order_index.
  return phaseRows.map((phase) => ({
    ...phase,
    todos: sortTodosByDeadline(phase.todos),
    status: statuses[phase.id] as PhaseStatus,
  }));
}

/** The classroom's non-archived phases in order (no to-dos, no per-group status). */
export async function getClassroomPhases(classroomId: string) {
  return db.query.phases.findMany({
    where: and(eq(phases.classroomId, classroomId), eq(phases.isArchived, false)),
    orderBy: [asc(phases.orderIndex), asc(phases.createdAt)],
  });
}

/** Archived phases of a classroom (for the restore UI). */
export async function getArchivedPhases(classroomId: string) {
  return db.query.phases.findMany({
    where: and(eq(phases.classroomId, classroomId), eq(phases.isArchived, true)),
    orderBy: [asc(phases.orderIndex), asc(phases.createdAt)],
  });
}

/**
 * One group's status for one phase: the explicit progress row, or the default rule
 * (first non-archived classroom phase = active, everything else = locked).
 */
export async function getGroupPhaseStatus(groupId: string, phaseId: string): Promise<PhaseStatus> {
  const row = await db.query.groupPhaseProgress.findFirst({
    where: and(eq(groupPhaseProgress.groupId, groupId), eq(groupPhaseProgress.phaseId, phaseId)),
    columns: { status: true },
  });
  if (row) return row.status;

  const phase = await db.query.phases.findFirst({
    where: eq(phases.id, phaseId),
    columns: { classroomId: true },
  });
  if (!phase) return 'locked';
  const first = await db.query.phases.findFirst({
    where: and(eq(phases.classroomId, phase.classroomId), eq(phases.isArchived, false)),
    orderBy: [asc(phases.orderIndex), asc(phases.createdAt)],
    columns: { id: true },
  });
  return first?.id === phaseId ? 'active' : 'locked';
}
