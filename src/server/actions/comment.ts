'use server';

// Task discussion thread actions (quick task 261004-fgj). Every export first resolves the caller via
// getCurrentUserId() and then authorizes through resolveCommentThread( (classroom editors + the thread's
// group / student only). Expected errors are returned; authorization failures throw.
//
// No revalidatePath here: a server-action revalidation re-renders the whole to-do page, including the
// autosaving work page editor. The thread component refreshes itself from the returned list instead.

import { z } from 'zod';
import { db } from '@/db';
import { comments, commentReads } from '@/db/schema/comments';
import { submissions } from '@/db/schema/submissions';
import { desc, eq, sql } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { actionError, type ActionResult } from '@/lib/action-result';
import {
  canDeleteComment,
  canEditComment,
  normalizeCommentBody,
  type CommentThreadData,
} from '@/lib/comment-thread';
import { isInSubmissionScope } from '@/server/queries/submission';
import { buildCommentThread } from '@/server/queries/comment';
import { resolveCommentThread, type ResolvedCommentThread } from '@/server/comment-access';
import { getOrCreatePage } from '@/server/work-page-access';

const NOT_AUTHORIZED = 'To-do not found or not authorized';
const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';
const ERR_BODY = 'ข้อความต้องมี 1–2000 ตัวอักษร';
const ERR_EDIT_WINDOW = 'แก้ไขได้ภายใน 15 นาทีหลังส่ง';
const ERR_NOT_FOUND = 'ไม่พบความคิดเห็น';
const ERR_STUDENT = 'เลือกนักเรียนก่อน';

const id = z.string().min(1).max(64);
const threadSchema = z.object({
  todoId: id,
  groupId: id.optional().nullable(),
  studentId: id.optional().nullable(),
});
const postSchema = threadSchema.extend({ body: z.string().max(20_000) });
const editSchema = z.object({ commentId: id, body: z.string().max(20_000) });
const deleteSchema = z.object({ commentId: id });

type ThreadResult = ActionResult<CommentThreadData>;

/** Loads a comment with its work page (no authorization: callers resolve the thread next). */
async function loadComment(commentId: string) {
  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
    with: { workPage: true },
  });
  return comment?.workPage ? { ...comment, workPage: comment.workPage } : null;
}

/** The resolved thread must be the comment's own page (never trust ids across threads). */
function assertSameThread(
  thread: Awaited<ReturnType<typeof resolveCommentThread>>,
  workPageId: string | null,
): ResolvedCommentThread {
  if (thread.needsStudent || !thread.page || thread.page.id !== workPageId) throw new Error(NOT_AUTHORIZED);
  return thread;
}

export async function listComments(input: z.infer<typeof threadSchema>): Promise<ThreadResult> {
  const userId = await getCurrentUserId();
  const parsed = threadSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { todoId, groupId, studentId } = parsed.data;

  const thread = await resolveCommentThread(todoId, userId, { groupId, studentId });
  if (thread.needsStudent) return actionError(ERR_STUDENT);
  // Never creates a page: an empty thread is just an empty list.
  return { success: true, ...(await buildCommentThread(thread, userId)) };
}

export async function postComment(input: z.infer<typeof postSchema>): Promise<ThreadResult> {
  const userId = await getCurrentUserId();
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { todoId, groupId, studentId } = parsed.data;

  const thread = await resolveCommentThread(todoId, userId, { groupId, studentId });
  if (thread.needsStudent) return actionError(ERR_STUDENT);
  const normalized = normalizeCommentBody(parsed.data.body);
  if (!normalized.ok) return actionError(ERR_BODY);

  const page = await db.transaction(async (tx) => {
    // The page is the thread: create it on demand without marking the commenter as its last editor.
    const workPage = await getOrCreatePage(tx, todoId, thread.owner, userId, { markAuthor: false });
    const submissionRows = await tx
      .select({ id: submissions.id, groupId: submissions.groupId, submittedBy: submissions.submittedBy })
      .from(submissions)
      .where(eq(submissions.todoId, todoId))
      .orderBy(desc(submissions.createdAt));
    const latest = submissionRows.find((row) =>
      isInSubmissionScope(row, thread.todo.submissionMode, thread.owner.groupId, thread.owner.userId ?? ''),
    );
    await tx.insert(comments).values({
      workPageId: workPage.id,
      submissionId: latest?.id ?? null,
      userId,
      authorRole: thread.isEditor ? 'teacher' : 'student',
      content: normalized.body,
    });
    return workPage;
  });

  const refreshed: ResolvedCommentThread = { ...thread, page };
  return { success: true, ...(await buildCommentThread(refreshed, userId)) };
}

export async function editComment(input: z.infer<typeof editSchema>): Promise<ThreadResult> {
  const userId = await getCurrentUserId();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);

  const comment = await loadComment(parsed.data.commentId);
  if (!comment) return actionError(ERR_NOT_FOUND);
  const thread = assertSameThread(
    await resolveCommentThread(comment.workPage.todoId, userId, {
      groupId: comment.workPage.groupId,
      studentId: comment.workPage.userId,
    }),
    comment.workPageId,
  );
  if (comment.deletedAt) return actionError(ERR_NOT_FOUND);
  if (comment.userId !== userId) throw new Error(NOT_AUTHORIZED);
  if (!canEditComment(comment, userId, new Date())) return actionError(ERR_EDIT_WINDOW);

  const normalized = normalizeCommentBody(parsed.data.body);
  if (!normalized.ok) return actionError(ERR_BODY);

  const now = new Date();
  await db
    .update(comments)
    .set({ content: normalized.body, editedAt: now, updatedAt: now })
    .where(eq(comments.id, comment.id));
  return { success: true, ...(await buildCommentThread(thread, userId)) };
}

export async function deleteComment(input: z.infer<typeof deleteSchema>): Promise<ThreadResult> {
  const userId = await getCurrentUserId();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);

  const comment = await loadComment(parsed.data.commentId);
  if (!comment) return actionError(ERR_NOT_FOUND);
  const thread = assertSameThread(
    await resolveCommentThread(comment.workPage.todoId, userId, {
      groupId: comment.workPage.groupId,
      studentId: comment.workPage.userId,
    }),
    comment.workPageId,
  );
  if (comment.deletedAt) return actionError(ERR_NOT_FOUND);
  if (!canDeleteComment(comment, userId, thread.isEditor)) throw new Error(NOT_AUTHORIZED);

  const now = new Date();
  await db.update(comments).set({ deletedAt: now, updatedAt: now }).where(eq(comments.id, comment.id));
  return { success: true, ...(await buildCommentThread(thread, userId)) };
}

export async function markCommentsSeen(input: z.infer<typeof threadSchema>): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const parsed = threadSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { todoId, groupId, studentId } = parsed.data;

  const thread = await resolveCommentThread(todoId, userId, { groupId, studentId });
  if (thread.needsStudent || !thread.page) return { success: true };

  await db
    .insert(commentReads)
    .values({ userId, workPageId: thread.page.id, lastSeenAt: sql`now()` })
    .onConflictDoUpdate({
      target: [commentReads.userId, commentReads.workPageId],
      set: { lastSeenAt: sql`now()` },
    });
  return { success: true };
}
