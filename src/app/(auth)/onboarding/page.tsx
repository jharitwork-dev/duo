'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { promoteRole } from '@/server/actions/auth';
import type { UserRole } from '@/lib/constants';

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'pending' | 'error'>('loading');

  useEffect(() => {
    async function promote() {
      try {
        const result = await promoteRole();
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
  }, [router]);

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border p-8 shadow-sm">
        <div className="text-4xl">&#x23F3;</div>
        <h1 className="text-xl font-semibold">รอการอนุมัติจากผู้ดูแลระบบ</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          บัญชีครูของคุณกำลังรอการอนุมัติ กรุณารอสักครู่แล้วลองเข้าสู่ระบบอีกครั้ง
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border p-8 shadow-sm">
        <h1 className="text-xl font-semibold">เกิดข้อผิดพลาด</h1>
        <p className="text-muted-foreground">ไม่สามารถตั้งค่าบัญชีได้ กรุณาลองอีกครั้ง</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground">กำลังตั้งค่าบัญชี...</p>
    </div>
  );
}
