'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveTeacher, rejectTeacher } from '@/server/actions/admin';
import { Button } from '@/components/ui/button';

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
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        อนุมัติ
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleReject}
        disabled={isPending}
      >
        ปฏิเสธ
      </Button>
    </div>
  );
}
