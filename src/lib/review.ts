// Teacher review helpers (quick task 261004-gic). Pure: no DB / React imports — unit tested.
//
// Auto phase unlock (REV-04 / PHASE-05), per group:
//   After an approval, the group's phase is complete when every NON-ARCHIVED to-do of that phase (for that
//   group) has its latest submission approved — group to-do: the group's latest; individual to-do: the latest
//   of EVERY current group member (former members are ignored; no members → never complete). A phase with zero
//   to-dos never completes automatically.
//   Then: current phase → 'completed', and the next GATING phase (by orderIndex) → 'active' unless it is
//   already active / completed (never downgrade).
//
// Free-access interpretation (Claude's discretion): free-access phases are always viewable, so they never
// block progression and are skipped when choosing the phase to activate (left untouched). An approval inside a
// free-access phase may mark that phase completed but never activates another phase.
// A current phase that is already 'completed' (e.g. a teacher override) or 'locked' (and not free-access)
// is left alone (no-op): manual overrides via setGroupPhaseStatus keep working.

import { resolveGroupPhaseStatuses, type PhaseStatus } from '@/lib/node-path';

type SubmissionStatusValue = 'pending' | 'approved' | 'rejected';
type Mode = 'group' | 'individual';

export const REVIEW_MESSAGES = {
  stale: 'งานนี้มีการส่งฉบับใหม่แล้ว',
  alreadyReviewed: 'งานนี้ตรวจแล้ว',
  feedbackRequired: 'กรุณาระบุคำแนะนำก่อนส่งกลับ',
  feedbackTooLong: 'คำแนะนำต้องไม่เกิน 2000 ตัวอักษร',
} as const;

export type ReviewTab = 'pending' | 'rejected' | 'approved';
export const REVIEW_TABS: ReviewTab[] = ['pending', 'rejected', 'approved'];

export const REVIEW_TAB_LABEL: Record<ReviewTab, string> = {
  pending: 'รอตรวจ',
  rejected: 'รอแก้ไข',
  approved: 'ผ่าน',
};

/** Round status label in the review history card. */
export const REVIEW_ROUND_LABEL: Record<ReviewTab, string> = {
  pending: 'รอตรวจ',
  rejected: 'ให้แก้ไข',
  approved: 'ผ่าน',
};

export const REVIEW_PENDING_HINT = 'รอทีมส่งไฟล์ฉบับแก้ไข งานจึงจะกลับมาอยู่ในแท็บรอตรวจ';
export const REVIEW_SUCCESS_BANNER = '✓ บันทึกผลแล้ว · แจ้งเตือนทีมเรียบร้อย';
export const REVIEW_SENT_BACK_BANNER = '✓ ส่งกลับให้แก้ไขแล้ว · แจ้งเตือนทีมเรียบร้อย';

export function parseReviewTab(value: string | undefined | null): ReviewTab {
  return value === 'rejected' || value === 'approved' ? value : 'pending';
}

// ---------------------------------------------------------------------------------------------
// Phase completion

export interface PhaseCompletionInput {
  /** Non-archived classroom phases, ordered by orderIndex. */
  phases: { id: string; isFreeAccess: boolean }[];
  progressRows: { phaseId: string; status: PhaseStatus }[];
  phaseId: string;
  /** This group's NON-ARCHIVED to-dos in phaseId. */
  todos: { id: string; submissionMode: Mode }[];
  /** Submissions of those to-dos, newest first. */
  submissions: { todoId: string; groupId: string | null; submittedBy: string; status: SubmissionStatusValue }[];
  groupId: string;
  /** Current group member user ids. */
  memberIds: string[];
}

export interface PhaseCompletionResult {
  complete: boolean;
  upserts: { phaseId: string; status: PhaseStatus }[];
  completedPhaseId: string | null;
  unlockedPhaseId: string | null;
}

const NOOP: PhaseCompletionResult = { complete: false, upserts: [], completedPhaseId: null, unlockedPhaseId: null };

