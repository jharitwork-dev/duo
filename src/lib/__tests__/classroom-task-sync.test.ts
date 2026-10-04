// Pure sync planner for classroom-level tasks (quick 261004-j6h). No DB.
import { describe, it, expect } from 'vitest';
import {
  LOCKED_FIELDS,
  OVERRIDABLE_FIELDS,
  computeOverrideMarks,
  planClassroomTaskSync,
  summarizeDelete,
  type ClassroomTaskSpec,
  type CopyState,
  type SyncPlan,
  type TaskFieldValues,
  type TaskFileSpec,
} from '@/lib/classroom-task-sync';

const D1 = new Date('2026-10-10T10:00:00.000Z');
const D2 = new Date('2026-10-20T10:00:00.000Z');

function file(key: string): TaskFileSpec {
  return { fileKey: key, fileName: `${key}.pdf`, contentType: 'application/pdf', fileSize: 10, uploadedBy: 't1' };
}

function task(over: Partial<ClassroomTaskSpec> = {}): ClassroomTaskSpec {
  return {
    id: 'ct1',
    phaseId: 'p1',
    orderIndex: 0,
    title: 'Pitch deck',
    description: 'desc',
    notes: '- slide 1\n- slide 2',
    submissionMode: 'group',
    fileRequirement: 'optional',
    deadline: D1,
    files: [],
    ...over,
  };
}

function copyOf(t: ClassroomTaskSpec, groupId: string, over: Partial<CopyState> = {}): CopyState {
  return {
    todoId: `todo-${t.id}-${groupId}`,
    classroomTaskId: t.id,
    groupId,
    title: t.title,
    description: t.description,
    notes: t.notes,
    submissionMode: t.submissionMode,
    fileRequirement: t.fileRequirement,
    deadline: t.deadline,
    overriddenFields: [],
    attachmentKeys: t.files.map((f) => f.fileKey),
    hasSubmission: false,
    ...over,
  };
}

function isEmpty(plan: SyncPlan) {
  return (
    plan.inserts.length === 0 &&
    plan.updates.length === 0 &&
    plan.attachmentInserts.length === 0 &&
    plan.attachmentDeletes.length === 0 &&
    plan.deletes.length === 0 &&
    plan.detaches.length === 0
  );
}

/** Applies a plan to an in-memory state (test-only simulation of the DB layer). */
function applyPlan(state: { groupIds: string[]; tasks: ClassroomTaskSpec[]; copies: CopyState[] }, plan: SyncPlan) {
  let copies = state.copies.map((c) => ({ ...c, attachmentKeys: [...c.attachmentKeys] }));
  for (const ins of plan.inserts) {
    copies.push({
      todoId: `new-${ins.classroomTaskId}-${ins.groupId}`,
      classroomTaskId: ins.classroomTaskId,
      groupId: ins.groupId,
      ...ins.values,
      overriddenFields: [],
      attachmentKeys: ins.files.map((f) => f.fileKey),
      hasSubmission: false,
    });
  }
  for (const u of plan.updates) {
    copies = copies.map((c) => (c.todoId === u.todoId ? { ...c, ...u.set } : c));
  }
  for (const a of plan.attachmentInserts) {
    copies.find((c) => c.todoId === a.todoId)!.attachmentKeys.push(a.file.fileKey);
  }
  for (const a of plan.attachmentDeletes) {
    const c = copies.find((x) => x.todoId === a.todoId)!;
    c.attachmentKeys = c.attachmentKeys.filter((k) => k !== a.fileKey);
  }
  copies = copies.filter((c) => !plan.deletes.includes(c.todoId) && !plan.detaches.includes(c.todoId));
  return { ...state, copies };
}

describe('field lists', () => {
  it('locks title/deadline/submissionMode and lets the rest be overridden', () => {
    expect([...LOCKED_FIELDS]).toEqual(['title', 'deadline', 'submissionMode']);
    expect([...OVERRIDABLE_FIELDS]).toEqual(['description', 'notes', 'fileRequirement', 'attachments']);
  });
});

