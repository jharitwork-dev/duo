'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

export async function approveTeacher(teacherUserId: string): Promise<{ success: boolean }> {
  await requireRole(ROLES.SUPERADMIN);

  const client = await clerkClient();
  await client.users.updateUserMetadata(teacherUserId, {
    publicMetadata: { role: ROLES.TEACHER },
  });

  return { success: true };
}

export async function rejectTeacher(teacherUserId: string): Promise<{ success: boolean }> {
  await requireRole(ROLES.SUPERADMIN);

  const client = await clerkClient();
  await client.users.updateUserMetadata(teacherUserId, {
    publicMetadata: { role: ROLES.STUDENT }, // Demote to student
  });

  return { success: true };
}

const ASSIGNABLE_ROLES = [ROLES.TEACHER, ROLES.STUDENT] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * Superadmin sets a user's role (teacher ↔ student) from the admin user list.
 * Superadmin accounts (incl. the caller) cannot be changed here.
 */
export async function setUserRole(
  targetUserId: string,
  role: AssignableRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(ROLES.SUPERADMIN);
  if (!ASSIGNABLE_ROLES.includes(role)) return { ok: false, error: 'บทบาทไม่ถูกต้อง' };

  const { userId } = await auth();
  if (targetUserId === userId) return { ok: false, error: 'เปลี่ยนบทบาทของตัวเองไม่ได้' };

  const client = await clerkClient();
  const target = await client.users.getUser(targetUserId);
  if ((target.publicMetadata as { role?: string })?.role === ROLES.SUPERADMIN) {
    return { ok: false, error: 'เปลี่ยนบทบาทผู้ดูแลระบบไม่ได้' };
  }

  await client.users.updateUserMetadata(targetUserId, { publicMetadata: { role } });
  return { ok: true };
}
