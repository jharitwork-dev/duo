'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { deleteClassroom, setClassroomArchived } from '@/server/actions/classroom';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { useDeletionImpact } from '@/components/cocoon/use-deletion-impact';
import { BTN_TERTIARY, CARD, CARD_META, CARD_TITLE } from '@/components/cocoon/ui';

/** Archive / restore a classroom; returns true on success. */
export async function toggleClassroomArchived(classroomId: string, archived: boolean): Promise<boolean> {
  try {
    const result = await setClassroomArchived({ classroomId, archived });
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(archived ? 'เก็บห้องเรียนแล้ว' : 'นำห้องเรียนกลับมาแล้ว');
    return true;
  } catch {
    toast.error('ทำรายการไม่สำเร็จ');
    return false;
  }
}

/** Permanent classroom delete through the shared confirm dialog (always type-to-confirm). */
export function DeleteClassroomDialog({
  classroomId,
  classroomName,
  open,
  onOpenChange,
}: {
  classroomId: string;
  classroomName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const impact = useDeletionImpact('classroom', classroomId, open);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`ลบห้องเรียน "${classroomName}" ถาวร?`}
      description="ลบแล้วกู้คืนไม่ได้ — ถ้าแค่ไม่ใช้แล้ว ให้ใช้ เก็บห้องเรียน แทน"
      consequences={
        impact
          ? [
              `นักเรียน ${impact.members ?? 0} คนจะออกจากห้องเรียนนี้`,
              `${impact.groups ?? 0} กลุ่ม และ ${impact.phases ?? 0} Phase จะถูกลบ`,
              `งาน ${impact.todos} รายการ และงานที่ส่งแล้ว ${impact.submissions} ชิ้นจะถูกลบ`,
            ]
          : null
      }
      warning="ทุกอย่างในห้องเรียนนี้จะถูกลบถาวร รวมถึงไฟล์ที่ส่ง"
      typeToConfirm={classroomName}
      confirmLabel="ลบห้องเรียนถาวร"
      onConfirm={async (typed) => {
        try {
          const result = await deleteClassroom({ classroomId, confirmName: typed ?? '' });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(`ลบห้องเรียน ${result.name} แล้ว`);
          onOpenChange(false);
          router.push('/teacher');
          router.refresh();
        } catch {
          toast.error('ลบห้องเรียนไม่สำเร็จ');
        }
      }}
    />
  );
}

/** Bottom of the settings tab: archive/restore and permanent delete. */
export function ClassroomDangerZone({
  classroomId,
  classroomName,
  isArchived,
}: {
  classroomId: string;
  classroomName: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleArchive() {
    setPending(true);
    const ok = await toggleClassroomArchived(classroomId, !isArchived);
    setPending(false);
    if (ok) router.refresh();
  }

  return (
    <section className={cn(CARD, 'border-[#ffd8c2] lg:col-span-2')}>
      <h2 className={cn(CARD_TITLE, 'text-[#e8590c]')}>จัดการห้องเรียน</h2>
      <p className={CARD_META}>
        {isArchived
          ? 'ห้องเรียนนี้ถูกเก็บไว้ — ไม่แสดงในรายการหลัก นำกลับมาได้ทุกเมื่อ'
          : 'เก็บห้องเรียนเพื่อซ่อนจากรายการหลัก (นำกลับมาได้) หรือลบถาวร'}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleArchive}
          disabled={pending}
          className={cn(BTN_TERTIARY, 'inline-flex items-center justify-center gap-2 disabled:opacity-50')}
        >
          {isArchived ? <RotateCcw className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
          {isArchived ? 'นำกลับมา' : 'เก็บห้องเรียน'}
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className={cn(BTN_TERTIARY, 'inline-flex items-center justify-center gap-2 border-[#ffd8c2] text-[#e8590c] hover:bg-[#fff1e8]')}
        >
          <Trash2 className="size-4" aria-hidden />
          ลบห้องเรียนถาวร
        </button>
      </div>
      <DeleteClassroomDialog
        classroomId={classroomId}
        classroomName={classroomName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </section>
  );
}
