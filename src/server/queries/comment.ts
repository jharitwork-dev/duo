// Comment thread read models (quick task 261004-fgj).

import { db } from '@/db';
import { comments } from '@/db/schema/comments';
import { submissions } from '@/db/schema/submissions';
import { asc, desc, eq } from 'drizzle-orm';
import {
  COMMENT_LIST_LIMIT,
  toCommentView,
  visibleCommentCount,
  type CommentThreadData,
} from '@/lib/comment-thread';
import { getUserDirectory } from '@/lib/user-directory';
import { isInSubmissionScope } from '@/server/queries/submission';
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
