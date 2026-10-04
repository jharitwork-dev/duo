'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { cn } from 'cn';
import { updateGroup } from '@/server/actions/group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BTN_PRIMARY, BTN_TERTIARY, DIALOG_PANEL, DIALOG_TITLE, INPUT, LABEL } from '@/components/cocoon/ui';
import { MAX_GROUP_LIMIT, limitWarning } from '@/lib/group-rules';

interface EditGroupDialogProps {
  groupId: string;
  name: string;
  maxMembers: number | null;
  memberCount: number;
  classroomMaxGroupSize: number | null;
  /** Controlled mode; omit to render a "แก้ไขกลุ่ม" button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Rename a group and set its own member limit (empty = classroom default). */
export function EditGroupDialog(props: EditGroupDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = props.open ?? uncontrolledOpen;
  const setOpen = props.onOpenChange ?? setUncontrolledOpen;

  return (
    <>
      {props.open === undefined && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(BTN_TERTIARY, 'inline-flex h-10 items-center gap-2 px-4 text-[14px]')}
        >
          <Pencil className="size-4" aria-hidden />
          แก้ไขกลุ่ม
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={DIALOG_PANEL}>{open && <EditGroupForm {...props} onDone={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function EditGroupForm({
  groupId,
  name: initialName,
  maxMembers,
  memberCount,
  classroomMaxGroupSize,
  onDone,
}: EditGroupDialogProps & { onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [limit, setLimit] = useState(maxMembers === null ? '' : String(maxMembers));
  const [pending, setPending] = useState(false);

  const parsedLimit = limit.trim() === '' ? null : Number(limit);
  const limitValid =
    parsedLimit === null || (Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= MAX_GROUP_LIMIT);
  const preview = limitValid ? limitWarning(parsedLimit ?? classroomMaxGroupSize, memberCount) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !limitValid) return;
    setPending(true);
    try {
      const result = await updateGroup({ groupId, name: name.trim(), maxMembers: parsedLimit });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('บันทึกกลุ่มแล้ว');
      if (result.warning) toast.warning(result.warning);
      onDone();
      router.refresh();
    } catch {
      toast.error('บันทึกกลุ่มไม่สำเร็จ');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle className={DIALOG_TITLE}>แก้ไขกลุ่ม</DialogTitle>
        <DialogDescription className="text-center text-[14px] text-cocoon-muted">
          เปลี่ยนชื่อและจำนวนสมาชิกสูงสุดของกลุ่ม
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="edit-group-name" className={LABEL}>ชื่อกลุ่ม *</Label>
        <Input id="edit-group-name" className={INPUT} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-group-limit" className={LABEL}>จำนวนสมาชิกสูงสุด</Label>
        <Input
          id="edit-group-limit"
          className={INPUT}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_GROUP_LIMIT}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder={
            classroomMaxGroupSize ? `ใช้ค่าเริ่มต้นของห้อง (${classroomMaxGroupSize} คน)` : 'ใช้ค่าเริ่มต้นของห้อง (ไม่จำกัด)'
          }
        />
        {!limitValid && <p className="text-[13px] font-medium text-destructive">ใส่ตัวเลข 1–{MAX_GROUP_LIMIT}</p>}
        {preview && <p className="text-[13px] font-bold text-[#e8590c]">{preview}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pending || !name.trim() || !limitValid} className={cn(BTN_PRIMARY, 'w-full disabled:opacity-50')}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}