describe('planClassroomTaskSync', () => {
  it('creates one copy per group with values and files', () => {
    const t = task({ files: [file('k1'), file('k2')] });
    const plan = planClassroomTaskSync({ groupIds: ['g1', 'g2'], tasks: [t], copies: [] });
    expect(plan.inserts).toHaveLength(2);
    expect(plan.inserts.map((i) => i.groupId).sort()).toEqual(['g1', 'g2']);
    const ins = plan.inserts[0];
    expect(ins.classroomTaskId).toBe('ct1');
    expect(ins.phaseId).toBe('p1');
    expect(ins.values).toEqual({
      title: 'Pitch deck',
      description: 'desc',
      notes: '- slide 1\n- slide 2',
      submissionMode: 'group',
      fileRequirement: 'optional',
      deadline: D1,
    });
    expect(ins.files.map((f) => f.fileKey)).toEqual(['k1', 'k2']);
    expect(plan.updates).toEqual([]);
    expect(plan.attachmentInserts).toEqual([]);
    expect(plan.attachmentDeletes).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.detaches).toEqual([]);
  });

  it('inserts only for a newly added group', () => {
    const t = task();
    const plan = planClassroomTaskSync({ groupIds: ['g1', 'g2', 'g3'], tasks: [t], copies: [copyOf(t, 'g1'), copyOf(t, 'g2')] });
    expect(plan.inserts.map((i) => i.groupId)).toEqual(['g3']);
    expect(plan.updates).toEqual([]);
  });

  it('propagates locked fields even to copies with overrides', () => {
    const t = task({ title: 'New title', deadline: D2, submissionMode: 'individual' });
    const old = task();
    const c = copyOf(old, 'g1', { overriddenFields: ['notes', 'description', 'fileRequirement', 'attachments'] });
    const plan = planClassroomTaskSync({ groupIds: ['g1'], tasks: [t], copies: [c] });
    expect(plan.updates).toEqual([
      { todoId: c.todoId, set: { title: 'New title', deadline: D2, submissionMode: 'individual' } },
    ]);
  });

  it('compares deadlines by time and handles null', () => {
    const t = task({ deadline: new Date(D1.getTime()) });
    const plan = planClassroomTaskSync({ groupIds: ['g1'], tasks: [t], copies: [copyOf(task(), 'g1')] });
    expect(isEmpty(plan)).toBe(true);

    const noDl = task({ deadline: null });
    const plan2 = planClassroomTaskSync({ groupIds: ['g1'], tasks: [noDl], copies: [copyOf(task(), 'g1')] });
    expect(plan2.updates).toEqual([{ todoId: 'todo-ct1-g1', set: { deadline: null } }]);

    const plan3 = planClassroomTaskSync({ groupIds: ['g1'], tasks: [noDl], copies: [copyOf(noDl, 'g1')] });
    expect(isEmpty(plan3)).toBe(true);
  });

  it('skips overridden overridable fields', () => {
    const old = task();
    const t = task({ notes: '- new', description: 'new desc', fileRequirement: 'required' });
    const a = copyOf(old, 'gA', { overriddenFields: ['notes'] });
    const b = copyOf(old, 'gB');
    const plan = planClassroomTaskSync({ groupIds: ['gA', 'gB'], tasks: [t], copies: [a, b] });
    expect(plan.updates).toEqual([
      { todoId: a.todoId, set: { description: 'new desc', fileRequirement: 'required' } },
      { todoId: b.todoId, set: { description: 'new desc', notes: '- new', fileRequirement: 'required' } },
    ]);
  });

  it('syncs files to non-overridden copies only', () => {
    const t = task({ files: [file('k1'), file('k3')] });
    const a = copyOf(task(), 'gA', { attachmentKeys: ['k1', 'k2'] });
    const b = copyOf(task(), 'gB', { attachmentKeys: ['k2'], overriddenFields: ['attachments'] });
    const plan = planClassroomTaskSync({ groupIds: ['gA', 'gB'], tasks: [t], copies: [a, b] });
    expect(plan.attachmentInserts).toEqual([{ todoId: a.todoId, file: file('k3') }]);
    expect(plan.attachmentDeletes).toEqual([{ todoId: a.todoId, fileKey: 'k2' }]);
    expect(plan.updates).toEqual([]);
  });

  it('deletes unsubmitted copies and detaches submitted ones when the task is gone', () => {
    const t = task();
    const a = copyOf(t, 'gA');
    const b = copyOf(t, 'gB', { hasSubmission: true, title: 'stale' });
    const plan = planClassroomTaskSync({ groupIds: ['gA', 'gB'], tasks: [], copies: [a, b] });
    expect(plan.deletes).toEqual([a.todoId]);
    expect(plan.detaches).toEqual([b.todoId]);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([]);
  });

  it('ignores copies of groups not in groupIds', () => {
    const t = task({ title: 'changed' });
    const plan = planClassroomTaskSync({ groupIds: ['g1'], tasks: [t], copies: [copyOf(task(), 'gone')] });
    expect(plan.updates).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.inserts.map((i) => i.groupId)).toEqual(['g1']);
  });

  it('is idempotent: re-planning after applying yields an empty plan', () => {
    const t1 = task({ files: [file('k1')], title: 'changed', notes: 'n2' });
    const t2 = task({ id: 'ct2', phaseId: 'p2', deadline: null, files: [file('k9')] });
    const gone = task({ id: 'ct-gone' });
    const state = {
      groupIds: ['g1', 'g2', 'g3'],
      tasks: [t1, t2],
      copies: [
        copyOf(task(), 'g1', { attachmentKeys: ['old'] }),
        copyOf(task(), 'g2', { overriddenFields: ['notes', 'attachments'], attachmentKeys: ['mine'] }),
        copyOf(gone, 'g1'),
        copyOf(gone, 'g2', { hasSubmission: true }),
      ],
    };
    const plan = planClassroomTaskSync(state);
    expect(isEmpty(plan)).toBe(false);
    const next = applyPlan(state, plan);
    expect(isEmpty(planClassroomTaskSync(next))).toBe(true);
  });
});

