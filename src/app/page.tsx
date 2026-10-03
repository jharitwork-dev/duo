import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentRole } from '@/lib/auth';
import { ROLES, ROUTES } from '@/lib/constants';
import { DecorBackground } from '@/components/cocoon/decor-background';
import {
  AUTH_PRIMARY_BUTTON,
  AuthCard,
  AuthCardTitle,
  AuthColumns,
  AuthDesktopHeader,
  AuthHero,
  AuthMobileIntro,
} from '@/components/auth/auth-parts';

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
    // Authenticated but no role (or teacher_pending) — send to onboarding
    redirect(ROUTES.ONBOARDING);
  }

  // Signed-out landing: same shell and hero as the Cocoon sign-in / sign-up pages.
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center">
      <DecorBackground />
      <AuthDesktopHeader />
      <div className="flex w-full flex-1 flex-col items-center justify-center lg:max-w-[1280px] lg:px-16">
        <AuthColumns>
          <AuthMobileIntro title="ยินดีต้อนรับ" highlight="พร้อมไปต่อกับโปรเจกต์ของคุณ" />
          <AuthHero title="ยินดีต้อนรับ" />

          <AuthCard align="center">
            <AuthCardTitle mobile>เริ่มต้นใช้งาน</AuthCardTitle>
            <p className="mt-2 text-[14px] leading-normal font-medium text-cocoon-muted lg:text-[16px]">
              ส่งงาน ติดตามความคืบหน้า และรับผลตรวจได้ในที่เดียว
            </p>

            <Link href={ROUTES.SIGN_IN} className={`${AUTH_PRIMARY_BUTTON} mt-8`}>
              เข้าสู่ระบบ
            </Link>
            <Link
              href={ROUTES.SIGN_UP}
              className="mt-3 flex h-[55px] w-full items-center justify-center rounded-[12px] border border-cocoon-line bg-white text-[16px] font-bold text-cocoon-blue lg:h-[49px] lg:border-[#f1ece5]"
            >
              สมัครสมาชิก
            </Link>

            <p className="mt-6 text-center text-[12px] leading-normal font-medium text-black/30 lg:text-[14px]">
              Innovator&apos;s Cocoon · build.innovators.co.th
            </p>
          </AuthCard>
        </AuthColumns>
      </div>
    </div>
  );
}
