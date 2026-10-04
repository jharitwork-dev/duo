'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from 'cn';
import { BTN_APPROVE } from '@/components/cocoon/ui';
import { approveSubmission, rejectSubmission } from '@/server/actions/review';
import { reviewListHref } from '@/lib/review';
import { BTN_WARN } from './review-ui';
import { SendBackDialog } from './send-back-dialog';
import { PassDialog } from './pass-dialog';

// Footer of the review detail (design/mac home-12): hint + ให้แก้ไข (yellow) / ให้ผ่าน (green).
export function ReviewActions({
  submissionId,
  todoTitle,
  classroomId,
  phaseId,
}: {
  submissionId: string;
  todoTitle: string;
  classroomId: string;
  phaseId: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'send-back' | 'pass' | null>(null);
  const [pending, startTransition] = useTransition();

  function fail(error: string) {
    setDialog(null);
    toast.error(error);
    router.refresh();
  }

  function reject(feedback: string) {
    startTransition(async () => {
      const result = await rejectSubmission({ submissionId, feedback }).catch(() => null);
      if (!result) return fail('บันทึกผลไม่สำเร็จ');
      if (!result.success) return fail(result.error);
      toast.success('ส่งกลับให้แก้ไขแล้ว');
      router.push(reviewListHref({ classroom: classroomId, phase: phaseId, tab: 'rejected', done: 'rejected' }));
      router.refresh();
    });
  }

  function approve(note: string) {
    startTransition(async () => {
      const result = await approveSubmission({ submissionId, note }).catch(() => null);
      if (!result) return fail('บันทึกผลไม่สำเร็จ');
      if (!result.success) return fail(result.error);
      const description = result.unlockedPhaseName
        ? `ปลดล็อค ${result.unlockedPhaseName} ให้ทีมแล้ว`
        : result.phaseCompleted
          ? 'ทีมผ่าน Phase นี้แล้ว'
          : undefined;
      toast.success('บันทึกผลแล้ว', { description });
      router.push(reviewListHref({ classroom: classroomId, phase: phaseId, tab: 'approved', done: 'approved' }));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <p className="text-[16px] leading-normal font-medium text-cocoon-blue">ตรวจไฟล์ให้ครบก่อนบันทึกผล</p>
      <div className="grid grid-cols-2 gap-3 lg:flex lg:gap-4">
        <button
          type="button"
          onClick={() => setDialog('send-back')}
          disabled={pending}
          className={cn(BTN_WARN, 'w-full lg:w-[205px] disabled:opacity-70')}
        >
          ให้แก้ไข
        </button>
        <button
          type="button"
          onClick={() => setDialog('pass')}
          disabled={pending}
          className={cn(BTN_APPROVE, 'w-full lg:w-[217px] disabled:opacity-70')}
        >
          ให้ผ่าน
        </button>
      </div>

      <SendBackDialog
        open={dialog === 'send-back'}
        onOpenChange={(open) => setDialog(open ? 'send-back' : null)}
        pending={pending}
        onConfirm={reject}
      />
      <PassDialog
        open={dialog === 'pass'}
        onOpenChange={(open) => setDialog(open ? 'pass' : null)}
        pending={pending}
        todoTitle={todoTitle}
        onConfirm={approve}
      />
    </div>
  );
}
