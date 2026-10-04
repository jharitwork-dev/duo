// Transaction helpers for teacher review (quick task 261004-gic) — plain module, NOT a server action file.

import { submissions } from '@/db/schema/submissions';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { groupMembers } from '@/db/schema/groups';
import { groupPhaseProgress } from '@/db/schema/groupPhaseProgress';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { computePhaseCompletion } from '@/lib/review';
import type { DbLike } from '@/server/phase-helpers';

/** Row-locks (FOR UPDATE) the submission being reviewed. Call inside a transaction, AFTER the work page lock. */
export async function lockReviewTarget(tx: DbLike, submissionId: string) {
  const [row] = await tx.select().from(submissions).where(eq(submissions.id, submissionId)).for('update');
  return row ?? null;
}

/**
 * REV-04 / PHASE-05: after an approval, completes the group's phase when every non-archived to-do of that
 * phase is approved (see computePhaseCompletion) and activates the next gating phase. Call inside the
 * review transaction, after the submission UPDATE (the group row lock serialises concurrent approvals).
 */
export async function applyAutoPhaseUnlock(
  tx: DbLike,
  input: { groupId: string; phaseId: string; classroomId: string },
): Promise<{ completedPhaseId: string | null; unlockedPhaseId: string | null; unlockedPhaseName: string | null }> {
  const [phaseRows, progressRows, todoRows, memberRows] = await Promise.all([
    tx
      .select({ id: phases.id, name: phases.name, isFreeAccess: phases.isFreeAccess })
      .from(phases)
      .where(and(eq(phases.classroomId, input.classroomId), eq(phases.isArchived, false)))
      .orderBy(asc(phases.orderIndex), asc(phases.createdAt)),
    tx
      .select({ phaseId: groupPhaseProgress.phaseId, status: groupPhaseProgress.status })
      .from(groupPhaseProgress)
      .where(eq(groupPhaseProgress.groupId, input.groupId)),
    tx
      .select({ id: todos.id, submissionMode: todos.submissionMode })
      .from(todos)
      .where(and(eq(todos.groupId, input.groupId), eq(todos.phaseId, input.phaseId), eq(todos.isArchived, false))),
    tx.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, input.groupId)),
  ]);

  const submissionRows =
    todoRows.length === 0
      ? []
      : await tx
          .select({
            todoId: submissions.todoId,
            groupId: submissions.groupId,
            submittedBy: submissions.submittedBy,
            status: submissions.status,
          })
          .from(submissions)
          .where(inArray(submissions.todoId, todoRows.map((t) => t.id)))
          .orderBy(desc(submissions.createdAt));

  const result = computePhaseCompletion({
    phases: phaseRows,
    progressRows,
    phaseId: input.phaseId,
    todos: todoRows,
    submissions: submissionRows,
    groupId: input.groupId,
    memberIds: memberRows.map((m) => m.userId),
  });

  for (const upsert of result.upserts) {
    await tx
      .insert(groupPhaseProgress)
      .values({ groupId: input.groupId, phaseId: upsert.phaseId, status: upsert.status })
      .onConflictDoUpdate({
        target: [groupPhaseProgress.groupId, groupPhaseProgress.phaseId],
        set: { status: upsert.status, updatedAt: new Date() },
      });
  }

  const unlocked = result.unlockedPhaseId ? phaseRows.find((p) => p.id === result.unlockedPhaseId) : undefined;
  return {
    completedPhaseId: result.completedPhaseId,
    unlockedPhaseId: result.unlockedPhaseId,
    unlockedPhaseName: unlocked?.name ?? null,
  };
}
