'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { ROLES } from '@/lib/constants';
import type { UserRole } from '@/lib/constants';

export type PromoteResult = { success: true; role: UserRole } | { success: false; needsChoice: true };

/**
 * Assign the first role after sign-up. `choice` comes from the onboarding role picker
 * (falls back to unsafeMetadata.role from older sign-up flows). With neither, the
 * caller must ask the user, so nothing is written and `needsChoice` is returned.
 */
export async function promoteRole(choice?: 'student' | 'teacher'): Promise<PromoteResult> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  // Never overwrite an existing role: a stale session token can send already-onboarded
  // users (incl. approved teachers / superadmins) back here, which used to downgrade them.
  const existingRole = (user.publicMetadata as { role?: UserRole })?.role;
  if (existingRole) return { success: true, role: existingRole };

  const selectedRole = choice ?? (user.unsafeMetadata as { role?: string })?.role;
  if (selectedRole !== 'teacher' && selectedRole !== 'student') return { success: false, needsChoice: true };

  // Teachers start as pending -- require superadmin approval (per D-03); students are immediately active (D-02)
  const targetRole: UserRole = selectedRole === 'teacher' ? ROLES.TEACHER_PENDING : ROLES.STUDENT;

  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: targetRole },
  });

  return { success: true, role: targetRole };
}
