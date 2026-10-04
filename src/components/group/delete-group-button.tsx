'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { deleteGroup } from '@/server/actions/group';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { useDeletionImpact } from '@/components/cocoon/use-deletion-impact';
import { BTN_TERTIARY } from '@/components/cocoon/ui';
import type { DeletionImpact } from '@/server/actions/impact';

function groupConsequences(impact: DeletionImpact): string[] {
  return [
    `สมาชิก ${impact.members ?? 0} คนจะกลายเป็น "ยังไม่มีกลุ่ม" (ยังอยู่ในห้องเรียน)`,
    `งานของกลุ่ม ${impact.todos} รายการจะถูกลบ`,
    `งานที่ส่งแล้ว ${impact.submissions} ชิ้นจะถูกลบ`,
  ];
}

interface DeleteGroupButtonProps {
  groupId: string;
  groupName: string;
  /** Where to go after deleting (teacher: roster tab; student: classroom page). */
  redirectHref: string;
  /** Controlled mode (e.g. opened from an overflow menu). Omit to render a trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
}

/** "ลบกลุ่ม" with the shared confirm dialog (impact counts + type-to-confirm when work was submitted). */
export function DeleteGroupButton({
  groupId,
  groupName,
  redirectHref,
  open: controlledOpen,
  onOpenChange,
  triggerClassName,
}: DeleteGroupButtonProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const impact = useDeletionImpact('group', groupId, open);

  async function handleConfirm(typed?: string) {
    const result = await deleteGroup({ groupId, confirmName: typed });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`ลบกลุ่ม ${result.name} แล้ว`);
    setOpen(false);
    router.push(redirectHref);
    router.refresh();
  }

  return (
    <>
      {controlledOpen === undefined && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(BTN_TERTIARY, 'inline-flex h-10 items-center gap-2 px-4 text-[14px] text-[#e8590c]', triggerClassName)}
        >
          <Trash2 className="size-4" aria-hidden />
          ลบกลุ่ม
        </button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`ลบกลุ่ม "${groupName}"?`}
        description="การลบกลุ่มย้อนกลับไม่ได้"
        consequences={impact ? groupConsequences(impact) : null}
        warning={impact && impact.submissions > 0 ? 'งานที่ส่งแล้วจะถูกลบถาวร' : undefined}
        typeToConfirm={impact?.requiresConfirmation ? groupName : undefined}
        blockedReason={impact?.blockedReason}
        confirmLabel="ลบกลุ่ม"
        onConfirm={handleConfirm}
      />
    </>
  );
}
