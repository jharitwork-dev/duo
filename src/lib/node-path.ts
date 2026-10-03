// Pure node-path logic for the student home (no DB / React imports — unit tested).

export type SubmissionStatus = 'none' | 'pending' | 'rejected' | 'approved';

// Declared locally (not imported from the schema) so this module stays pure.
export type PhaseStatus = 'locked' | 'active' | 'completed';

interface PhaseLike {
  status: PhaseStatus;
  isFreeAccess: boolean;
}

/** Split todos into alternating rows of 1, 2, 1, 2, … nodes, preserving order. */
export function buildNodeRows<T>(todos: T[]): T[][] {
  const rows: T[][] = [];
  let i = 0;
  let size = 1;
  while (i < todos.length) {
    rows.push(todos.slice(i, i + size));
    i += size;
    size = size === 1 ? 2 : 1;
  }
  return rows;
}

export function statusFromSubmission(
  status?: 'pending' | 'approved' | 'rejected',
): SubmissionStatus {
  return status ?? 'none';
}

/** A phase can be opened from the stepper when it is not locked, is free-access, or is completed. */
export function isPhaseViewable(phase: PhaseLike): boolean {
  return phase.status !== 'locked' || phase.isFreeAccess;
}

/**
 * Derived to-do lock state (no schema column):
 * - locked phase without free access → everything locked
 * - completed or free-access phase → nothing locked
 * - otherwise row 0 is open; row r opens once every to-do in rows < r has a submission.
 */
export function computeLockedTodoIds(
  phase: PhaseLike,
  rows: { id: string }[][],
  statuses: Record<string, SubmissionStatus>,
): Set<string> {
  const locked = new Set<string>();
  if (phase.status === 'completed' || phase.isFreeAccess) return locked;
  if (phase.status === 'locked') {
    for (const row of rows) for (const todo of row) locked.add(todo.id);
    return locked;
  }

  // TODO(Phase 4): require 'approved' instead of any submission once teacher review ships.
  let priorRowsSubmitted = true;
  for (const row of rows) {
    if (!priorRowsSubmitted) {
      for (const todo of row) locked.add(todo.id);
    }
    if (row.some((todo) => (statuses[todo.id] ?? 'none') === 'none')) {
      priorRowsSubmitted = false;
    }
  }
  return locked;
}

/** First unlocked to-do (in order) that still needs work: not submitted yet, or rejected. */
export function pickCurrentTodoId(
  rows: { id: string }[][],
  locked: Set<string>,
  statuses: Record<string, SubmissionStatus>,
): string | null {
  for (const row of rows) {
    for (const todo of row) {
      if (locked.has(todo.id)) continue;
      const status = statuses[todo.id] ?? 'none';
      if (status === 'none' || status === 'rejected') return todo.id;
    }
  }
  return null;
}

/**
 * Phase shown on the student home: the requested one if viewable,
 * otherwise first active, else last completed, else first.
 */
export function pickDefaultPhaseId(
  phases: ({ id: string } & PhaseLike)[],
  requested?: string,
): string | null {
  if (phases.length === 0) return null;
  if (requested) {
    const match = phases.find((p) => p.id === requested);
    if (match && isPhaseViewable(match)) return match.id;
  }
  const active = phases.find((p) => p.status === 'active');
  if (active) return active.id;
  const completed = phases.filter((p) => p.status === 'completed');
  if (completed.length > 0) return completed[completed.length - 1].id;
  return phases[0].id;
}

/** Phase the stepper treats as "current" (drives the progress fill). */
export function pickCurrentPhaseIndex(phases: PhaseLike[]): number {
  if (phases.length === 0) return -1;
  const active = phases.findIndex((p) => p.status === 'active');
  if (active !== -1) return active;
  for (let i = phases.length - 1; i >= 0; i--) {
    if (phases[i].status === 'completed') return i;
  }
  return 0;
}

/**
 * A group's status for each classroom phase. `phases` = non-archived, in order.
 * Explicit group_phase_progress rows win; a missing row falls back to the default
 * rule: the first phase is active, every other phase is locked.
 */
export function resolveGroupPhaseStatuses(
  phases: { id: string }[],
  rows: { phaseId: string; status: PhaseStatus }[],
): Record<string, PhaseStatus> {
  const explicit = new Map(rows.map((r) => [r.phaseId, r.status]));
  const result: Record<string, PhaseStatus> = {};
  phases.forEach((phase, i) => {
    result[phase.id] = explicit.get(phase.id) ?? (i === 0 ? 'active' : 'locked');
  });
  return result;
}
