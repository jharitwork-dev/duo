import { describe, it, expect } from 'vitest';
import {
  buildReviewItems,
  checkReviewEligibility,
  computePhaseCompletion,
  REVIEW_MESSAGES,
  type PhaseCompletionInput,
} from '@/lib/review';

type Status = 'pending' | 'approved' | 'rejected';

const sub = (todoId: string, status: Status, submittedBy = 'u1', groupId: string | null = 'g1') => ({
  todoId,
  groupId,
  submittedBy,
  status,
});

const P = (id: string, isFreeAccess = false) => ({ id, isFreeAccess });

function input(overrides: Partial<PhaseCompletionInput> = {}): PhaseCompletionInput {
  return {
    phases: [P('p1'), P('p2'), P('p3')],
    progressRows: [
      { phaseId: 'p1', status: 'active' },
      { phaseId: 'p2', status: 'locked' },
      { phaseId: 'p3', status: 'locked' },
    ],
    phaseId: 'p1',
    todos: [
      { id: 't1', submissionMode: 'group' },
      { id: 't2', submissionMode: 'group' },
    ],
    submissions: [sub('t1', 'approved'), sub('t2', 'approved')],
    groupId: 'g1',
    memberIds: ['u1', 'u2'],
    ...overrides,
  };
}

const NOOP = { complete: false, upserts: [], completedPhaseId: null, unlockedPhaseId: null };

describe('computePhaseCompletion — group mode', () => {
  it('completes the phase and activates the next one when every latest group submission is approved', () => {
    expect(computePhaseCompletion(input())).toEqual({
      complete: true,
      upserts: [
        { phaseId: 'p1', status: 'completed' },
        { phaseId: 'p2', status: 'active' },
      ],
      completedPhaseId: 'p1',
      unlockedPhaseId: 'p2',
    });
  });

  it('is not complete when a latest submission is pending or rejected, even with an older approval', () => {
    for (const status of ['pending', 'rejected'] as const) {
      const r = computePhaseCompletion(
        input({ submissions: [sub('t1', 'approved'), sub('t2', status), sub('t2', 'approved')] }),
      );
      expect(r).toEqual(NOOP);
    }
  });

  it('is not complete when a to-do has no submission', () => {
    expect(computePhaseCompletion(input({ submissions: [sub('t1', 'approved')] }))).toEqual(NOOP);
  });

  it('ignores submissions of to-dos that are not in the list (archived to-dos are excluded by the caller)', () => {
    const r = computePhaseCompletion(
      input({
        todos: [{ id: 't1', submissionMode: 'group' }],
        submissions: [sub('archived', 'rejected'), sub('t1', 'approved')],
      }),
    );
    expect(r.complete).toBe(true);
  });

  it("ignores another group's submissions for a group to-do", () => {
    const r = computePhaseCompletion(
      input({
        todos: [{ id: 't1', submissionMode: 'group' }],
        submissions: [sub('t1', 'approved', 'u9', 'g2')],
      }),
    );
    expect(r).toEqual(NOOP);
  });

  it('is not complete for a phase with zero to-dos', () => {
    expect(computePhaseCompletion(input({ todos: [], submissions: [] }))).toEqual(NOOP);
  });
});

