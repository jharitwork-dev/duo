'use server';

import { clerkClient } from '@clerk/nextjs/server';
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
