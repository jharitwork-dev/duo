import { db } from '@/db';
import { todos } from '@/db/schema/todos';
import { groupMembers } from '@/db/schema/groups';
import { classroomMembers } from '@/db/schema/classrooms';
import { submissions } from '@/db/schema/submissions';
import { comments } from '@/db/schema/comments';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import { statusFromSubmission, type SubmissionStatus } from '@/lib/node-path';
import { getGroupPhaseStatus } from '@/server/queries/phase';
import type { WorkPageDoc } from '@/lib/work-page';
import { summarizeTodoReview, type TodoReviewSummary } from '@/lib/todo-review-status';
import { assertGroupEditor } from '@/server/phase-helpers';

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
 * Verifies a student can act on a to-do: the to-do and its phase are not archived, the
 * student is a member of the classroom AND of the group that owns the to-do (todo.groupId).
 * `phase.status` is this group's status (group_phase_progress / default rule), so
 * isPhaseViewable(access.phase) keeps working unchanged.
 */
export async function resolveStudentTodoAccess(todoId: string, userId: string) {
  const todo = await db.query.todos.findFirst({
    where: and(eq(todos.id, todoId), eq(todos.isArchived, false)),
    with: {
      attachments: true,
      phase: true,
      group: true,
    },
  });
  if (!todo || todo.phase.isArchived) return null;

  const groupId = todo.groupId;
  const classroomId = todo.group.classroomId;

  const classroomMembership = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.classroomId, classroomId),
      eq(classroomMembers.userId, userId),
    ),
    columns: { id: true },
  });
  if (!classroomMembership) return null;
  if (!(await isGroupMember(groupId, userId))) return null;

  const status = await getGroupPhaseStatus(groupId, todo.phaseId);
  return { todo, phase: { ...todo.phase, status }, groupId, classroomId };
}

export interface TodoSubmissionSummary {
  /** Latest in-scope submission status. */
  status: SubmissionStatus;
  /** OLDEST in-scope submission time (drives on_time / late, 261004-03i). */
  firstSubmittedAt: Date | null;
}

/**
 * Latest status + first submission time for each to-do on the student home path (one query).
 * Returns {} when the user is not in the group.
 */
export async function getTodoSubmissionSummaries(
  groupId: string,
  userId: string,
  todoList: { id: string; submissionMode: SubmissionMode }[],
): Promise<Record<string, TodoSubmissionSummary>> {
  if (todoList.length === 0) return {};
  if (!(await isGroupMember(groupId, userId))) return {};

  const rows = await db
    .select({
      todoId: submissions.todoId,
      groupId: submissions.groupId,
      submittedBy: submissions.submittedBy,
      status: submissions.status,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(inArray(submissions.todoId, todoList.map((t) => t.id)))
    .orderBy(desc(submissions.createdAt));

  const result: Record<string, TodoSubmissionSummary> = {};
  for (const todo of todoList) {
    const scoped = rows.filter(
      (row) =>
        row.todoId === todo.id && isInSubmissionScope(row, todo.submissionMode, groupId, userId),
    );
    result[todo.id] = {
      status: statusFromSubmission(scoped[0]?.status),
      firstSubmittedAt: scoped.length > 0 ? scoped[scoped.length - 1].createdAt : null,
    };
  }
  return result;
}

/** Latest-submission status for each to-do (wrapper over getTodoSubmissionSummaries). */
export async function getTodoSubmissionStatuses(
  groupId: string,
  userId: string,
  todoList: { id: string; submissionMode: SubmissionMode }[],
): Promise<Record<string, SubmissionStatus>> {
  const summaries = await getTodoSubmissionSummaries(groupId, userId, todoList);
  return Object.fromEntries(Object.entries(summaries).map(([id, s]) => [id, s.status]));
}

/**
 * Teacher group page: review summary per to-do of the group (latest submission per owner; see
 * summarizeTodoReview). Throws for non-editors. To-dos without submissions are omitted (= 'none').
 */
export async function getGroupTodoReviewStatuses(
  groupId: string,
  userId: string,
): Promise<Record<string, TodoReviewSummary>> {
  await assertGroupEditor(groupId, userId);
  const rows = await db
    .select({
      todoId: submissions.todoId,
      submissionMode: todos.submissionMode,
      groupId: submissions.groupId,
      submittedBy: submissions.submittedBy,
      status: submissions.status,
    })
    .from(submissions)
    .innerJoin(todos, eq(todos.id, submissions.todoId))
    .where(eq(todos.groupId, groupId))
    .orderBy(desc(submissions.createdAt));

  const byTodo = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byTodo.get(row.todoId) ?? [];
    list.push(row);
    byTodo.set(row.todoId, list);
  }
  const result: Record<string, TodoReviewSummary> = {};
  for (const [todoId, list] of byTodo) {
    result[todoId] = summarizeTodoReview(list, list[0].submissionMode, groupId);
  }
  return result;
}

export interface SubmissionHistoryEntry {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  /** Bumped by "อัปเดตงานที่ส่ง" while pending (261004-03i). */
  updatedAt: Date;
  attempt: number;
  files: { id: string; fileName: string; contentType: string; fileSize: number }[];
  /** Latest reviewer comment on this submission, if any (read-only). */
  reviewerComment: string | null;
  /** Work page snapshot (null for legacy file-only submissions). */
  content: WorkPageDoc | null;
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
    with: {
      files: true,
      // Read-only: latest non-deleted TEACHER comment tied to each submission (261004-fgj).
      // Phase 4 review dialogs must post their คำแนะนำ through the comment insert path with
      // submissionId = the reviewed submission and authorRole = 'teacher' (see actions/comment.ts).
      comments: {
        where: and(eq(comments.authorRole, 'teacher'), isNull(comments.deletedAt)),
        orderBy: [desc(comments.createdAt)],
        limit: 1,
        columns: { content: true },
      },
    },
  });

  const scoped = rows.filter((row) =>
    isInSubmissionScope(row, todo.submissionMode, groupId, userId),
  );

  const history: SubmissionHistoryEntry[] = scoped.map((row, index) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attempt: scoped.length - index,
    files: row.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      contentType: f.contentType,
      fileSize: f.fileSize,
    })),
    reviewerComment: row.comments[0]?.content ?? null,
    content: (row.content as WorkPageDoc | null) ?? null,
  }));

  return { todo, phase, groupId, classroomId, submissions: history };
}
