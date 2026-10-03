import { describe, it, expect } from 'vitest';
import {
  buildNodeRows,
  statusFromSubmission,
  computeLockedTodoIds,
  pickCurrentTodoId,
  pickDefaultPhaseId,
  resolveGroupPhaseStatuses,
  type SubmissionStatus,
} from '../node-path';

const t = (id: string) => ({ id });
const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map(t);

describe('buildNodeRows', () => {
  it('alternates 1, 2, 1, 2 nodes per row in order', () => {
    expect(buildNodeRows([a, b, c, d, e])).toEqual([[a], [b, c], [d], [e]]);
  });

  it('returns [] for no todos', () => {
    expect(buildNodeRows([])).toEqual([]);
  });

  it('handles exactly two rows', () => {
    expect(buildNodeRows([a, b, c])).toEqual([[a], [b, c]]);
  });
});

describe('statusFromSubmission', () => {
  it('maps undefined to none and passes through real statuses', () => {
    expect(statusFromSubmission(undefined)).toBe('none');
    expect(statusFromSubmission('pending')).toBe('pending');
    expect(statusFromSubmission('rejected')).toBe('rejected');
    expect(statusFromSubmission('approved')).toBe('approved');
  });
});

describe('computeLockedTodoIds', () => {
  const rows = [[a], [b, c], [d]];

  it('locks every todo in a locked, non-free phase', () => {
    const locked = computeLockedTodoIds({ status: 'locked', isFreeAccess: false }, rows, {});
    expect([...locked].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('locks nothing in a completed phase', () => {
    const locked = computeLockedTodoIds({ status: 'completed', isFreeAccess: false }, rows, {});
    expect(locked.size).toBe(0);
  });

  it('locks nothing in a free-access phase (even if phase is locked)', () => {
    const locked = computeLockedTodoIds({ status: 'locked', isFreeAccess: true }, rows, {});
    expect(locked.size).toBe(0);
  });

  it('active phase: first row always unlocked, later rows locked until prior rows submitted', () => {
    const locked = computeLockedTodoIds({ status: 'active', isFreeAccess: false }, rows, {});
    expect([...locked].sort()).toEqual(['b', 'c', 'd']);
  });

  it('active phase: unlocks row 1 once row 0 has any submission', () => {
    const statuses: Record<string, SubmissionStatus> = { a: 'pending' };
    const locked = computeLockedTodoIds({ status: 'active', isFreeAccess: false }, rows, statuses);
    expect([...locked]).toEqual(['d']);
  });

  it('active phase: row 2 stays locked while any todo in row 1 is unsubmitted', () => {
    const statuses: Record<string, SubmissionStatus> = { a: 'pending', b: 'approved' };
    const locked = computeLockedTodoIds({ status: 'active', isFreeAccess: false }, rows, statuses);
    expect([...locked]).toEqual(['d']);
  });

  it('active phase: all submitted => nothing locked', () => {
    const statuses: Record<string, SubmissionStatus> = {
      a: 'pending',
      b: 'approved',
      c: 'rejected',
      d: 'none',
    };
    const locked = computeLockedTodoIds({ status: 'active', isFreeAccess: false }, rows, statuses);
    expect(locked.size).toBe(0);
  });
});

describe('pickCurrentTodoId', () => {
  const rows = [[a], [b, c], [d]];

  it('returns first unlocked todo with status none', () => {
    const statuses: Record<string, SubmissionStatus> = { a: 'pending' };
    expect(pickCurrentTodoId(rows, new Set(['d']), statuses)).toBe('b');
  });

  it('treats rejected as current', () => {
    const statuses: Record<string, SubmissionStatus> = { a: 'rejected' };
    expect(pickCurrentTodoId(rows, new Set(['b', 'c', 'd']), statuses)).toBe('a');
  });

  it('skips locked todos', () => {
    expect(pickCurrentTodoId(rows, new Set(['a', 'b', 'c', 'd']), {})).toBeNull();
  });

  it('returns null when everything is submitted', () => {
    const statuses: Record<string, SubmissionStatus> = {
      a: 'pending',
      b: 'approved',
      c: 'pending',
      d: 'approved',
    };
    expect(pickCurrentTodoId(rows, new Set(), statuses)).toBeNull();
  });
});

describe('pickDefaultPhaseId', () => {
  const p = (id: string, status: 'locked' | 'active' | 'completed', isFreeAccess = false) => ({
    id,
    status,
    isFreeAccess,
  });

  it('returns null for no phases', () => {
    expect(pickDefaultPhaseId([])).toBeNull();
  });

  it('defaults to the first active phase', () => {
    expect(pickDefaultPhaseId([p('1', 'completed'), p('2', 'active'), p('3', 'active')])).toBe('2');
  });

  it('falls back to the last completed phase', () => {
    expect(pickDefaultPhaseId([p('1', 'completed'), p('2', 'completed'), p('3', 'locked')])).toBe(
      '2',
    );
  });

  it('falls back to the first phase', () => {
    expect(pickDefaultPhaseId([p('1', 'locked'), p('2', 'locked')])).toBe('1');
  });

  it('honours a viewable requested phase', () => {
    const phases = [p('1', 'completed'), p('2', 'active'), p('3', 'locked', true)];
    expect(pickDefaultPhaseId(phases, '1')).toBe('1');
    expect(pickDefaultPhaseId(phases, '3')).toBe('3');
  });

  it('ignores a locked or unknown requested phase', () => {
    const phases = [p('1', 'active'), p('2', 'locked')];
    expect(pickDefaultPhaseId(phases, '2')).toBe('1');
    expect(pickDefaultPhaseId(phases, 'nope')).toBe('1');
  });
});

describe('resolveGroupPhaseStatuses', () => {
  const phases = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];

  it('defaults to first phase active, the rest locked when there are no rows', () => {
    expect(resolveGroupPhaseStatuses(phases, [])).toEqual({ p1: 'active', p2: 'locked', p3: 'locked' });
  });

  it('uses explicit rows when present', () => {
    expect(
      resolveGroupPhaseStatuses(phases, [
        { phaseId: 'p1', status: 'completed' },
        { phaseId: 'p2', status: 'active' },
        { phaseId: 'p3', status: 'locked' },
      ]),
    ).toEqual({ p1: 'completed', p2: 'active', p3: 'locked' });
  });

  it('mixes defaults and explicit rows', () => {
    expect(resolveGroupPhaseStatuses(phases, [{ phaseId: 'p2', status: 'completed' }])).toEqual({
      p1: 'active',
      p2: 'completed',
      p3: 'locked',
    });
  });

  it('ignores rows for phases outside the list and returns {} for no phases', () => {
    expect(resolveGroupPhaseStatuses([], [{ phaseId: 'x', status: 'active' }])).toEqual({});
  });
});
