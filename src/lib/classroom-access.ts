// Pure classroom authorization decision (no DB / framework imports).
import { ROLES, type UserRole } from '@/lib/constants';

/**
 * A caller may edit a classroom when they are a superadmin, or a teacher (global role)
 * who either owns the classroom or is a teacher member of it.
 */
export function decideClassroomAccess(input: {
  createdBy: string;
  userId: string;
  role: UserRole | null;
  isTeacherMember: boolean;
}): boolean {
  if (input.role === ROLES.SUPERADMIN) return true;
  if (input.role !== ROLES.TEACHER) return false;
  return input.createdBy === input.userId || input.isTeacherMember;
}
