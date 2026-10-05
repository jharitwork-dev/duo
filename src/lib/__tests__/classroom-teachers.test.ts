import { describe, it, expect } from 'vitest';
import {
  canManageClassroomTeachers,
  decideAddTeacher,
  decideRemoveTeacher,
} from '@/lib/classroom-teachers';

describe('canManageClassroomTeachers', () => {
  it('lets a superadmin manage any classroom', () => {
    expect(canManageClassroomTeachers({ role: 'superadmin', userId: 'x', createdBy: 'owner' })).toBe(true);
  });

  it('lets the owning teacher manage', () => {
    expect(canManageClassroomTeachers({ role: 'teacher', userId: 'owner', createdBy: 'owner' })).toBe(true);
  });

  it('rejects teacher members who are not the owner', () => {
    expect(canManageClassroomTeachers({ role: 'teacher', userId: 'u1', createdBy: 'owner' })).toBe(false);
  });

  it('rejects students, pending teachers and missing roles even when they match createdBy', () => {
    expect(canManageClassroomTeachers({ role: 'student', userId: 'owner', createdBy: 'owner' })).toBe(false);
    expect(canManageClassroomTeachers({ role: 'teacher_pending', userId: 'owner', createdBy: 'owner' })).toBe(false);
    expect(canManageClassroomTeachers({ role: null, userId: 'owner', createdBy: 'owner' })).toBe(false);
  });
});

describe('decideAddTeacher', () => {
  it('allows an approved teacher who is not in the classroom', () => {
    expect(decideAddTeacher({ targetRole: 'teacher', existingMemberRole: null })).toEqual({ ok: true });
  });

  it.each(['student', 'teacher_pending', 'superadmin', null])('rejects target role %s', (targetRole) => {
    expect(decideAddTeacher({ targetRole, existingMemberRole: null })).toEqual({
      ok: false,
      error: 'เพิ่มได้เฉพาะผู้ใช้ที่ได้รับสิทธิ์ครูแล้ว',
    });
  });

  it('rejects a teacher already in the classroom', () => {
    expect(decideAddTeacher({ targetRole: 'teacher', existingMemberRole: 'teacher' })).toEqual({
      ok: false,
      error: 'ครูคนนี้อยู่ในห้องเรียนนี้แล้ว',
    });
  });

  it('rejects a user who is a student member of the classroom', () => {
    expect(decideAddTeacher({ targetRole: 'teacher', existingMemberRole: 'student' })).toEqual({
      ok: false,
      error: 'ผู้ใช้นี้เป็นนักเรียนในห้องเรียนนี้ ต้องนำออกจากห้องก่อนจึงจะเพิ่มเป็นครูได้',
    });
  });
});

describe('decideRemoveTeacher', () => {
  it('never removes the owner', () => {
    expect(decideRemoveTeacher({ targetUserId: 'owner', createdBy: 'owner', memberRole: 'teacher' })).toEqual({
      ok: false,
      error: 'ไม่สามารถนำเจ้าของห้องเรียนออกได้',
    });
  });

  it('rejects a user with no membership', () => {
    expect(decideRemoveTeacher({ targetUserId: 'u1', createdBy: 'owner', memberRole: null })).toEqual({
      ok: false,
      error: 'ไม่พบครูคนนี้ในห้องเรียน',
    });
  });

  it('rejects a student member', () => {
    expect(decideRemoveTeacher({ targetUserId: 'u1', createdBy: 'owner', memberRole: 'student' })).toEqual({
      ok: false,
      error: 'ผู้ใช้นี้ไม่ใช่ครูของห้องเรียน',
    });
  });

  it('allows removing a non-owner teacher member', () => {
    expect(decideRemoveTeacher({ targetUserId: 'u1', createdBy: 'owner', memberRole: 'teacher' })).toEqual({
      ok: true,
    });
  });
});
