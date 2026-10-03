// Pure progress-sync planner for group_phase_progress (no DB imports — unit tested).
// Called after phase create / reorder / archive / restore and group create.

import type { PhaseStatus } from './node-path';

export interface ProgressSyncGroup {
  groupId: string;
  /** Existing group_phase_progress rows for this group (any phase in the classroom). */
  rows: { phaseId: string; status: PhaseStatus }[];
  /** Phases in which this group has at least one submission. */
  phaseIdsWithSubmissions: string[];
}

export interface ProgressUpsert {
  groupId: string;
  phaseId: string;
  status: PhaseStatus;
}

/**
 * Returns the rows to upsert so that every (group, non-archived phase) has a row.
 *
 * - A "pristine" group (no completed rows, at most one active row, and no submissions in
 *   its active phase) follows the default rule: first phase active, the rest locked.
 *   This keeps untouched groups correct after a reorder / archive / restore.
 * - Any other group keeps its existing rows (a teacher or the group made progress);
 *   only missing rows are inserted, as 'locked'.
 * Only changed or missing rows are emitted.
 */
export function planProgressSync(input: {
  phaseIds: string[];
  groups: ProgressSyncGroup[];
}): ProgressUpsert[] {
  const { phaseIds } = input;
  const out: ProgressUpsert[] = [];
  if (phaseIds.length === 0) return out;

  const inClassroom = new Set(phaseIds);

  for (const group of input.groups) {
    const rows = group.rows.filter((r) => inClassroom.has(r.phaseId));
    const existing = new Map(rows.map((r) => [r.phaseId, r.status]));
    const activeIds = rows.filter((r) => r.status === 'active').map((r) => r.phaseId);
    const withSubmissions = new Set(group.phaseIdsWithSubmissions);

    const pristine =
      !rows.some((r) => r.status === 'completed') &&
      activeIds.length <= 1 &&
      !activeIds.some((id) => withSubmissions.has(id));

    phaseIds.forEach((phaseId, i) => {
      const current = existing.get(phaseId);
      if (pristine) {
        const wanted: PhaseStatus = i === 0 ? 'active' : 'locked';
        if (current !== wanted) out.push({ groupId: group.groupId, phaseId, status: wanted });
      } else if (current === undefined) {
        out.push({ groupId: group.groupId, phaseId, status: 'locked' });
      }
    });
  }

  return out;
}
