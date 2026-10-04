'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { cn } from 'cn';
import { leaveGroup } from '@/server/actions/group';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { DeleteGroupButton } from '@/components/group/delete-group-button';
import { BTN_TERTIARY } from '@/components/cocoon/ui';

/**
 * Student-side group actions in self_join / self_create classrooms: leave the group, and (creator
 * in self_create) delete it. The server decides eligibility (e.g. blocked once work was submitted).
 */
export function StudentGroupActions({
  classroomId,
  groupId,
  groupName,
  canDelete,
}: {
  classroomId: string;
  groupId: string;
  groupName: string;
  /** Caller created this group and the classroom is in self_create mode. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const classroomHref = `/student/classroom/${classroomId}`;

  return (
    <div className="mx-[33px] mt-8 flex flex-col gap-2 border-t border-cocoon-line pt-5 sm:flex-row sm:justify-end lg:mx-0">
      <button
        type="button"
        onClick={() => setLeaveOpen(true)}
        className={cn(BTN_TERTIARY, 'inline-flex h-10 items-center justify-center gap-2 px-4 text-[14px]')}
      >
        <LogOut className="size-4" aria-hidden />
        ออกจากกลุ่ม
      </button>
      {canDelete && <DeleteGroupButton groupId={groupId} groupName={groupName} redirectHref={classroomHref} />}

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`ออกจาก ${groupName}?`}
        consequences={['คุณจะกลับไปเลือกหรือสร้างกลุ่มใหม่ได้', 'ออกได้เฉพาะตอนที่กลุ่มยังไม่ได้ส่งงาน']}
        confirmLabel="ออกจากกลุ่ม"
        onConfirm={async () => {
          try {
            const result = await leaveGroup({ groupId });
            if (!result.success) {
              toast.error(result.error);
              setLeaveOpen(false);
              return;
            }
            toast.success(`ออกจาก ${groupName} แล้ว`);
            setLeaveOpen(false);
            router.push(classroomHref);
            router.refresh();
          } catch {
            toast.error('ออกจากกลุ่มไม่สำเร็จ');
          }
        }}
      />
    </div>
  );
}
