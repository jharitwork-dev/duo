'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from 'cn';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { BTN_APPROVE, DIALOG_PANEL, DIALOG_TITLE, LABEL, TEXTAREA } from '@/components/cocoon/ui';
import { COMMENT_MAX } from '@/lib/comment-thread';

// "ยืนยันให้งานผ่าน?" dialog (design/mac home-14/16; mobile frame 118:2548 adds "สถานะหลังยืนยัน").
// The note to the team is optional (CONTEXT decision).
export function PassDialog({
  open,
  onOpenChange,
  pending,
  todoTitle,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  todoTitle: string;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className={DIALOG_PANEL} showCloseButton={false}>
        <form
          className="flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(note);
          }}
        >
          <DialogHeader className="items-center gap-1">
            <span aria-hidden className="text-center text-[40px] leading-none font-bold text-cocoon-green">
              ✓
            </span>
            <DialogTitle className={DIALOG_TITLE}>ยืนยันให้งานผ่าน?</DialogTitle>
            <p className="text-center text-[18px] leading-normal font-bold break-words text-cocoon-ink">{todoTitle}</p>
            <DialogDescription className="text-center text-[16px] font-medium text-cocoon-muted">
              ผลตรวจจะถูกส่งให้ทีมทราบ
            </DialogDescription>
          </DialogHeader>

          <p className="mt-4 flex items-center justify-center gap-2 rounded-[12px] bg-[rgb(0_168_107/.1)] px-4 py-2 text-[14px] font-bold text-cocoon-green">
            <span aria-hidden className="size-2 rounded-full bg-cocoon-green" />
            สถานะหลังยืนยัน: ผ่านการตรวจ
          </p>

          <label htmlFor="pass-note" className={cn(LABEL, 'mt-5 mb-2')}>
            ข้อความถึงทีม (ไม่บังคับ)
          </label>
          <Textarea
            id="pass-note"
            className={cn(TEXTAREA, 'min-h-[88px] resize-y')}
            rows={3}
            maxLength={COMMENT_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
          />

          <button
            type="submit"
            disabled={pending}
            className={cn(BTN_APPROVE, 'mt-6 inline-flex w-full items-center justify-center gap-2 disabled:opacity-70')}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            ยืนยันให้ผ่าน
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            className="mt-3 h-10 rounded-md text-[16px] font-bold text-cocoon-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-50"
          >
            กลับไปตรวจ
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
