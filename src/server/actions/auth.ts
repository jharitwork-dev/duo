'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { ROLES } from '@/lib/constants';
import type { UserRole } from '@/lib/constants';

export async function promoteRole(): Promise<{ success: boolean; role: UserRole }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  // Read the self-selected role from unsafeMetadata (set during signup)
  const selectedRole = (user.unsafeMetadata as { role?: string })?.role;

  let targetRole: UserRole;
  if (selectedRole === 'teacher') {
    // Teachers start as pending -- require superadmin approval (per D-03)
    targetRole = ROLES.TEACHER_PENDING;
  } else {
    // Students are immediately active (per D-02)
    targetRole = ROLES.STUDENT;
  }

  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: targetRole },
  });

  return { success: true, role: targetRole };
}
