import { db } from '@/db';
import { todos } from '@/db/schema/todos';
import { groupMembers } from '@/db/schema/groups';
import { classroomMembers } from '@/db/schema/classrooms';
import { submissions } from '@/db/schema/submissions';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { statusFromSubmission, type SubmissionStatus } from '@/lib/node-path';

type SubmissionMode = 'group' | 'individual';

interface ScopedRow {
  groupId: string | null;
  submittedBy: string;
}

/**
 * Submission scope rule (SUB-04 / SUB-05):
 * group to-do → one submission for the whole group; individual → per student.
 */
export function isInSubmissionScope(
  row: ScopedRow,
  mode: SubmissionMode,
  groupId: string,
  userId: string,
): boolean {
  return mode === 'group' ? row.groupId === groupId : row.submittedBy === userId;
}

async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const row = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    columns: { id: true },
  });
  return !!row;
}

/**
 * Verifies a student can act on a to-do: the to-do is not archived, the student is a
 * member of the classroom AND of the group that owns the to-do's phase.
 */
export async function resolveStudentTodoAccess(todoId: string, userId: string) {
  const todo = await db.query.todos.findFirst({
    where: and(eq(todos.id, todoId), eq(todos.isArchived, false)),
    with: {
      attachments: true,
      phase: { with: { group: true } },
    },
  });
  if (!todo || todo.phase.isArchived) return null;

  const groupId = todo.phase.groupId;
  const classroomId = todo.phase.group.classroomId;

  const classroomMembership = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.classroomId, classroomId),
      eq(classroomMembers.userId, userId),
    ),
    columns: { id: true },
  });
  if (!classroomMembership) return null;
  if (!(await isGroupMember(groupId, userId))) return null;

  return { todo, phase: todo.phase, groupId, classroomId };
}

/**
 * Latest-submission status for each to-do on the student home path.
 * Returns {} when the user is not in the group.
 */
export async function getTodoSubmissionStatuses(
  groupId: string,
  userId: string,
  todoList: { id: string; submissionMode: SubmissionMode }[],
): Promise<Record<string, SubmissionStatus>> {
  if (todoList.length === 0) return {};
  if (!(await isGroupMember(groupId, userId))) return {};

  const rows = await db
    .select({
      todoId: submissions.todoId,
      groupId: submissions.groupId,
      submittedBy: submissions.submittedBy,
      status: submissions.status,
    })
    .from(submissions)
    .where(inArray(submissions.todoId, todoList.map((t) => t.id)))
    .orderBy(desc(submissions.createdAt));

  const result: Record<string, SubmissionStatus> = {};
  for (const todo of todoList) {
    const latest = rows.find(
      (row) =>
        row.todoId === todo.id && isInSubmissionScope(row, todo.submissionMode, groupId, userId),
    );
    result[todo.id] = statusFromSubmission(latest?.status);
  }
  return result;
}

export interface SubmissionHistoryEntry {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  attempt: number;
  files: { id: string; fileName: string; contentType: string; fileSize: number }[];
}

/**
 * Submission history for the student to-do page, newest first.
 * `attempt` is the 1-based chronological index (oldest = 1). Null if no access.
 */
export async function getSubmissionHistory(todoId: string, userId: string) {
  const access = await resolveStudentTodoAccess(todoId, userId);
  if (!access) return null;
  const { todo, phase, groupId, classroomId } = access;

  const rows = await db.query.submissions.findMany({
    where: eq(submissions.todoId, todoId),
    orderBy: [desc(submissions.createdAt)],
    with: { files: true },
  });

  const scoped = rows.filter((row) =>
    isInSubmissionScope(row, todo.submissionMode, groupId, userId),
  );

  const history: SubmissionHistoryEntry[] = scoped.map((row, index) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    attempt: scoped.length - index,
    files: row.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      contentType: f.contentType,
      fileSize: f.fileSize,
    })),
  }));

  return { todo, phase, groupId, classroomId, submissions: history };
}
