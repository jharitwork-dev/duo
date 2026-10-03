'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BookmarkPlus } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveAsTemplate } from '@/server/actions/template';
import {
  BTN_PRIMARY,
  BTN_TERTIARY,
  DIALOG_PANEL,
  DIALOG_TITLE,
  INPUT,
  LABEL,
  TEXTAREA,
} from '@/components/cocoon/ui';
import type { GroupOption } from '@/components/todo/assign-todo-dialog';

const NO_TODOS = '__none__';

/** "บันทึกเป็นเทมเพลต": classroom phases + one chosen group's to-dos (or phases only). */
export function SaveTemplateDialog({
  classroomId,
  groups,
}: {
  classroomId: string;
  groups: GroupOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<string>(groups[0]?.id ?? NO_TODOS);
  const [isPending, startTransition] = useTransition();

  const items = [
    ...groups.map((g) => ({ value: g.id, label: g.name })),
    { value: NO_TODOS, label: 'ไม่รวมงาน' },
  ];

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('');
      setDescription('');
      setSource(groups[0]?.id ?? NO_TODOS);
    }
    setOpen(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await saveAsTemplate({
          classroomId,
          groupId: source === NO_TODOS ? undefined : source,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast.success('บันทึกเทมเพลตแล้ว');
        handleOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'บันทึกเทมเพลตไม่สำเร็จ');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button className={cn(BTN_TERTIARY, 'h-10 text-[14px]')} />}>
        <BookmarkPlus className="size-4" />
        บันทึกเป็นเทมเพลต
      </DialogTrigger>
      <DialogContent className={DIALOG_PANEL}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className={DIALOG_TITLE}>บันทึกเป็นเทมเพลต</DialogTitle>
            <DialogDescription className="text-center text-[14px] text-cocoon-muted">
              บันทึก Phase ของห้องเรียนนี้ พร้อมงานของกลุ่มที่เลือก (ไม่รวมไฟล์แนบ)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name" className={LABEL}>ชื่อเทมเพลต *</Label>
              <Input
                id="template-name"
                className={INPUT}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น Cocoon 2026"
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description" className={LABEL}>คำอธิบาย</Label>
              <Textarea
                id="template-description"
                className={TEXTAREA}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label className={LABEL}>ใช้งานของกลุ่ม</Label>
              <Select items={items} value={source} onValueChange={(v) => v && setSource(v)}>
                <SelectTrigger className="h-12 w-full rounded-[12px] border-[#f1ece5] bg-[#fffaf3] text-[16px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isPending || !name.trim()} className={cn(BTN_PRIMARY, 'w-full')}>
              {isPending ? 'กำลังบันทึก...' : 'บันทึกเทมเพลต'}
            </Button>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
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
