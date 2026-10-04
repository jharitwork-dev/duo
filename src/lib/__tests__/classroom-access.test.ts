import { describe, it, expect } from 'vitest';
import { decideClassroomAccess } from '@/lib/classroom-access';

describe('decideClassroomAccess', () => {
  const base = { createdBy: 'owner', userId: 'u1', isTeacherMember: false };

  it('lets a superadmin in regardless of ownership', () => {
    expect(decideClassroomAccess({ ...base, role: 'superadmin' })).toBe(true);
  });

  it('lets the owning teacher in', () => {
    expect(decideClassroomAccess({ ...base, userId: 'owner', role: 'teacher' })).toBe(true);
  });

  it('lets a teacher member of the classroom in', () => {
    expect(decideClassroomAccess({ ...base, role: 'teacher', isTeacherMember: true })).toBe(true);
  });

  it('rejects any other teacher', () => {
    expect(decideClassroomAccess({ ...base, role: 'teacher' })).toBe(false);
  });

  it('rejects a student even when createdBy matches', () => {
    expect(decideClassroomAccess({ ...base, userId: 'owner', role: 'student' })).toBe(false);
    expect(decideClassroomAccess({ ...base, role: 'student', isTeacherMember: true })).toBe(false);
  });

  it('rejects teacher_pending and missing roles', () => {
    expect(decideClassroomAccess({ ...base, userId: 'owner', role: 'teacher_pending' })).toBe(false);
    expect(decideClassroomAccess({ ...base, userId: 'owner', role: null })).toBe(false);
  });
});
