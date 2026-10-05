// Pure classroom-teacher assignment decisions (no DB / framework imports).
import { ROLES, type UserRole } from '@/lib/constants';

export const ERR_TARGET_NOT_TEACHER = 'เพิ่มได้เฉพาะผู้ใช้ที่ได้รับสิทธิ์ครูแล้ว';
export const ERR_ALREADY_TEACHER = 'ครูคนนี้อยู่ในห้องเรียนนี้แล้ว';
export const ERR_IS_STUDENT = 'ผู้ใช้นี้เป็นนักเรียนในห้องเรียนนี้ ต้องนำออกจากห้องก่อนจึงจะเพิ่มเป็นครูได้';
export const ERR_REMOVE_OWNER = 'ไม่สามารถนำเจ้าของห้องเรียนออกได้';
export const ERR_TEACHER_NOT_FOUND = 'ไม่พบครูคนนี้ในห้องเรียน';
export const ERR_NOT_A_TEACHER = 'ผู้ใช้นี้ไม่ใช่ครูของห้องเรียน';

export type TeacherDecision = { ok: true } | { ok: false; error: string };

type MemberRole = 'teacher' | 'student' | null;

/**
 * Only a superadmin or the classroom owner may add/remove classroom teachers.
 * Deliberately stricter than decideClassroomAccess: teacher members can edit the
 * classroom but cannot manage who else teaches it.
 */
export function canManageClassroomTeachers(input: {
  role: UserRole | null;
  userId: string;
  createdBy: string;
}): boolean {
  if (input.role === ROLES.SUPERADMIN) return true;
  if (input.role !== ROLES.TEACHER) return false;
  return input.userId === input.createdBy;
}

/** Target must hold the global 'teacher' role and not already be in the classroom. */
export function decideAddTeacher(input: { targetRole: string | null; existingMemberRole: MemberRole }): TeacherDecision {
  if (input.targetRole !== ROLES.TEACHER) return { ok: false, error: ERR_TARGET_NOT_TEACHER };
  if (input.existingMemberRole === 'teacher') return { ok: false, error: ERR_ALREADY_TEACHER };
  if (input.existingMemberRole === 'student') return { ok: false, error: ERR_IS_STUDENT };
  return { ok: true };
}

/** The owner can never be removed; only existing teacher members can. */
export function decideRemoveTeacher(input: {
  targetUserId: string;
  createdBy: string;
  memberRole: MemberRole;
}): TeacherDecision {
  if (input.targetUserId === input.createdBy) return { ok: false, error: ERR_REMOVE_OWNER };
  if (input.memberRole === null) return { ok: false, error: ERR_TEACHER_NOT_FOUND };
  if (input.memberRole !== 'teacher') return { ok: false, error: ERR_NOT_A_TEACHER };
  return { ok: true };
}
