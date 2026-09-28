'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@clerk/nextjs';
import { promoteRole } from '@/server/actions/auth';
import type { UserRole } from '@/lib/constants';
import { Hourglass } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'pending' | 'error'>('loading');
  const { isLoaded, session } = useSession();
  const started = useRef(false);

  useEffect(() => {
    // Run once: session identity changes after reload() and must not re-trigger promotion.
    if (!isLoaded || started.current) return;
    started.current = true;

    async function promote() {
      try {
        const result = await promoteRole();
        // Refresh the session token so the new role is in sessionClaims before we navigate;
        // otherwise the dashboard layout sees no role and bounces back here in a loop.
        await session?.reload();
        await session?.getToken({ skipCache: true });
        handleRoleRedirect(result.role);
      } catch {
        setStatus('error');
      }
    }

    function handleRoleRedirect(role: UserRole) {
      switch (role) {
        case 'student':
          router.push('/student');
          break;
        case 'teacher':
          router.push('/teacher');
          break;
        case 'teacher_pending':
          setStatus('pending');
          break;
        case 'superadmin':
          router.push('/admin');
          break;
        default:
          router.push('/');
      }
    }

    promote();
  }, [router, isLoaded, session]);

  const card =
    'mx-[33px] flex w-[calc(100%-66px)] max-w-[440px] flex-col items-center gap-3 rounded-[16px] border border-[#f1ece5] bg-white p-8 text-center lg:mx-auto lg:mt-[54px] lg:w-full';

  if (status === 'pending') {
    return (
      <div className={card}>
        <div className="flex size-14 items-center justify-center rounded-[14px] bg-[#fff0ea]">
          <Hourglass className="size-7 text-cocoon-orange" aria-hidden />
        </div>
        <h1 className="text-[22px] leading-normal font-bold text-cocoon-ink">รอการอนุมัติจากผู้ดูแลระบบ</h1>
        <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
          บัญชีครูของคุณกำลังรอการอนุมัติ กรุณารอสักครู่แล้วลองเข้าสู่ระบบอีกครั้ง
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={card}>
        <h1 className="text-[22px] leading-normal font-bold text-cocoon-ink">เกิดข้อผิดพลาด</h1>
        <p className="text-[14px] leading-normal font-medium text-cocoon-muted">ไม่สามารถตั้งค่าบัญชีได้ กรุณาลองอีกครั้ง</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 h-[49px] w-full rounded-[12px] bg-cocoon-orange text-[16px] font-bold text-white hover:opacity-90"
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  // Loading state
  return (
    <div className={card}>
      <div className="size-9 animate-spin rounded-full border-4 border-cocoon-blue border-t-transparent" />
      <p className="text-[16px] leading-normal font-medium text-cocoon-muted">กำลังตั้งค่าบัญชี...</p>
    </div>
  );
}
