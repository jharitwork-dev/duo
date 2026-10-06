import { describe, it, expect } from 'vitest';
import {
  TEACHER_RANK_LABEL,
  effectiveTeacherRank,
  isClassroomTeacher,
  decideSetTeacherRank,
  decideGroupTeacherChange,
  sortResponsibleTeachers,
  formatResponsibleTeachers,
  ERR_OWNER_RANK_FIXED,
  ERR_INVALID_RANK,
  ERR_ASSIGN_OTHERS,
  ERR_SELF_NOT_TEACHER,
  type ResponsibleTeacher,
} from '@/lib/group-teachers';
import { ERR_TEACHER_NOT_FOUND, ERR_NOT_A_TEACHER } from '@/lib/classroom-teachers';

describe('TEACHER_RANK_LABEL', () => {
  it('maps ranks to Thai labels', () => {
    expect(TEACHER_RANK_LABEL.teacher).toBe('ครู');
    expect(TEACHER_RANK_LABEL.assistant).toBe('ผู้ช่วยครู');
  });
});

describe('effectiveTeacherRank', () => {
  it('always treats the owner as ครู', () => {
    expect(effectiveTeacherRank({ userId: 'owner', createdBy: 'owner', rank: 'assistant' })).toBe('teacher');
  });

  it('defaults null / unknown ranks to ครู', () => {
    expect(effectiveTeacherRank({ userId: 'u1', createdBy: 'owner', rank: null })).toBe('teacher');
    expect(effectiveTeacherRank({ userId: 'u1', createdBy: 'owner', rank: undefined })).toBe('teacher');
    expect(effectiveTeacherRank({ userId: 'u1', createdBy: 'owner', rank: 'boss' })).toBe('teacher');
  });

  it('keeps assistant for non-owners', () => {
    expect(effectiveTeacherRank({ userId: 'u1', createdBy: 'owner', rank: 'assistant' })).toBe('assistant');
  });
});

describe('isClassroomTeacher', () => {
  it('counts the owner even without a member row', () => {
    expect(isClassroomTeacher({ userId: 'owner', createdBy: 'owner', memberRole: null })).toBe(true);
  });

  it('counts teacher members', () => {
    expect(isClassroomTeacher({ userId: 'u1', createdBy: 'owner', memberRole: 'teacher' })).toBe(true);
  });

  it('rejects students and non-members', () => {
    expect(isClassroomTeacher({ userId: 'u1', createdBy: 'owner', memberRole: 'student' })).toBe(false);
    expect(isClassroomTeacher({ userId: 'u1', createdBy: 'owner', memberRole: null })).toBe(false);
  });
});

describe('decideSetTeacherRank', () => {
  it('rejects changing the owner rank', () => {
    expect(
      decideSetTeacherRank({ targetUserId: 'owner', createdBy: 'owner', memberRole: 'teacher', rank: 'assistant' }),
    ).toEqual({ ok: false, error: ERR_OWNER_RANK_FIXED });
  });

  it('rejects non-members', () => {
    expect(
      decideSetTeacherRank({ targetUserId: 'u1', createdBy: 'owner', memberRole: null, rank: 'assistant' }),
    ).toEqual({ ok: false, error: ERR_TEACHER_NOT_FOUND });
  });

  it('rejects students', () => {
    expect(
      decideSetTeacherRank({ targetUserId: 'u1', createdBy: 'owner', memberRole: 'student', rank: 'assistant' }),
    ).toEqual({ ok: false, error: ERR_NOT_A_TEACHER });
  });

  it('rejects invalid ranks', () => {
    expect(
      decideSetTeacherRank({ targetUserId: 'u1', createdBy: 'owner', memberRole: 'teacher', rank: 'boss' }),
    ).toEqual({ ok: false, error: ERR_INVALID_RANK });
  });

  it('allows a valid rank for a teacher member', () => {
    expect(
      decideSetTeacherRank({ targetUserId: 'u1', createdBy: 'owner', memberRole: 'teacher', rank: 'assistant' }),
    ).toEqual({ ok: true });
    expect(
      decideSetTeacherRank({ targetUserId: 'u1', createdBy: 'owner', memberRole: 'teacher', rank: 'teacher' }),
    ).toEqual({ ok: true });
  });
});

describe('decideGroupTeacherChange', () => {
  it('lets a classroom teacher change themselves without manage rights', () => {
    expect(
      decideGroupTeacherChange({ actorUserId: 'u1', targetUserId: 'u1', canManage: false, targetIsClassroomTeacher: true }),
    ).toEqual({ ok: true });
  });

  it('rejects self-assign by a non-classroom teacher', () => {
    expect(
      decideGroupTeacherChange({ actorUserId: 'u1', targetUserId: 'u1', canManage: false, targetIsClassroomTeacher: false }),
    ).toEqual({ ok: false, error: ERR_SELF_NOT_TEACHER });
  });

  it('rejects assigning others without manage rights', () => {
    expect(
      decideGroupTeacherChange({ actorUserId: 'u1', targetUserId: 'u2', canManage: false, targetIsClassroomTeacher: true }),
    ).toEqual({ ok: false, error: ERR_ASSIGN_OTHERS });
  });

  it('rejects assigning a non-teacher even with manage rights', () => {
    expect(
      decideGroupTeacherChange({ actorUserId: 'owner', targetUserId: 'u2', canManage: true, targetIsClassroomTeacher: false }),
    ).toEqual({ ok: false, error: ERR_NOT_A_TEACHER });
  });

  it('lets a manager assign a classroom teacher', () => {
    expect(
      decideGroupTeacherChange({ actorUserId: 'owner', targetUserId: 'u2', canManage: true, targetIsClassroomTeacher: true }),
    ).toEqual({ ok: true });
  });
});

describe('sortResponsibleTeachers', () => {
  it('puts ครู before ผู้ช่วยครู then sorts by name, without mutating input', () => {
    const input: ResponsibleTeacher[] = [
      { userId: 'a', name: 'ข', rank: 'assistant' },
      { userId: 'b', name: 'ค', rank: 'teacher' },
      { userId: 'c', name: 'ก', rank: 'teacher' },
    ];
    const copy = [...input];
    expect(sortResponsibleTeachers(input).map((t) => t.userId)).toEqual(['c', 'b', 'a']);
    expect(input).toEqual(copy);
  });
});

describe('formatResponsibleTeachers', () => {
  it('formats names with rank labels', () => {
    expect(
      formatResponsibleTeachers([
        { userId: '1', name: 'ก', rank: 'teacher' },
        { userId: '2', name: 'ข', rank: 'assistant' },
      ]),
    ).toBe('ก (ครู), ข (ผู้ช่วยครู)');
  });

  it('returns empty string for no teachers', () => {
    expect(formatResponsibleTeachers([])).toBe('');
  });
});
