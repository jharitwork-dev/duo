import { describe, it, expect } from 'vitest';
import {
  GROUP_MODES,
  GROUP_MODE_LABELS,
  effectiveGroupLimit,
  isGroupFull,
  limitWarning,
  capacityLabel,
  canStudentJoinGroup,
  canStudentCreateGroup,
  canStudentLeaveGroup,
  checkDeleteConfirmation,
  canDeleteGroup,
} from '@/lib/group-rules';

describe('GROUP_MODES', () => {
  it('lists the three modes with Thai labels', () => {
    expect(GROUP_MODES).toEqual(['teacher', 'self_join', 'self_create']);
    for (const mode of GROUP_MODES) expect(GROUP_MODE_LABELS[mode]).toBeTruthy();
  });
});

describe('effectiveGroupLimit', () => {
  it('prefers the group limit, falls back to the classroom default, else unlimited', () => {
    expect(effectiveGroupLimit(5, 3)).toBe(5);
    expect(effectiveGroupLimit(null, 3)).toBe(3);
    expect(effectiveGroupLimit(undefined, 3)).toBe(3);
    expect(effectiveGroupLimit(null, null)).toBeNull();
  });
});

describe('isGroupFull', () => {
  it('compares the member count with the limit', () => {
    expect(isGroupFull(5, 5)).toBe(true);
    expect(isGroupFull(4, 5)).toBe(false);
    expect(isGroupFull(99, null)).toBe(false);
    expect(isGroupFull(6, 5)).toBe(true); // limit lowered below the member count
  });
});

describe('limitWarning', () => {
  it('warns only when the new limit is below the current member count', () => {
    const w = limitWarning(3, 5);
    expect(typeof w).toBe('string');
    expect(w).toContain('5');
    expect(limitWarning(5, 3)).toBeNull();
    expect(limitWarning(null, 9)).toBeNull();
    expect(limitWarning(5, 5)).toBeNull();
  });
});

describe('capacityLabel', () => {
  it('formats with and without a limit', () => {
    expect(capacityLabel(3, 5)).toBe('3/5 คน');
    expect(capacityLabel(3, null)).toBe('3 คน');
  });
});

describe('canStudentJoinGroup', () => {
  const base = { hasGroup: false, memberCount: 2, limit: 5 };

  it('rejects in teacher mode', () => {
    const r = canStudentJoinGroup({ ...base, mode: 'teacher' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ครู');
  });

  it('rejects when the student already has a group', () => {
    expect(canStudentJoinGroup({ ...base, mode: 'self_join', hasGroup: true }).ok).toBe(false);
  });

  it('rejects when the group is full', () => {
    const r = canStudentJoinGroup({ ...base, mode: 'self_join', memberCount: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('เต็ม');
  });

  it('allows a groupless student into a non-full group (self_join and self_create)', () => {
    expect(canStudentJoinGroup({ ...base, mode: 'self_join' }).ok).toBe(true);
    expect(canStudentJoinGroup({ ...base, mode: 'self_create' }).ok).toBe(true);
    expect(canStudentJoinGroup({ ...base, mode: 'self_join', limit: null, memberCount: 40 }).ok).toBe(true);
  });
});

describe('canStudentCreateGroup', () => {
  it('only allows self_create without a current group', () => {
    expect(canStudentCreateGroup({ mode: 'self_create', hasGroup: false }).ok).toBe(true);
    expect(canStudentCreateGroup({ mode: 'self_create', hasGroup: true }).ok).toBe(false);
    expect(canStudentCreateGroup({ mode: 'self_join', hasGroup: false }).ok).toBe(false);
    expect(canStudentCreateGroup({ mode: 'teacher', hasGroup: false }).ok).toBe(false);
  });
});

describe('canStudentLeaveGroup', () => {
  it('rejects in teacher mode', () => {
    expect(canStudentLeaveGroup({ mode: 'teacher', groupHasSubmissions: false }).ok).toBe(false);
  });

  it('rejects once the group has submitted work, with an explanation', () => {
    const r = canStudentLeaveGroup({ mode: 'self_join', groupHasSubmissions: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ส่งงาน');
  });

  it('allows in self modes before any submission', () => {
    expect(canStudentLeaveGroup({ mode: 'self_join', groupHasSubmissions: false }).ok).toBe(true);
    expect(canStudentLeaveGroup({ mode: 'self_create', groupHasSubmissions: false }).ok).toBe(true);
  });
});

describe('checkDeleteConfirmation', () => {
  it('needs no confirmation without submissions', () => {
    expect(checkDeleteConfirmation({ submissionCount: 0, expectedName: 'A', typed: undefined }).ok).toBe(true);
  });

  it('accepts the trimmed name when submissions exist', () => {
    expect(
      checkDeleteConfirmation({ submissionCount: 2, expectedName: 'กลุ่ม A', typed: ' กลุ่ม A ' }).ok,
    ).toBe(true);
  });

  it('rejects a mismatch when submissions exist', () => {
    expect(checkDeleteConfirmation({ submissionCount: 2, expectedName: 'กลุ่ม A', typed: 'กลุ่ม B' }).ok).toBe(false);
    expect(checkDeleteConfirmation({ submissionCount: 2, expectedName: 'กลุ่ม A', typed: undefined }).ok).toBe(false);
  });

  it('always requires the name when alwaysRequire is set', () => {
    expect(
      checkDeleteConfirmation({ alwaysRequire: true, submissionCount: 0, expectedName: 'ห้อง', typed: '' }).ok,
    ).toBe(false);
    expect(
      checkDeleteConfirmation({ alwaysRequire: true, submissionCount: 0, expectedName: 'ห้อง', typed: 'ห้อง' }).ok,
    ).toBe(true);
  });
});

describe('canDeleteGroup', () => {
  it('allows a classroom editor without submissions and without confirmation', () => {
    const r = canDeleteGroup({ isClassroomEditor: true, isGroupCreator: false, groupMode: 'teacher', submissionCount: 0 });
    expect(r).toEqual({ ok: true, requiresConfirmation: false });
  });

  it('allows a classroom editor with submissions but still requires type-to-confirm', () => {
    const r = canDeleteGroup({ isClassroomEditor: true, isGroupCreator: false, groupMode: 'self_join', submissionCount: 3 });
    expect(r).toEqual({ ok: true, requiresConfirmation: true });
  });

  it('allows the self_create creator only while the group has zero submissions', () => {
    expect(
      canDeleteGroup({ isClassroomEditor: false, isGroupCreator: true, groupMode: 'self_create', submissionCount: 0 }),
    ).toEqual({ ok: true, requiresConfirmation: false });
    const r = canDeleteGroup({ isClassroomEditor: false, isGroupCreator: true, groupMode: 'self_create', submissionCount: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ส่งงาน');
  });

  it('rejects the group creator when the classroom is not in self_create mode', () => {
    expect(
      canDeleteGroup({ isClassroomEditor: false, isGroupCreator: true, groupMode: 'self_join', submissionCount: 0 }).ok,
    ).toBe(false);
    expect(
      canDeleteGroup({ isClassroomEditor: false, isGroupCreator: true, groupMode: 'teacher', submissionCount: 0 }).ok,
    ).toBe(false);
  });

  it('rejects a student who did not create the group', () => {
    expect(
      canDeleteGroup({ isClassroomEditor: false, isGroupCreator: false, groupMode: 'self_create', submissionCount: 0 }).ok,
    ).toBe(false);
    expect(
      canDeleteGroup({ isClassroomEditor: false, isGroupCreator: false, groupMode: 'self_join', submissionCount: 0 }).ok,
    ).toBe(false);
  });
});