describe('computeOverrideMarks', () => {
  const current: TaskFieldValues = {
    title: 'T',
    description: null,
    notes: '- a',
    submissionMode: 'group',
    fileRequirement: 'optional',
    deadline: D1,
  };

  it('accepts unchanged locked fields (form re-sends everything)', () => {
    const r = computeOverrideMarks({
      current,
      updates: { title: 'T', deadline: new Date(D1.getTime()), submissionMode: 'group', notes: '- a', description: '' },
      existing: [],
    });
    expect(r).toEqual({ lockedViolation: null, overriddenFields: [] });
  });

  it('flags a changed locked field', () => {
    expect(computeOverrideMarks({ current, updates: { title: 'X' }, existing: [] }).lockedViolation).toBe('title');
    expect(computeOverrideMarks({ current, updates: { deadline: D2 }, existing: [] }).lockedViolation).toBe('deadline');
    expect(computeOverrideMarks({ current, updates: { deadline: null }, existing: [] }).lockedViolation).toBe(
      'deadline',
    );
    expect(
      computeOverrideMarks({ current, updates: { submissionMode: 'individual' }, existing: [] }).lockedViolation,
    ).toBe('submissionMode');
  });

  it('marks changed overridable fields, deduped and ordered', () => {
    const r = computeOverrideMarks({
      current,
      updates: { fileRequirement: 'required', notes: '- b', title: undefined },
      existing: ['attachments', 'notes'],
    });
    expect(r).toEqual({ lockedViolation: null, overriddenFields: ['notes', 'fileRequirement', 'attachments'] });
  });

  it('treats null and empty string as equal for text fields', () => {
    const r = computeOverrideMarks({ current: { ...current, notes: null }, updates: { notes: '' }, existing: [] });
    expect(r.overriddenFields).toEqual([]);
  });
});

describe('summarizeDelete', () => {
  it('counts removed vs kept', () => {
    expect(summarizeDelete([{ hasSubmission: false }, { hasSubmission: true }, { hasSubmission: false }])).toEqual({
      removed: 2,
      kept: 1,
    });
    expect(summarizeDelete([])).toEqual({ removed: 0, kept: 0 });
  });
});
