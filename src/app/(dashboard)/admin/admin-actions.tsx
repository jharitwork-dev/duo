'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveTeacher, rejectTeacher } from '@/server/actions/admin';
import { Button } from '@/components/ui/button';
import { cn } from 'cn';
import { BTN_APPROVE, BTN_TERTIARY } from '@/components/cocoon/ui';

interface AdminActionsProps {
  teacherUserId: string;
}

export function AdminActions({ teacherUserId }: AdminActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleApprove() {
    startTransition(async () => {
      await approveTeacher(teacherUserId);
      router.refresh();
    });
  }

  function handleReject() {
    startTransition(async () => {
      await rejectTeacher(teacherUserId);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button onClick={handleApprove} disabled={isPending} className={cn(BTN_APPROVE, 'h-10 text-[14px]')}>
        อนุมัติ
      </Button>
      <Button
        variant="outline"
        className={cn(BTN_TERTIARY, 'h-10 text-[14px]')}
        onClick={handleReject}
        disabled={isPending}
      >
        ปฏิเสธ
      </Button>
    </div>
  );
}
