// Full-screen "focus" layout (quick task 261021-r1c): no app shell / tab bar, build.Innovator CI.
import '@/app/register/register.css';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getCurrentRole } from '@/lib/auth';
import { ROLES, ROUTES } from '@/lib/constants';
import { CiBackdrop } from '@/components/cocoon/ci-backdrop';

export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect(ROUTES.SIGN_IN);

  const role = await getCurrentRole();
  if (!role) redirect(ROUTES.ONBOARDING);
  if (role === ROLES.TEACHER_PENDING) redirect(ROUTES.ONBOARDING);

  return (
    <div className="font-thai relative isolate min-h-dvh text-cocoon-ink" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
      <CiBackdrop />
      {children}
    </div>
  );
}
