// Comment thread access (quick task 261004-fgj) — plain module, not a server action file.
// Visibility: classroom editors + the thread's group (group to-do) or student (individual to-do).
// Deliberately independent of work page edit locks, submission status and deadlines (261004-03i):
// students may comment before and after submitting.

import { db } from '@/db';
import { comments } from '@/db/schema/comments';
import { groupMembers } from '@/db/schema/groups';
import { submissions } from '@/db/schema/submissions';
import { workPages } from '@/db/schema/workPages';
import { and, eq } from 'drizzle-orm';
import { resolveThreadOwner, type ThreadOwner } from '@/lib/comment-thread';
import { authorizeTodoViewer, findPage, type WorkPageRow } from '@/server/work-page-access';
import type { DbLike } from '@/server/phase-helpers';

const NOT_AUTHORIZED = 'To-do not found or not authorized';

export type CommentThreadHints = { groupId?: string | null; studentId?: string | null };

type ViewerTodo = Awaited<ReturnType<typeof authorizeTodoViewer>>['todo'];

export type ResolvedCommentThread = {
  needsStudent: false;
  viewerKind: 'editor' | 'student';
  isEditor: boolean;
  todo: ViewerTodo;
  classroomId: string;
  owner: ThreadOwner;
  /** null until the first comment (or autosave / upload) creates the work page. */
  page: WorkPageRow | null;
};

export type CommentThreadResolution =
  | ResolvedCommentThread
  | { needsStudent: true; viewerKind: 'editor'; isEditor: true; todo: ViewerTodo; classroomId: string };

/** A student is "known" to an individual to-do when they are in its group or already have a page / submission. */
async function isKnownStudent(todoId: string, groupId: string, studentId: string): Promise<boolean> {
  const [member, page, submission] = await Promise.all([
    db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, studentId)),
      columns: { id: true },
    }),
    db.query.workPages.findFirst({
      where: and(eq(workPages.todoId, todoId), eq(workPages.userId, studentId)),
      columns: { id: true },
    }),
    db.query.submissions.findFirst({
      where: and(eq(submissions.todoId, todoId), eq(submissions.submittedBy, studentId)),
      columns: { id: true },
    }),
  ]);
  return !!(member || page || submission);
}

/**
 * Resolves (and authorizes) the comment thread a user may read / post in. Throws for outsiders
 * (authorizeTodoViewer), for students on archived to-dos / phases, and for any request for a thread
 * the viewer may not see. Editors on an individual to-do without a studentId get `needsStudent`.
 */
export async function resolveCommentThread(
  todoId: string,
  userId: string,
  hints: CommentThreadHints = {},
): Promise<CommentThreadResolution> {
  const viewer = await authorizeTodoViewer(todoId, userId);
  const { todo, classroomId } = viewer;
  if (viewer.kind === 'student' && (todo.isArchived || todo.phase.isArchived)) throw new Error(NOT_AUTHORIZED);

  const known =
    viewer.kind === 'editor' && todo.submissionMode === 'individual' && hints.studentId
      ? await isKnownStudent(todo.id, todo.groupId, hints.studentId)
      : false;

  const resolved = resolveThreadOwner({
    viewerKind: viewer.kind,
    viewerId: userId,
    mode: todo.submissionMode,
    todoGroupId: todo.groupId,
    groupId: hints.groupId,
    studentId: hints.studentId,
    isKnownStudent: known,
  });
  if (!resolved.ok) {
    if (resolved.error === 'student_required' && viewer.kind === 'editor') {
      return { needsStudent: true, viewerKind: 'editor', isEditor: true, todo, classroomId };
    }
    throw new Error(NOT_AUTHORIZED);
  }

  const page = await findPage(db, todoId, resolved.owner);
  return {
    needsStudent: false,
    viewerKind: viewer.kind,
    isEditor: viewer.kind === 'editor',
    todo,
    classroomId,
    owner: resolved.owner,
    page,
  };
}

/**
 * Inserts one thread comment (shared by postComment and the review actions, 261004-gic). `content` must already be
 * normalised (normalizeCommentBody). Callers authorize first; this only writes. Returns the inserted row.
 */
export async function insertThreadComment(
  tx: DbLike,
  v: {
    workPageId: string;
    submissionId: string | null;
    userId: string;
    authorRole: 'teacher' | 'student';
    content: string;
  },
) {
  const [row] = await tx
    .insert(comments)
    .values({
      workPageId: v.workPageId,
      submissionId: v.submissionId,
      userId: v.userId,
      authorRole: v.authorRole,
      content: v.content,
    })
    .returning();
  return row;
}