function allTodosApproved(input: PhaseCompletionInput): boolean {
  if (input.todos.length === 0) return false;
  // Latest status per (to-do, owner key).
  const latest = new Map<string, SubmissionStatusValue>();
  const modeById = new Map(input.todos.map((t) => [t.id, t.submissionMode]));
  for (const row of input.submissions) {
    const mode = modeById.get(row.todoId);
    if (!mode) continue;
    if (mode === 'group' && row.groupId !== input.groupId) continue;
    const key = `${row.todoId}:${mode === 'group' ? input.groupId : row.submittedBy}`;
    if (!latest.has(key)) latest.set(key, row.status);
  }
  return input.todos.every((todo) => {
    if (todo.submissionMode === 'group') return latest.get(`${todo.id}:${input.groupId}`) === 'approved';
    if (input.memberIds.length === 0) return false;
    return input.memberIds.every((memberId) => latest.get(`${todo.id}:${memberId}`) === 'approved');
  });
}

export function computePhaseCompletion(input: PhaseCompletionInput): PhaseCompletionResult {
  const index = input.phases.findIndex((p) => p.id === input.phaseId);
  if (index === -1) return NOOP;
  const phase = input.phases[index];
  const statuses = resolveGroupPhaseStatuses(input.phases, input.progressRows);
  const current = statuses[phase.id];
  if (current === 'completed') return NOOP;
  if (current === 'locked' && !phase.isFreeAccess) return NOOP;
  if (!allTodosApproved(input)) return NOOP;

  const upserts: PhaseCompletionResult['upserts'] = [{ phaseId: phase.id, status: 'completed' }];
  let unlockedPhaseId: string | null = null;
  if (!phase.isFreeAccess) {
    const next = input.phases.slice(index + 1).find((p) => !p.isFreeAccess);
    if (next && statuses[next.id] === 'locked') {
      upserts.push({ phaseId: next.id, status: 'active' });
      unlockedPhaseId = next.id;
    }
  }
  return { complete: true, upserts, completedPhaseId: phase.id, unlockedPhaseId };
}

// ---------------------------------------------------------------------------------------------
// Eligibility

export type ReviewEligibility =
  | { ok: true }
  | { ok: false; reason: 'stale' | 'already_reviewed'; message: string };

/** Only the LATEST in-scope, still pending and unreviewed submission can be reviewed (stale checked first). */
export function checkReviewEligibility(input: {
  target: { id: string; status: SubmissionStatusValue; reviewedAt: Date | null; reviewedBy: string | null };
  latestInScopeId: string | null;
}): ReviewEligibility {
  const { target, latestInScopeId } = input;
  if (latestInScopeId !== target.id) return { ok: false, reason: 'stale', message: REVIEW_MESSAGES.stale };
  if (target.status !== 'pending' || target.reviewedAt || target.reviewedBy) {
    return { ok: false, reason: 'already_reviewed', message: REVIEW_MESSAGES.alreadyReviewed };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Review list

export interface ReviewSourceRow {
  id: string;
  todoId: string;
  todoTitle: string;
  submissionMode: Mode;
  groupId: string | null;
  groupName: string;
  submittedBy: string;
  status: SubmissionStatusValue;
  createdAt: Date;
  fileCount: number;
}

export type ReviewItem<T extends ReviewSourceRow = ReviewSourceRow> = T & {
  /** 1-based round number (oldest = 1) per to-do + owner. */
  attempt: number;
  tab: ReviewTab;
};

/**
 * Keeps ONLY the latest round per (to-do, owner) — owner = group (group to-do) or the submitter
 * (individual to-do) — from rows sorted newest first. Order is preserved (newest first).
 */
export function buildReviewItems<T extends ReviewSourceRow>(rowsNewestFirst: T[]): ReviewItem<T>[] {
  const ownerKey = (row: T) =>
    `${row.todoId}:${row.submissionMode === 'group' ? `g:${row.groupId ?? ''}` : `u:${row.submittedBy}`}`;
  const counts = new Map<string, number>();
  for (const row of rowsNewestFirst) counts.set(ownerKey(row), (counts.get(ownerKey(row)) ?? 0) + 1);
  const seen = new Set<string>();
  const items: ReviewItem<T>[] = [];
  for (const row of rowsNewestFirst) {
    const key = ownerKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ...row, attempt: counts.get(key) ?? 1, tab: row.status });
  }
  return items;
}