describe('computePhaseCompletion — individual mode', () => {
  const todos = [{ id: 't1', submissionMode: 'individual' as const }];

  it("completes when every current member's latest submission is approved", () => {
    const r = computePhaseCompletion(
      input({ todos, submissions: [sub('t1', 'approved', 'u1'), sub('t1', 'approved', 'u2')] }),
    );
    expect(r.complete).toBe(true);
    expect(r.unlockedPhaseId).toBe('p2');
  });

  it('is not complete when a member is missing or their latest is rejected', () => {
    expect(computePhaseCompletion(input({ todos, submissions: [sub('t1', 'approved', 'u1')] }))).toEqual(NOOP);
    expect(
      computePhaseCompletion(
        input({
          todos,
          submissions: [sub('t1', 'approved', 'u1'), sub('t1', 'rejected', 'u2'), sub('t1', 'approved', 'u2')],
        }),
      ),
    ).toEqual(NOOP);
  });

  it('ignores submissions by former members', () => {
    const r = computePhaseCompletion(
      input({
        todos,
        submissions: [sub('t1', 'rejected', 'former'), sub('t1', 'approved', 'u1'), sub('t1', 'approved', 'u2')],
      }),
    );
    expect(r.complete).toBe(true);
  });

  it('is not complete when the group has no members', () => {
    expect(
      computePhaseCompletion(input({ todos, memberIds: [], submissions: [sub('t1', 'approved', 'u1')] })),
    ).toEqual(NOOP);
  });

  it('handles mixed group + individual to-dos', () => {
    const mixed = [
      { id: 't1', submissionMode: 'group' as const },
      { id: 't2', submissionMode: 'individual' as const },
    ];
    const base = [sub('t1', 'approved', 'u2'), sub('t2', 'approved', 'u1')];
    expect(computePhaseCompletion(input({ todos: mixed, submissions: base })).complete).toBe(false);
    expect(
      computePhaseCompletion(input({ todos: mixed, submissions: [...base, sub('t2', 'approved', 'u2')] })).complete,
    ).toBe(true);
  });
});

describe('computePhaseCompletion — phase transitions', () => {
  it('completes the last phase without unlocking anything', () => {
    const r = computePhaseCompletion(
      input({
        phaseId: 'p3',
        progressRows: [
          { phaseId: 'p1', status: 'completed' },
          { phaseId: 'p2', status: 'completed' },
          { phaseId: 'p3', status: 'active' },
        ],
      }),
    );
    expect(r).toEqual({
      complete: true,
      upserts: [{ phaseId: 'p3', status: 'completed' }],
      completedPhaseId: 'p3',
      unlockedPhaseId: null,
    });
  });

  it('never downgrades a next phase that is already active or completed', () => {
    for (const status of ['active', 'completed'] as const) {
      const r = computePhaseCompletion(
        input({
          progressRows: [
            { phaseId: 'p1', status: 'active' },
            { phaseId: 'p2', status },
          ],
        }),
      );
      expect(r.upserts).toEqual([{ phaseId: 'p1', status: 'completed' }]);
      expect(r.unlockedPhaseId).toBeNull();
      expect(r.completedPhaseId).toBe('p1');
    }
  });

  it('skips free-access phases and activates the first following gating phase', () => {
    const r = computePhaseCompletion(input({ phases: [P('p1'), P('p2', true), P('p3')] }));
    expect(r.upserts).toEqual([
      { phaseId: 'p1', status: 'completed' },
      { phaseId: 'p3', status: 'active' },
    ]);
    expect(r.unlockedPhaseId).toBe('p3');
  });

  it('unlocks nothing when only free-access phases follow', () => {
    const r = computePhaseCompletion(input({ phases: [P('p1'), P('p2', true), P('p3', true)] }));
    expect(r.upserts).toEqual([{ phaseId: 'p1', status: 'completed' }]);
    expect(r.unlockedPhaseId).toBeNull();
  });

  it('an approval inside a free-access phase may complete it but never activates another phase', () => {
    const r = computePhaseCompletion(
      input({ phases: [P('p1'), P('p2', true), P('p3')], phaseId: 'p2' }),
    );
    expect(r).toEqual({
      complete: true,
      upserts: [{ phaseId: 'p2', status: 'completed' }],
      completedPhaseId: 'p2',
      unlockedPhaseId: null,
    });
  });

  it('is a no-op when the current phase is already completed (teacher override)', () => {
    const r = computePhaseCompletion(
      input({
        progressRows: [
          { phaseId: 'p1', status: 'completed' },
          { phaseId: 'p2', status: 'locked' },
        ],
      }),
    );
    expect(r).toEqual(NOOP);
  });

  it('is a no-op when the current phase is locked and not free-access', () => {
    const r = computePhaseCompletion(input({ phaseId: 'p2' }));
    expect(r).toEqual(NOOP);
  });

  it('uses the default statuses when progress rows are missing (first phase active)', () => {
    const r = computePhaseCompletion(input({ progressRows: [] }));
    expect(r.upserts).toEqual([
      { phaseId: 'p1', status: 'completed' },
      { phaseId: 'p2', status: 'active' },
    ]);
    expect(computePhaseCompletion(input({ progressRows: [], phaseId: 'p2' }))).toEqual(NOOP);
  });

  it('is a no-op for an unknown (e.g. archived) phase', () => {
    expect(computePhaseCompletion(input({ phaseId: 'gone' }))).toEqual(NOOP);
  });
});

