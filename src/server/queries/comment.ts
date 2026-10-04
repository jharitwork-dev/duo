// Comment thread read models (quick task 261004-fgj).

import { db } from '@/db';
import { comments, commentReads } from '@/db/schema/comments';
import { submissions } from '@/db/schema/submissions';
import { groupMembers } from '@/db/schema/groups';
import { todos } from '@/db/schema/todos';
import { workPages } from '@/db/schema/workPages';
import { and, asc, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  COMMENT_LIST_LIMIT,
  hasUnreadTeacherComments,
  toCommentView,
  visibleCommentCount,
  type CommentThreadData,
} from '@/lib/comment-thread';
import { getUserDirectory } from '@/lib/user-directory';
import { isInSubmissionScope } from '@/server/queries/submission';
import { assertGroupEditor } from '@/server/phase-helpers';
import {
  resolveCommentThread,
  type CommentThreadHints,
  type ResolvedCommentThread,
} from '@/server/comment-access';

/**
 * Builds the thread DTO for an already-authorized thread (shared by getCommentThread and the comment
 * actions). Latest COMMENT_LIST_LIMIT comments, oldest first. Author identity is public name +
 * avatar only (never the email), for every viewer.
 */
export async function buildCommentThread(thread: ResolvedCommentThread, viewerId: string): Promise<CommentThreadData> {
  const now = new Date();
  if (!thread.page) return { comments: [], count: 0, nowIso: now.toISOString() };

  const [newestFirst, submissionRows] = await Promise.all([
    db
      .select()
      .from(comments)
      .where(eq(comments.workPageId, thread.page.id))
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(COMMENT_LIST_LIMIT),
    db
      .select({ id: submissions.id, groupId: submissions.groupId, submittedBy: submissions.submittedBy })
      .from(submissions)
      .where(eq(submissions.todoId, thread.todo.id))
      .orderBy(asc(submissions.createdAt)),
  ]);
  const rows = newestFirst.reverse();
  const scopedIds = submissionRows
    .filter((s) => isInSubmissionScope(s, thread.todo.submissionMode, thread.owner.groupId, thread.owner.userId ?? ''))
    .map((s) => s.id);

  const users = await getUserDirectory(rows.map((r) => r.userId));
  const directory = new Map<string, { publicName: string; imageUrl: string | null }>();
  for (const [id, u] of users) directory.set(id, { publicName: u.publicName, imageUrl: u.imageUrl });

  const views = rows.map((row) =>
    toCommentView(row, {
      viewerId,
      viewerIsEditor: thread.isEditor,
      now,
      directory,
      submissionIdsOldestFirst: scopedIds,
    }),
  );
  return { comments: views, count: visibleCommentCount(views), nowIso: now.toISOString() };
}

/** Server-rendered initial thread for the to-do pages. Throws when the viewer has no access. */
export async function getCommentThread(
  todoId: string,
  userId: string,
  hints: CommentThreadHints = {},
): Promise<CommentThreadData> {
  const thread = await resolveCommentThread(todoId, userId, hints);
  if (thread.needsStudent) return { comments: [], count: 0, nowIso: new Date().toISOString() };
  return buildCommentThread(thread, userId);
}

/**
 * Student home node path: to-dos whose thread has a non-deleted teacher comment newer than the student's
 * last visit. Fixed number of queries (member, pages, teacher comments, reads). [] for non-members.
 */
export async function getUnreadTeacherCommentTodoIds(
  groupId: string,
  userId: string,
  todoList: { id: string; submissionMode: 'group' | 'individual' }[],
): Promise<string[]> {
  if (todoList.length === 0) return [];
  const member = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    columns: { id: true },
  });
  if (!member) return [];

  const modeOf = new Map(todoList.map((t) => [t.id, t.submissionMode]));
  const pageRows = await db
    .select({ id: workPages.id, todoId: workPages.todoId, userId: workPages.userId })
    .from(workPages)
    .where(
      and(
        inArray(workPages.todoId, [...modeOf.keys()]),
        eq(workPages.groupId, groupId),
        or(isNull(workPages.userId), eq(workPages.userId, userId)),
      ),
    );
  // The student's own thread per to-do: the group page (group to-do) or their page (individual).
  const pages = pageRows.filter((p) => (modeOf.get(p.todoId) === 'group' ? p.userId === null : p.userId === userId));
  if (pages.length === 0) return [];
  const pageIds = pages.map((p) => p.id);

  const [teacherComments, reads] = await Promise.all([
    db
      .select({
        workPageId: comments.workPageId,
        authorRole: comments.authorRole,
        createdAt: comments.createdAt,
        deletedAt: comments.deletedAt,
      })
      .from(comments)
      .where(and(inArray(comments.workPageId, pageIds), eq(comments.authorRole, 'teacher'), isNull(comments.deletedAt))),
    db
      .select({ workPageId: commentReads.workPageId, lastSeenAt: commentReads.lastSeenAt })
      .from(commentReads)
      .where(and(eq(commentReads.userId, userId), inArray(commentReads.workPageId, pageIds))),
  ]);
  const lastSeen = new Map(reads.map((r) => [r.workPageId, r.lastSeenAt]));

  return pages
    .filter((p) =>
      hasUnreadTeacherComments(
        teacherComments.filter((c) => c.workPageId === p.id),
        lastSeen.get(p.id) ?? null,
      ),
    )
    .map((p) => p.todoId);
}

/**
 * Teacher group page: non-deleted comment count per to-do of the group (all threads of the to-do).
 * Throws for non-editors.
 */
export async function getGroupCommentCounts(groupId: string, userId: string): Promise<Record<string, number>> {
  await assertGroupEditor(groupId, userId);
  const rows = await db
    .select({ todoId: workPages.todoId, n: count(comments.id) })
    .from(comments)
    .innerJoin(workPages, eq(workPages.id, comments.workPageId))
    .innerJoin(todos, eq(todos.id, workPages.todoId))
    .where(and(eq(todos.groupId, groupId), isNull(comments.deletedAt)))
    .groupBy(workPages.todoId);
  return Object.fromEntries(rows.map((r) => [r.todoId, Number(r.n)]));
}
