// Teacher to-do row review status (quick task 261004-fgj, orchestrator request).
// Pure: no DB / React imports.

import type { SubmissionStatus } from '@/lib/node-path';

export type TodoReviewSummary = { status: SubmissionStatus; pendingCount: number };

type Row = { groupId: string | null; submittedBy: string; status: 'pending' | 'approved' | 'rejected' };

/**
 * Summarises a to-do's submissions (newest first) for the teacher row pill.
 * Group to-do: the group's latest submission. Individual: each student's latest, then
 * pending (anyone waiting) > rejected > approved > none. pendingCount = owners waiting for review.
 */
export function summarizeTodoReview(
  rowsNewestFirst: Row[],
  mode: 'group' | 'individual',
  groupId: string,
): TodoReviewSummary {
  const latestPerOwner = new Map<string, Row['status']>();
  for (const row of rowsNewestFirst) {
    // To-dos belong to one group: group to-dos count that group's rows; individual ones every submitter.
    if (mode === 'group' && row.groupId !== groupId) continue;
    const owner = mode === 'group' ? groupId : row.submittedBy;
    if (!latestPerOwner.has(owner)) latestPerOwner.set(owner, row.status);
  }
  const statuses = [...latestPerOwner.values()];
  const pendingCount = statuses.filter((s) => s === 'pending').length;
  let status: SubmissionStatus = 'none';
  if (pendingCount > 0) status = 'pending';
  else if (statuses.includes('rejected')) status = 'rejected';
  else if (statuses.includes('approved')) status = 'approved';
  return { status, pendingCount };
}