describe('checkReviewEligibility', () => {
  const target = { id: 's1', status: 'pending' as Status, reviewedAt: null, reviewedBy: null };

  it('accepts the latest pending, unreviewed submission', () => {
    expect(checkReviewEligibility({ target, latestInScopeId: 's1' })).toEqual({ ok: true });
  });

  it('rejects a stale submission first', () => {
    expect(
      checkReviewEligibility({ target: { ...target, status: 'approved' }, latestInScopeId: 's2' }),
    ).toEqual({ ok: false, reason: 'stale', message: REVIEW_MESSAGES.stale });
    expect(REVIEW_MESSAGES.stale).toBe('งานนี้มีการส่งฉบับใหม่แล้ว');
  });

  it('rejects an already reviewed submission', () => {
    const expected = { ok: false, reason: 'already_reviewed', message: 'งานนี้ตรวจแล้ว' };
    expect(checkReviewEligibility({ target: { ...target, status: 'rejected' }, latestInScopeId: 's1' })).toEqual(
      expected,
    );
    expect(
      checkReviewEligibility({ target: { ...target, reviewedAt: new Date() }, latestInScopeId: 's1' }),
    ).toEqual(expected);
    expect(checkReviewEligibility({ target: { ...target, reviewedBy: 't1' }, latestInScopeId: 's1' })).toEqual(
      expected,
    );
  });
});

describe('buildReviewItems', () => {
  const row = (
    id: string,
    todoId: string,
    status: Status,
    submittedBy = 'u1',
    submissionMode: 'group' | 'individual' = 'group',
  ) => ({
    id,
    todoId,
    todoTitle: `Todo ${todoId}`,
    submissionMode,
    groupId: 'g1',
    groupName: 'Group 1',
    submittedBy,
    status,
    createdAt: new Date(`2026-09-${10 + Number(id.slice(1))}T00:00:00Z`),
    fileCount: 1,
  });

  it('keeps only the latest round per to-do and counts attempts', () => {
    const items = buildReviewItems([row('s2', 't1', 'pending', 'u2'), row('s1', 't1', 'rejected')]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 's2', attempt: 2, tab: 'pending' });
  });

  it('keeps one item per student for individual to-dos', () => {
    const items = buildReviewItems([
      row('s3', 't1', 'approved', 'u2', 'individual'),
      row('s2', 't1', 'pending', 'u1', 'individual'),
      row('s1', 't1', 'rejected', 'u1', 'individual'),
    ]);
    expect(items.map((i) => [i.id, i.attempt, i.tab])).toEqual([
      ['s3', 1, 'approved'],
      ['s2', 2, 'pending'],
    ]);
  });

  it('keeps separate to-dos apart', () => {
    const items = buildReviewItems([row('s2', 't2', 'rejected'), row('s1', 't1', 'approved')]);
    expect(items.map((i) => [i.todoId, i.tab])).toEqual([
      ['t2', 'rejected'],
      ['t1', 'approved'],
    ]);
  });
});
