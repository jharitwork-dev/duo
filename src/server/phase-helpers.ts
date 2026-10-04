// Shared server helpers for classroom-level phases (plain module — not a server action file).

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos, todoAttachments } from '@/db/schema/todos';
import { submissions, submissionFiles } from '@/db/schema/submissions';
import { workPages, workPageFiles } from '@/db/schema/workPages';
import { groupPhaseProgress } from '@/db/schema/groupPhaseProgress';
import { classroomTasks, classroomTaskFiles } from '@/db/schema/classroomTasks';
import { and, asc, count, eq, inArray, isNotNull, max, notInArray, sql } from 'drizzle-orm';
import { getCurrentRole } from '@/lib/auth';
import { decideClassroomAccess } from '@/lib/classroom-access';
import { canDeleteGroup, type DeleteGroupDecision } from '@/lib/group-rules';
import { planProgressSync, type ProgressSyncGroup } from '@/lib/phase-progress';
import { computeOrphanFileKeys } from '@/lib/work-page';
import {
  planClassroomTaskSync,
  type ClassroomTaskSpec,
  type CopyState,
  type TaskFileSpec,
} from '@/lib/classroom-task-sync';

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

/** assertClassroomEditor for the classroom owning a classroom-level task (via its phase). */
export async function assertClassroomTaskEditor(classroomTaskId: string, userId: string) {
  const task = await db.query.classroomTasks.findFirst({ where: eq(classroomTasks.id, classroomTaskId) });
  if (!task) throw new Error(NOT_AUTHORIZED);
  const phase = await db.query.phases.findFirst({ where: eq(phases.id, task.phaseId) });
  if (!phase) throw new Error(NOT_AUTHORIZED);
  const classroom = await assertClassroomEditor(phase.classroomId, userId);
  return { task, phase, classroom };
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
 * R2 keys of everything that disappears with the given to-dos (and classroom tasks): submission files,
 * teacher attachments, work page files and classroom task files. Call INSIDE the delete transaction,
 * right before the DELETE, then pass the result to cleanupR2Objects after the transaction commits.
 *
 * Teacher attachment objects can be shared by several copies of one assignment (261004-gid) and by a
 * classroom task and its copies (261004-j6h): a key that is still referenced by a todo_attachments row
 * OUTSIDE the deleted to-dos or by a classroom_task_files row OUTSIDE the deleted classroom tasks is
 * NOT returned, so deleting one copy (or its phase / group / classroom) never breaks another holder.
 */
export async function collectFileKeys(
  tx: DbLike,
  input: { todoIds: string[]; classroomTaskIds?: string[] },
): Promise<string[]> {
  const todoIds = input.todoIds;
  const taskIds = input.classroomTaskIds ?? [];
  if (todoIds.length === 0 && taskIds.length === 0) return [];
  const [fileRows, attachmentRows, pageFileRows, taskFileRows] = await Promise.all([
    todoIds.length === 0
      ? []
      : tx
          .select({ key: submissionFiles.fileKey })
          .from(submissionFiles)
          .innerJoin(submissions, eq(submissions.id, submissionFiles.submissionId))
          .where(inArray(submissions.todoId, todoIds)),
    todoIds.length === 0
      ? []
      : tx.select({ key: todoAttachments.fileKey }).from(todoAttachments).where(inArray(todoAttachments.todoId, todoIds)),
    // Work page files cascade with their to-do (261004-01i); submissions may share the same keys.
    todoIds.length === 0
      ? []
      : tx
          .select({ key: workPageFiles.fileKey })
          .from(workPageFiles)
          .innerJoin(workPages, eq(workPages.id, workPageFiles.workPageId))
          .where(inArray(workPages.todoId, todoIds)),
    taskIds.length === 0
      ? []
      : tx
          .select({ key: classroomTaskFiles.fileKey })
          .from(classroomTaskFiles)
          .where(inArray(classroomTaskFiles.classroomTaskId, taskIds)),
  ]);
  const sharedKeys = [...new Set([...attachmentRows, ...taskFileRows].map((r) => r.key).filter(Boolean))];
  let orphanSharedKeys = sharedKeys;
  if (sharedKeys.length > 0) {
    const [refAttachments, refTaskFiles] = await Promise.all([
      tx
        .select({ key: todoAttachments.fileKey })
        .from(todoAttachments)
        .where(
          todoIds.length === 0
            ? inArray(todoAttachments.fileKey, sharedKeys)
            : and(inArray(todoAttachments.fileKey, sharedKeys), notInArray(todoAttachments.todoId, todoIds)),
        ),
      tx
        .select({ key: classroomTaskFiles.fileKey })
        .from(classroomTaskFiles)
        .where(
          taskIds.length === 0
            ? inArray(classroomTaskFiles.fileKey, sharedKeys)
            : and(
                inArray(classroomTaskFiles.fileKey, sharedKeys),
                notInArray(classroomTaskFiles.classroomTaskId, taskIds),
              ),
        ),
    ]);
    orphanSharedKeys = computeOrphanFileKeys(
      sharedKeys,
      refAttachments.map((r) => r.key),
      refTaskFiles.map((r) => r.key),
    );
  }
  return [
    ...new Set(
      [...fileRows.map((r) => r.key), ...orphanSharedKeys, ...pageFileRows.map((r) => r.key)].filter(Boolean),
    ),
  ];
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

/**
 * Makes the materialized copies of every classroom-level task (261004-j6h) consistent for every group
 * of a classroom (see planClassroomTaskSync): creates missing copies (incl. for new groups), pushes
 * locked fields to every copy and overridable fields / files to non-overridden copies, and removes
 * copies of tasks that no longer exist (or are in excludeTaskIds): deleted when unsubmitted, detached
 * into ordinary group tasks when submitted.
 *
 * Returns R2 keys that became unreferenced (caller runs cleanupR2Objects AFTER commit) and the ids of
 * groups whose task lists changed (for revalidatePath).
 */
export async function syncClassroomTasks(
  tx: DbLike,
  classroomId: string,
  opts?: { excludeTaskIds?: string[] },
): Promise<{ r2Keys: string[]; groupIds: string[] }> {
  const exclude = new Set(opts?.excludeTaskIds ?? []);
  const [groupRows, phaseRows] = await Promise.all([
    tx.select({ id: groups.id }).from(groups).where(eq(groups.classroomId, classroomId)).orderBy(asc(groups.createdAt)),
    tx.select({ id: phases.id }).from(phases).where(eq(phases.classroomId, classroomId)),
  ]);
  const groupIds = groupRows.map((g) => g.id);
  const phaseIds = phaseRows.map((p) => p.id);
  if (phaseIds.length === 0) return { r2Keys: [], groupIds: [] };

  const [taskRows, copyRows] = await Promise.all([
    tx
      .select()
      .from(classroomTasks)
      .where(inArray(classroomTasks.phaseId, phaseIds))
      .orderBy(asc(classroomTasks.orderIndex), asc(classroomTasks.createdAt)),
    tx
      .select({
        id: todos.id,
        classroomTaskId: todos.classroomTaskId,
        groupId: todos.groupId,
        title: todos.title,
        description: todos.description,
        notes: todos.notes,
        submissionMode: todos.submissionMode,
        fileRequirement: todos.fileRequirement,
        deadline: todos.deadline,
        overriddenFields: todos.overriddenFields,
      })
      .from(todos)
      .where(and(inArray(todos.phaseId, phaseIds), isNotNull(todos.classroomTaskId))),
  ]);
  const tasks = taskRows.filter((t) => !exclude.has(t.id));
  if (tasks.length === 0 && copyRows.length === 0) return { r2Keys: [], groupIds: [] };

  const taskIds = tasks.map((t) => t.id);
  const copyIds = copyRows.map((c) => c.id);
  const [fileRows, copyAttachmentRows, submittedRows] = await Promise.all([
    taskIds.length === 0
      ? []
      : tx
          .select()
          .from(classroomTaskFiles)
          .where(inArray(classroomTaskFiles.classroomTaskId, taskIds))
          .orderBy(asc(classroomTaskFiles.createdAt)),
    copyIds.length === 0
      ? []
      : tx
          .select({ todoId: todoAttachments.todoId, fileKey: todoAttachments.fileKey })
          .from(todoAttachments)
          .where(inArray(todoAttachments.todoId, copyIds)),
    copyIds.length === 0
      ? []
      : tx.selectDistinct({ todoId: submissions.todoId }).from(submissions).where(inArray(submissions.todoId, copyIds)),
  ]);

  const filesByTask = new Map<string, TaskFileSpec[]>();
  for (const f of fileRows) {
    const list = filesByTask.get(f.classroomTaskId) ?? [];
    list.push({
      fileKey: f.fileKey,
      fileName: f.fileName,
      contentType: f.contentType,
      fileSize: f.fileSize,
      uploadedBy: f.uploadedBy,
    });
    filesByTask.set(f.classroomTaskId, list);
  }
  const keysByCopy = new Map<string, string[]>();
  for (const a of copyAttachmentRows) {
    const list = keysByCopy.get(a.todoId) ?? [];
    list.push(a.fileKey);
    keysByCopy.set(a.todoId, list);
  }
  const submitted = new Set(submittedRows.map((r) => r.todoId));

  const specs: ClassroomTaskSpec[] = tasks.map((t) => ({
    id: t.id,
    phaseId: t.phaseId,
    orderIndex: t.orderIndex,
    title: t.title,
    description: t.description,
    notes: t.notes,
    submissionMode: t.submissionMode,
    fileRequirement: t.fileRequirement,
    deadline: t.deadline,
    files: filesByTask.get(t.id) ?? [],
  }));
  const copies: CopyState[] = copyRows.map((c) => ({
    todoId: c.id,
    classroomTaskId: c.classroomTaskId!,
    groupId: c.groupId,
    title: c.title,
    description: c.description,
    notes: c.notes,
    submissionMode: c.submissionMode,
    fileRequirement: c.fileRequirement,
    deadline: c.deadline,
    overriddenFields: c.overriddenFields ?? [],
    attachmentKeys: keysByCopy.get(c.id) ?? [],
    hasSubmission: submitted.has(c.id),
  }));

  const plan = planClassroomTaskSync({ groupIds, tasks: specs, copies });
  const affected = new Set<string>();
  const groupOfCopy = new Map(copyRows.map((c) => [c.id, c.groupId]));
  const r2Keys: string[] = [];

  // 1. Inserts (appended after the group's current tasks in that phase).
  if (plan.inserts.length > 0) {
    const insertPhaseIds = [...new Set(plan.inserts.map((i) => i.phaseId))];
    const maxRows = await tx
      .select({ phaseId: todos.phaseId, groupId: todos.groupId, maxOrder: max(todos.orderIndex) })
      .from(todos)
      .where(and(inArray(todos.phaseId, insertPhaseIds), eq(todos.isArchived, false)))
      .groupBy(todos.phaseId, todos.groupId);
    const nextOrder = new Map(maxRows.map((r) => [`${r.phaseId}\u0000${r.groupId}`, (r.maxOrder ?? -1) + 1]));
    const createdBy = new Map(tasks.map((t) => [t.id, t.createdBy]));

    const values = plan.inserts.map((ins) => {
      const k = `${ins.phaseId}\u0000${ins.groupId}`;
      const orderIndex = nextOrder.get(k) ?? 0;
      nextOrder.set(k, orderIndex + 1);
      return {
        phaseId: ins.phaseId,
        groupId: ins.groupId,
        assignmentId: ins.classroomTaskId,
        classroomTaskId: ins.classroomTaskId,
        ...ins.values,
        orderIndex,
        createdBy: createdBy.get(ins.classroomTaskId) ?? 'system',
      };
    });
    const inserted = await tx
      .insert(todos)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: todos.id, classroomTaskId: todos.classroomTaskId, groupId: todos.groupId });

    const attachmentValues = inserted.flatMap((row) => {
      affected.add(row.groupId);
      const files = filesByTask.get(row.classroomTaskId!) ?? [];
      return files.map((f) => ({ todoId: row.id, ...f }));
    });
    if (attachmentValues.length > 0) await tx.insert(todoAttachments).values(attachmentValues);
  }

  // 2. Field updates.
  const now = new Date();
  for (const u of plan.updates) {
    await tx
      .update(todos)
      .set({ ...u.set, updatedAt: now })
      .where(eq(todos.id, u.todoId));
    affected.add(groupOfCopy.get(u.todoId)!);
  }

  // 3. File sync on non-overridden copies (shared keys; objects are owned by the classroom task).
  if (plan.attachmentInserts.length > 0) {
    await tx.insert(todoAttachments).values(plan.attachmentInserts.map((a) => ({ todoId: a.todoId, ...a.file })));
    for (const a of plan.attachmentInserts) affected.add(groupOfCopy.get(a.todoId)!);
  }
  if (plan.attachmentDeletes.length > 0) {
    const removedKeys = new Set<string>();
    for (const a of plan.attachmentDeletes) {
      await tx
        .delete(todoAttachments)
        .where(and(eq(todoAttachments.todoId, a.todoId), eq(todoAttachments.fileKey, a.fileKey)));
      removedKeys.add(a.fileKey);
      affected.add(groupOfCopy.get(a.todoId)!);
    }
    const keys = [...removedKeys];
    const [refAttachments, refTaskFiles] = await Promise.all([
      tx.select({ key: todoAttachments.fileKey }).from(todoAttachments).where(inArray(todoAttachments.fileKey, keys)),
      tx
        .select({ key: classroomTaskFiles.fileKey })
        .from(classroomTaskFiles)
        .where(inArray(classroomTaskFiles.fileKey, keys)),
    ]);
    r2Keys.push(
      ...computeOrphanFileKeys(
        keys,
        refAttachments.map((r) => r.key),
        refTaskFiles.map((r) => r.key),
      ),
    );
  }

  // 4. Task gone: detach submitted copies (kept as ordinary group tasks), delete the rest.
  if (plan.detaches.length > 0) {
    await tx
      .update(todos)
      .set({ classroomTaskId: null, overriddenFields: sql`'{}'::text[]`, updatedAt: now })
      .where(inArray(todos.id, plan.detaches));
    for (const id of plan.detaches) affected.add(groupOfCopy.get(id)!);
  }
  if (plan.deletes.length > 0) {
    r2Keys.push(...(await collectFileKeys(tx, { todoIds: plan.deletes })));
    await tx.delete(todos).where(inArray(todos.id, plan.deletes));
    for (const id of plan.deletes) affected.add(groupOfCopy.get(id)!);
  }

  return { r2Keys: [...new Set(r2Keys)], groupIds: [...affected] };
}
