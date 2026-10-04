import { db } from '@/db';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { classroomTasks, classroomTaskFiles } from '@/db/schema/classroomTasks';
import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { FileRequirement } from '@/lib/work-page';
import { sortTodosByDeadline } from '@/lib/todo-order';

export interface ClassroomTaskView {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  notes: string | null;
  submissionMode: 'group' | 'individual';
  fileRequirement: FileRequirement;
  deadline: Date | null;
  orderIndex: number;
  createdAt: Date;
  /** File metadata only — R2 keys are never exposed. */
  files: { id: string; fileName: string; contentType: string; fileSize: number }[];
  copyCount: number;
  overriddenCopyCount: number;
}

/**
 * Classroom-level tasks (261004-j6h) of every phase of a classroom, keyed by phase id, each list
 * deadline-ordered (undated last). Callers must have authorized the classroom already.
 */
export async function getClassroomTasksByPhase(classroomId: string): Promise<Record<string, ClassroomTaskView[]>> {
  const phaseRows = await db.select({ id: phases.id }).from(phases).where(eq(phases.classroomId, classroomId));
  const phaseIds = phaseRows.map((p) => p.id);
  if (phaseIds.length === 0) return {};

  const tasks = await db.select().from(classroomTasks).where(inArray(classroomTasks.phaseId, phaseIds));
  if (tasks.length === 0) return {};
  const taskIds = tasks.map((t) => t.id);

  const [fileRows, copyRows] = await Promise.all([
    db
      .select({
        id: classroomTaskFiles.id,
        classroomTaskId: classroomTaskFiles.classroomTaskId,
        fileName: classroomTaskFiles.fileName,
        contentType: classroomTaskFiles.contentType,
        fileSize: classroomTaskFiles.fileSize,
      })
      .from(classroomTaskFiles)
      .where(inArray(classroomTaskFiles.classroomTaskId, taskIds))
      .orderBy(asc(classroomTaskFiles.createdAt)),
    db
      .select({
        classroomTaskId: todos.classroomTaskId,
        copies: count(),
        overridden: sql<number>`count(*) filter (where cardinality(${todos.overriddenFields}) > 0)`.mapWith(Number),
      })
      .from(todos)
      .where(inArray(todos.classroomTaskId, taskIds))
      .groupBy(todos.classroomTaskId),
  ]);

  const counts = new Map(copyRows.map((r) => [r.classroomTaskId, r]));
  const result: Record<string, ClassroomTaskView[]> = {};
  for (const t of tasks) {
    const c = counts.get(t.id);
    const view: ClassroomTaskView = {
      id: t.id,
      phaseId: t.phaseId,
      title: t.title,
      description: t.description,
      notes: t.notes,
      submissionMode: t.submissionMode,
      fileRequirement: t.fileRequirement,
      deadline: t.deadline,
      orderIndex: t.orderIndex,
      createdAt: t.createdAt,
      files: fileRows
        .filter((f) => f.classroomTaskId === t.id)
        .map(({ id, fileName, contentType, fileSize }) => ({ id, fileName, contentType, fileSize })),
      copyCount: c?.copies ?? 0,
      overriddenCopyCount: c?.overridden ?? 0,
    };
    (result[t.phaseId] ??= []).push(view);
  }
  for (const phaseId of Object.keys(result)) result[phaseId] = sortTodosByDeadline(result[phaseId]);
  return result;
}
