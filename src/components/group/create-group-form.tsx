'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createGroup } from '@/server/actions/group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { BTN_PRIMARY, DIALOG_PANEL, DIALOG_TITLE, INPUT, LABEL } from '@/components/cocoon/ui';
import { MAX_GROUP_LIMIT } from '@/lib/group-rules';

interface CreateGroupFormProps {
  classroomId: string;
  /** Classroom default limit, shown as the placeholder. */
  classroomMaxGroupSize?: number | null;
}

export function CreateGroupForm({ classroomId, classroomMaxGroupSize = null }: CreateGroupFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedLimit = limit.trim() === '' ? null : Number(limit);
  const limitValid =
    parsedLimit === null || (Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= MAX_GROUP_LIMIT);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !limitValid) return;

    setIsSubmitting(true);
    try {
      const result = await createGroup({ classroomId, name: name.trim(), maxMembers: parsedLimit });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('สร้างกลุ่มสำเร็จ');
      setName('');
      setLimit('');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('ไม่สามารถสร้างกลุ่มได้');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className={cn(BTN_PRIMARY, 'h-10 text-[14px]')} />}>
          <Plus className="size-4" />
          สร้างกลุ่ม
      </DialogTrigger>
      <DialogContent className={DIALOG_PANEL}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className={DIALOG_TITLE}>สร้างกลุ่มใหม่</DialogTitle>
            <DialogDescription className="text-center text-[14px] text-cocoon-muted">
              ตั้งชื่อกลุ่มสำหรับนักเรียนในห้องเรียนนี้
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name" className={LABEL}>ชื่อกลุ่ม *</Label>
              <Input
                id="group-name"
                className={INPUT}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น กลุ่ม A"
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="group-limit" className={LABEL}>จำนวนสมาชิกสูงสุด</Label>
              <Input
                id="group-limit"
                className={INPUT}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_GROUP_LIMIT}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder={
                  classroomMaxGroupSize
                    ? `ใช้ค่าเริ่มต้นของห้อง (${classroomMaxGroupSize} คน)`
                    : 'ใช้ค่าเริ่มต้นของห้อง (ไม่จำกัด)'
                }
              />
              {!limitValid && (
                <p className="text-[13px] font-medium text-destructive">ใส่ตัวเลข 1–{MAX_GROUP_LIMIT} หรือเว้นว่าง</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isSubmitting || !name.trim() || !limitValid} className={cn(BTN_PRIMARY, 'w-full')}>
              {isSubmitting ? 'กำลังสร้าง...' : 'สร้างกลุ่ม'}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 text-[16px] font-bold text-cocoon-blue hover:underline"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
