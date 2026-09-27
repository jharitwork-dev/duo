import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentRole } from '@/lib/auth';
import { ROLES, ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const role = await getCurrentRole();

    if (role === ROLES.TEACHER || role === ROLES.SUPERADMIN) {
      redirect(ROUTES.TEACHER_DASHBOARD);
    }
    if (role === ROLES.STUDENT) {
      redirect(ROUTES.STUDENT_DASHBOARD);
    }
    if (role === ROLES.TEACHER_PENDING) {
      redirect(ROUTES.ONBOARDING);
    }
    // Authenticated but no role — send to onboarding
    redirect(ROUTES.ONBOARDING);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Duo</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          แพลตฟอร์มการเรียนรู้แบบโปรเจกต์
        </p>
      </div>
      <div className="flex gap-4">
        <Button render={<Link href={ROUTES.SIGN_IN} />} nativeButton={false} size="lg">
          เข้าสู่ระบบ
        </Button>
        <Button render={<Link href={ROUTES.SIGN_UP} />} nativeButton={false} size="lg" variant="outline">
          สมัครสมาชิก
        </Button>
      </div>
    </div>
  );
}
