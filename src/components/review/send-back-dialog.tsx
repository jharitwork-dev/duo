'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from 'cn';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DIALOG_PANEL, DIALOG_TITLE, LABEL, TEXTAREA } from '@/components/cocoon/ui';
import { COMMENT_MAX } from '@/lib/comment-thread';
import { REVIEW_MESSAGES } from '@/lib/review';
import { BTN_WARN } from './review-ui';

// "ส่งกลับให้แก้ไข" dialog (design/mac home-13; mobile frames 118:2286 / 123:1807 incl. the empty-feedback state).
export function SendBackDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (feedback.trim().length === 0) {
      setError(REVIEW_MESSAGES.feedbackRequired);
      return;
    }
    setError(null);
    onConfirm(feedback);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className={DIALOG_PANEL} showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col">
          <DialogHeader className="items-center gap-1">
            <span aria-hidden className="text-center text-[40px] leading-none font-bold text-cocoon-yellow">
              !
            </span>
            <DialogTitle className={DIALOG_TITLE}>ส่งกลับให้แก้ไข</DialogTitle>
            <DialogDescription className="text-center text-[16px] font-medium text-cocoon-muted">
              ระบุสิ่งที่ต้องแก้ไขให้ชัดเจน
            </DialogDescription>
          </DialogHeader>

          <label htmlFor="send-back-feedback" className={cn(LABEL, 'mt-5 mb-2 lg:text-[16px]')}>
            คำแนะนำ *
          </label>
          <Textarea
            id="send-back-feedback"
            className={cn(TEXTAREA, 'min-h-[110px] resize-y', error && 'border-cocoon-orange')}
            rows={4}
            maxLength={COMMENT_MAX}
            autoFocus
            value={feedback}
            aria-invalid={!!error}
            aria-describedby={error ? 'send-back-error' : undefined}
            onChange={(e) => {
              setFeedback(e.target.value);
              if (error && e.target.value.trim()) setError(null);
            }}
            disabled={pending}
          />
          {error && (
            <p id="send-back-error" role="alert" className="mt-2 text-[14px] font-medium text-cocoon-orange">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={cn(BTN_WARN, 'mt-6 inline-flex w-full items-center justify-center gap-2 disabled:opacity-70')}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            ส่งกลับให้แก้ไข
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            className="mt-3 h-10 rounded-md text-[16px] font-bold text-cocoon-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-50"
          >
            ยกเลิก
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
