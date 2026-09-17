import { auth } from '@clerk/nextjs/server';
import type { UserRole } from '@/lib/constants';

export async function getCurrentRole(): Promise<UserRole | null> {
  const { sessionClaims } = await auth();
  return (sessionClaims?.metadata?.role as UserRole) ?? null;
}

export async function requireRole(...allowed: UserRole[]): Promise<UserRole> {
  const role = await getCurrentRole();
  if (!role || !allowed.includes(role)) {
    throw new Error('Unauthorized');
  }
  return role;
}

export async function getCurrentUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}
