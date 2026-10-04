'use server';

// Teacher review actions (quick task 261004-gic): approve / send back the LATEST pending submission of a to-do owner.
// Every export: requireRole(TEACHER, SUPERADMIN) → getCurrentUserId() → assertTodoEditor (throws for non-editors).
//
// Lock order inside the transaction (must match 03i's updateSubmittedWorkPage: page → submission, so no deadlock):
//   1. groups row FOR UPDATE   — serialises approvals within one group, so the "last to-do approved" check
//                                in applyAutoPhaseUnlock cannot be missed by two concurrent approvals (write skew);
//   2. work page row FOR UPDATE (getOrCreatePage lock: true);
//   3. submission row FOR UPDATE (lockReviewTarget) + the latest in-scope submission FOR UPDATE;
// then the UPDATE is guarded by status = 'pending', so a racing student "อัปเดตงานที่ส่ง" (03i) sees reviewed:true.
// createdAt / updatedAt of the submission are never touched (03i lateness / liveIsNewer).
//
// The send-back feedback / optional approval note is stored as a teacher comment tied to the reviewed submission,
// so the fgj thread and the student's "คำแนะนำจากผู้ตรวจ" card both show it.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { groups } from '@/db/schema/groups';
import { submissions } from '@/db/schema/submissions';
import { and, eq } from 'drizzle-orm';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { actionError, type ActionResult } from '@/lib/action-result';
import { normalizeCommentBody } from '@/lib/comment-thread';
import { checkReviewEligibility, REVIEW_MESSAGES } from '@/lib/review';
import { assertTodoEditor } from '@/server/phase-helpers';
import { getOrCreatePage, latestScopedSubmission, type WorkPageOwner } from '@/server/work-page-access';
import { insertThreadComment } from '@/server/comment-access';
import { applyAutoPhaseUnlock, lockReviewTarget } from '@/server/review-helpers';

const NOT_AUTHORIZED = 'Submission not found or not authorized';
const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';

const id = z.string().min(1).max(64);
const approveSchema = z.object({ submissionId: id, note: z.string().max(20_000).optional() });
const rejectSchema = z.object({ submissionId: id, feedback: z.string().max(20_000) });

type TxOutcome<T> = { kind: 'ok'; value: T } | { kind: 'fail'; message: string };

function revalidateReview() {
  // Not the student to-do page: revalidating it would re-render the autosaving work page editor (fgj note).
  revalidatePath('/teacher/review');
  revalidatePath('/teacher/review/[submissionId]', 'page');
}

async function loadSubmission(submissionId: string) {
  const sub = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { id: true, todoId: true, submittedBy: true },
  });
  if (!sub) throw new Error(NOT_AUTHORIZED);
  return sub;
}

export async function approveSubmission(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult<{ phaseCompleted: boolean; unlockedPhaseName: string | null }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);

  const sub = await loadSubmission(parsed.data.submissionId);
  const { todo, classroom } = await assertTodoEditor(sub.todoId, userId);

  // Optional note: normalise only when non-blank.
  let note: string | null = null;
  if (parsed.data.note && parsed.data.note.trim().length > 0) {
    const normalized = normalizeCommentBody(parsed.data.note);
    if (!normalized.ok) return actionError(REVIEW_MESSAGES.feedbackTooLong);
    note = normalized.body;
  }

  const outcome = await db.transaction(
    async (tx): Promise<TxOutcome<{ phaseCompleted: boolean; unlockedPhaseName: string | null }>> => {
      await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, todo.groupId)).for('update');
      const owner: WorkPageOwner =
        todo.submissionMode === 'group'
          ? { groupId: todo.groupId, userId: null }
          : { groupId: todo.groupId, userId: sub.submittedBy };
      const page = await getOrCreatePage(tx, todo.id, owner, userId, { lock: true, markAuthor: false });

      const target = await lockReviewTarget(tx, sub.id);
      if (!target) throw new Error(NOT_AUTHORIZED);
      const latest = await latestScopedSubmission(tx, todo.id, todo.submissionMode, todo.groupId, sub.submittedBy, {
        lock: true,
      });
      const eligibility = checkReviewEligibility({ target, latestInScopeId: latest?.id ?? null });
      if (!eligibility.ok) return { kind: 'fail', message: eligibility.message };

      const updated = await tx
        .update(submissions)
        .set({ status: 'approved', reviewedBy: userId, reviewedAt: new Date() })
        .where(and(eq(submissions.id, target.id), eq(submissions.status, 'pending')))
        .returning({ id: submissions.id });
      if (updated.length === 0) return { kind: 'fail', message: REVIEW_MESSAGES.alreadyReviewed };

      if (note) {
        await insertThreadComment(tx, {
          workPageId: page.id,
          submissionId: target.id,
          userId,
          authorRole: 'teacher',
          content: note,
        });
      }

      const unlock = await applyAutoPhaseUnlock(tx, {
        groupId: todo.groupId,
        phaseId: todo.phaseId,
        classroomId: classroom.id,
      });
      return {
        kind: 'ok',
        value: { phaseCompleted: unlock.completedPhaseId !== null, unlockedPhaseName: unlock.unlockedPhaseName },
      };
    },
  );

  if (outcome.kind === 'fail') return actionError(outcome.message);
  revalidateReview();
  return { success: true, ...outcome.value };
}

export async function rejectSubmission(input: z.infer<typeof rejectSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);

  const sub = await loadSubmission(parsed.data.submissionId);
  const { todo } = await assertTodoEditor(sub.todoId, userId);

  if (parsed.data.feedback.trim().length === 0) return actionError(REVIEW_MESSAGES.feedbackRequired);
  const normalized = normalizeCommentBody(parsed.data.feedback);
  if (!normalized.ok) return actionError(REVIEW_MESSAGES.feedbackTooLong);
  const feedback = normalized.body;

  const outcome = await db.transaction(async (tx): Promise<TxOutcome<null>> => {
    await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, todo.groupId)).for('update');
    const owner: WorkPageOwner =
      todo.submissionMode === 'group'
        ? { groupId: todo.groupId, userId: null }
        : { groupId: todo.groupId, userId: sub.submittedBy };
    const page = await getOrCreatePage(tx, todo.id, owner, userId, { lock: true, markAuthor: false });

    const target = await lockReviewTarget(tx, sub.id);
    if (!target) throw new Error(NOT_AUTHORIZED);
    const latest = await latestScopedSubmission(tx, todo.id, todo.submissionMode, todo.groupId, sub.submittedBy, {
      lock: true,
    });
    const eligibility = checkReviewEligibility({ target, latestInScopeId: latest?.id ?? null });
    if (!eligibility.ok) return { kind: 'fail', message: eligibility.message };

    const updated = await tx
      .update(submissions)
      .set({ status: 'rejected', reviewedBy: userId, reviewedAt: new Date() })
      .where(and(eq(submissions.id, target.id), eq(submissions.status, 'pending')))
      .returning({ id: submissions.id });
    if (updated.length === 0) return { kind: 'fail', message: REVIEW_MESSAGES.alreadyReviewed };

    await insertThreadComment(tx, {
      workPageId: page.id,
      submissionId: target.id,
      userId,
      authorRole: 'teacher',
      content: feedback,
    });
    return { kind: 'ok', value: null };
  });

  if (outcome.kind === 'fail') return actionError(outcome.message);
  revalidateReview();
  return { success: true };
}
