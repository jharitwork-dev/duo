import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getCurrentRole } from '@/lib/auth';
import { ROLES, ROUTES } from '@/lib/constants';
import { AppShell } from '@/components/cocoon/app-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect(ROUTES.SIGN_IN);

  const role = await getCurrentRole();
  if (!role) redirect(ROUTES.ONBOARDING);

  // Redirect teacher_pending to onboarding (they see the waiting screen there)
  if (role === ROLES.TEACHER_PENDING) redirect(ROUTES.ONBOARDING);

  // Every signed-in role gets the Cocoon shell (desktop header at lg, bottom tab bar below lg).
  const navRole = role === ROLES.STUDENT ? 'student' : role === ROLES.SUPERADMIN ? 'superadmin' : 'teacher';
  return <AppShell role={navRole}>{children}</AppShell>;
}
