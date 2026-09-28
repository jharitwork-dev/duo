import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getCurrentRole } from '@/lib/auth';
import { ROLES, ROUTES } from '@/lib/constants';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { StudentShell } from '@/components/cocoon/student-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect(ROUTES.SIGN_IN);

  const role = await getCurrentRole();
  if (!role) redirect(ROUTES.ONBOARDING);

  // Redirect teacher_pending to onboarding (they see the waiting screen there)
  if (role === ROLES.TEACHER_PENDING) redirect(ROUTES.ONBOARDING);

  // Students get the Cocoon shell (decor background + bottom tab bar).
  if (role === ROLES.STUDENT) return <StudentShell>{children}</StudentShell>;

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
