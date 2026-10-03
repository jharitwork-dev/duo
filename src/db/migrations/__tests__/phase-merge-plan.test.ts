import { describe, it, expect } from 'vitest';
import { planPhaseMerge, type OldPhaseRow, type ClassroomMergePlan } from '../phase-merge-plan';

const d = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n));

function phase(p: Partial<OldPhaseRow> & Pick<OldPhaseRow, 'id' | 'groupId' | 'name'>): OldPhaseRow {
  return {
    classroomId: 'C',
    orderIndex: 0,
    status: 'locked',
    isArchived: false,
    createdAt: d(0),
    ...p,
  };
}

function progressOf(plan: ClassroomMergePlan, groupId: string) {
  return Object.fromEntries(
    plan.progress.filter((r) => r.groupId === groupId).map((r) => [r.phaseId, r.status]),
  );
}

describe('planPhaseMerge', () => {
  it('returns an empty plan for empty input', () => {
    expect(planPhaseMerge({ groups: [], phases: [] })).toEqual([]);
  });

  it('keeps distinct names as separate classroom phases (no merge)', () => {
    const [plan] = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C' },
        { id: 'B', classroomId: 'C' },
      ],
      phases: [
        phase({ id: 'P1', groupId: 'A', name: 'Ideation', status: 'active', createdAt: d(1) }),
        phase({ id: 'P2', groupId: 'B', name: 'Prototype', status: 'completed', createdAt: d(2) }),
      ],
    });

    expect(plan.survivors.map((s) => s.phaseId)).toEqual(['P1', 'P2']);
    expect(plan.survivors.map((s) => s.orderIndex)).toEqual([0, 1]);
    expect(plan.deletePhaseIds).toEqual([]);
    expect(plan.remap).toHaveLength(2);
    expect(plan.remap).toEqual(
      expect.arrayContaining([
        { oldPhaseId: 'P1', survivorId: 'P1', groupId: 'A' },
        { oldPhaseId: 'P2', survivorId: 'P2', groupId: 'B' },
      ]),
    );
    // Groups with explicit rows never get a default 'active'.
    expect(progressOf(plan, 'A')).toEqual({ P1: 'active', P2: 'locked' });
    expect(progressOf(plan, 'B')).toEqual({ P1: 'locked', P2: 'completed' });
  });

  it('merges by trimmed, case-insensitive name; earliest createdAt survives', () => {
    const [plan] = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C' },
        { id: 'B', classroomId: 'C' },
      ],
      phases: [
        phase({ id: 'B1', groupId: 'B', name: 'research', status: 'completed', createdAt: d(5) }),
        phase({ id: 'A1', groupId: 'A', name: 'Research ', status: 'active', createdAt: d(1) }),
      ],
    });

    expect(plan.survivors).toEqual([{ phaseId: 'A1', orderIndex: 0, isArchived: false }]);
    expect(plan.deletePhaseIds).toEqual(['B1']);
    expect(plan.remap).toHaveLength(2);
    expect(plan.remap).toEqual(
      expect.arrayContaining([
        { oldPhaseId: 'A1', survivorId: 'A1', groupId: 'A' },
        { oldPhaseId: 'B1', survivorId: 'A1', groupId: 'B' },
      ]),
    );
    expect(progressOf(plan, 'A')).toEqual({ A1: 'active' });
    expect(progressOf(plan, 'B')).toEqual({ A1: 'completed' });
  });

  it('breaks createdAt ties by the smaller id', () => {
    const [plan] = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C' },
        { id: 'B', classroomId: 'C' },
      ],
      phases: [
        phase({ id: 'z9', groupId: 'A', name: 'X', createdAt: d(1) }),
        phase({ id: 'a1', groupId: 'B', name: 'x', createdAt: d(1) }),
      ],
    });
    expect(plan.survivors.map((s) => s.phaseId)).toEqual(['a1']);
    expect(plan.deletePhaseIds).toEqual(['z9']);
  });

  it('merges two same-name rows of one group and keeps the most advanced status', () => {
    const [plan] = planPhaseMerge({
      groups: [{ id: 'A', classroomId: 'C' }],
      phases: [
        phase({ id: 'A1', groupId: 'A', name: 'Build', status: 'locked', createdAt: d(1) }),
        phase({ id: 'A2', groupId: 'A', name: 'build', status: 'completed', createdAt: d(2), orderIndex: 1 }),
      ],
    });
    expect(plan.survivors.map((s) => s.phaseId)).toEqual(['A1']);
    expect(plan.deletePhaseIds).toEqual(['A2']);
    expect(progressOf(plan, 'A')).toEqual({ A1: 'completed' });
  });

  it('archives the survivor only when every merged row was archived', () => {
    const [plan] = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C' },
        { id: 'B', classroomId: 'C' },
      ],
      phases: [
        phase({ id: 'A1', groupId: 'A', name: 'One', isArchived: true, createdAt: d(1) }),
        phase({ id: 'B1', groupId: 'B', name: 'one', isArchived: false, createdAt: d(2) }),
        phase({ id: 'A2', groupId: 'A', name: 'Two', isArchived: true, createdAt: d(3), orderIndex: 1 }),
        phase({ id: 'B2', groupId: 'B', name: 'two', isArchived: true, createdAt: d(4), orderIndex: 1 }),
      ],
    });
    expect(plan.survivors).toEqual([
      { phaseId: 'A1', orderIndex: 0, isArchived: false },
      { phaseId: 'A2', orderIndex: 1, isArchived: true },
    ]);
  });

  it('orders by group (earliest phase first), then orderIndex; first appearance fixes position', () => {
    const [plan] = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C' },
        { id: 'B', classroomId: 'C' },
      ],
      phases: [
        // Group B is older, so its order wins.
        phase({ id: 'B1', groupId: 'B', name: 'Plan', orderIndex: 0, createdAt: d(1) }),
        phase({ id: 'B2', groupId: 'B', name: 'Build', orderIndex: 5, createdAt: d(2) }),
        phase({ id: 'A1', groupId: 'A', name: 'Build', orderIndex: 0, createdAt: d(3) }),
        phase({ id: 'A2', groupId: 'A', name: 'Pitch', orderIndex: 1, createdAt: d(4) }),
        phase({ id: 'A3', groupId: 'A', name: 'Plan', orderIndex: 2, createdAt: d(5) }),
      ],
    });
    expect(plan.survivors).toEqual([
      { phaseId: 'B1', orderIndex: 0, isArchived: false },
      { phaseId: 'B2', orderIndex: 1, isArchived: false },
      { phaseId: 'A2', orderIndex: 2, isArchived: false },
    ]);
    expect(plan.deletePhaseIds.sort()).toEqual(['A1', 'A3']);
    expect(plan.remap).toHaveLength(5);
  });

  it('gives a group with zero old phases the default matrix (first non-archived active)', () => {
    const [plan] = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C' },
        { id: 'M', classroomId: 'C' },
      ],
      phases: [
        phase({ id: 'A0', groupId: 'A', name: 'Old', isArchived: true, createdAt: d(1), orderIndex: 0 }),
        phase({ id: 'A1', groupId: 'A', name: 'First', status: 'active', createdAt: d(2), orderIndex: 1 }),
        phase({ id: 'A2', groupId: 'A', name: 'Second', createdAt: d(3), orderIndex: 2 }),
      ],
    });
    expect(progressOf(plan, 'M')).toEqual({ A0: 'locked', A1: 'active', A2: 'locked' });
  });

  it('plans two classrooms independently', () => {
    const plans = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C1' },
        { id: 'B', classroomId: 'C2' },
      ],
      phases: [
        phase({ id: 'A1', groupId: 'A', classroomId: 'C1', name: 'Same', createdAt: d(1) }),
        phase({ id: 'B1', groupId: 'B', classroomId: 'C2', name: 'same', createdAt: d(2) }),
      ],
    });
    expect(plans).toHaveLength(2);
    const byId = Object.fromEntries(plans.map((p) => [p.classroomId, p]));
    expect(byId.C1.survivors.map((s) => s.phaseId)).toEqual(['A1']);
    expect(byId.C2.survivors.map((s) => s.phaseId)).toEqual(['B1']);
    expect(byId.C1.deletePhaseIds).toEqual([]);
    expect(byId.C2.deletePhaseIds).toEqual([]);
    expect(byId.C1.progress.every((r) => r.groupId === 'A')).toBe(true);
    expect(byId.C2.progress.every((r) => r.groupId === 'B')).toBe(true);
  });

  it('live-data fixture: every to-do resolves to a group (no null group_id)', () => {
    const [plan] = planPhaseMerge({
      groups: [
        { id: 'A', classroomId: 'C' },
        { id: 'AFFY', classroomId: 'C' },
        { id: 'm', classroomId: 'C' },
      ],
      phases: [
        phase({ id: 'PA', groupId: 'A', name: 'Market Research', status: 'active', createdAt: d(1) }),
        phase({ id: 'PF', groupId: 'AFFY', name: 'Market Research', status: 'locked', createdAt: d(9) }),
      ],
    });

    const byOld = new Map(plan.remap.map((r) => [r.oldPhaseId, r]));
    const todoPhaseIds = ['PA', 'PA', 'PF'];
    const resolved = todoPhaseIds.map((id) => byOld.get(id));
    expect(resolved.every((r) => r !== undefined)).toBe(true);
    expect(resolved.map((r) => r!.groupId)).toEqual(['A', 'A', 'AFFY']);
    expect(resolved.map((r) => r!.survivorId)).toEqual(['PA', 'PA', 'PA']);

    expect(plan.survivors).toEqual([{ phaseId: 'PA', orderIndex: 0, isArchived: false }]);
    expect(plan.deletePhaseIds).toEqual(['PF']);
    expect(progressOf(plan, 'A')).toEqual({ PA: 'active' });
    expect(progressOf(plan, 'AFFY')).toEqual({ PA: 'locked' });
    expect(progressOf(plan, 'm')).toEqual({ PA: 'active' });
  });
});
