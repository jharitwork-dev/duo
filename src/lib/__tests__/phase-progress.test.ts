import { describe, it, expect } from 'vitest';
import { planProgressSync } from '../phase-progress';

const asMap = (rows: { groupId: string; phaseId: string; status: string }[], groupId: string) =>
  Object.fromEntries(rows.filter((r) => r.groupId === groupId).map((r) => [r.phaseId, r.status]));

describe('planProgressSync', () => {
  it('emits the full default matrix for a new group with no rows', () => {
    const out = planProgressSync({
      phaseIds: ['P1', 'P2', 'P3'],
      groups: [{ groupId: 'G', rows: [], phaseIdsWithSubmissions: [] }],
    });
    expect(asMap(out, 'G')).toEqual({ P1: 'active', P2: 'locked', P3: 'locked' });
    expect(out).toHaveLength(3);
  });

  it('re-derives a pristine group after a reorder and emits only changed rows', () => {
    // Order was P1, P2, P3; teacher moved P2 to the front.
    const out = planProgressSync({
      phaseIds: ['P2', 'P1', 'P3'],
      groups: [
        {
          groupId: 'G',
          rows: [
            { phaseId: 'P1', status: 'active' },
            { phaseId: 'P2', status: 'locked' },
            { phaseId: 'P3', status: 'locked' },
          ],
          phaseIdsWithSubmissions: [],
        },
      ],
    });
    expect(asMap(out, 'G')).toEqual({ P1: 'locked', P2: 'active' });
  });

  it('emits nothing for a pristine group already at the default', () => {
    const out = planProgressSync({
      phaseIds: ['P1', 'P2'],
      groups: [
        {
          groupId: 'G',
          rows: [
            { phaseId: 'P1', status: 'active' },
            { phaseId: 'P2', status: 'locked' },
          ],
          phaseIdsWithSubmissions: [],
        },
      ],
    });
    expect(out).toEqual([]);
  });

  it('keeps rows of a group with a completed phase; inserts missing rows as locked', () => {
    const out = planProgressSync({
      phaseIds: ['PNEW', 'P1', 'P2'],
      groups: [
        {
          groupId: 'G',
          rows: [
            { phaseId: 'P1', status: 'completed' },
            { phaseId: 'P2', status: 'active' },
          ],
          phaseIdsWithSubmissions: [],
        },
      ],
    });
    expect(out).toEqual([{ groupId: 'G', phaseId: 'PNEW', status: 'locked' }]);
  });

  it('keeps rows of a group with submissions in its active phase', () => {
    const out = planProgressSync({
      phaseIds: ['P2', 'P1'],
      groups: [
        {
          groupId: 'G',
          rows: [
            { phaseId: 'P1', status: 'active' },
            { phaseId: 'P2', status: 'locked' },
          ],
          phaseIdsWithSubmissions: ['P1'],
        },
      ],
    });
    expect(out).toEqual([]);
  });

  it('keeps rows of a group with two active phases (manual teacher choice)', () => {
    const out = planProgressSync({
      phaseIds: ['P3', 'P1', 'P2'],
      groups: [
        {
          groupId: 'G',
          rows: [
            { phaseId: 'P1', status: 'active' },
            { phaseId: 'P2', status: 'active' },
          ],
          phaseIdsWithSubmissions: [],
        },
      ],
    });
    expect(out).toEqual([{ groupId: 'G', phaseId: 'P3', status: 'locked' }]);
  });

  it('handles several groups independently', () => {
    const out = planProgressSync({
      phaseIds: ['P1', 'P2'],
      groups: [
        { groupId: 'NEW', rows: [], phaseIdsWithSubmissions: [] },
        {
          groupId: 'DONE',
          rows: [
            { phaseId: 'P1', status: 'completed' },
            { phaseId: 'P2', status: 'active' },
          ],
          phaseIdsWithSubmissions: ['P2'],
        },
      ],
    });
    expect(asMap(out, 'NEW')).toEqual({ P1: 'active', P2: 'locked' });
    expect(asMap(out, 'DONE')).toEqual({});
  });

  it('returns [] when there are no phases', () => {
    expect(
      planProgressSync({ phaseIds: [], groups: [{ groupId: 'G', rows: [], phaseIdsWithSubmissions: [] }] }),
    ).toEqual([]);
  });
});
