'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from 'cn';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BTN_DANGER, BTN_TERTIARY, DIALOG_PANEL, DIALOG_TITLE, INPUT, LABEL } from '@/components/cocoon/ui';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** What will happen. `null` renders a loading skeleton (impact still being fetched). */
  consequences: string[] | null;
  /** Highlighted warning, e.g. "งานที่ส่งแล้วจะถูกลบถาวร". */
  warning?: string;
  /** When set, the confirm button stays disabled until this exact text (trimmed) is typed. */
  typeToConfirm?: string;
  confirmLabel: string;
  /** Disable confirming entirely and show this reason instead (e.g. not allowed). */
  blockedReason?: string;
  onConfirm: (typed?: string) => Promise<void>;
}

/**
 * The ONE destructive confirm used across the app (Cocoon style): title, consequences list,
 * optional warning, optional type-to-confirm, orange destructive button.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  // Remount the body on every open so typed text and pending state reset.
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className={cn(DIALOG_PANEL, 'max-w-[calc(100%-2rem)] gap-0 ring-0')}>
        {props.open && <ConfirmBody {...props} />}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmBody({
  onOpenChange,
  title,
  description,
  consequences,
  warning,
  typeToConfirm,
  confirmLabel,
  blockedReason,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const needsTyping = typeToConfirm !== undefined;
  const matches = !needsTyping || typed.trim() === typeToConfirm.trim();
  const disabled = pending || !matches || consequences === null || Boolean(blockedReason);

  async function handleConfirm() {
    if (disabled) return;
    setPending(true);
    try {
      await onConfirm(needsTyping ? typed.trim() : undefined);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void handleConfirm();
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#fff1e8] text-[#e8590c]">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <AlertDialogTitle className={DIALOG_TITLE}>{title}</AlertDialogTitle>
        {description && (
          <AlertDialogDescription className="text-[14px] leading-normal font-medium text-cocoon-muted">
            {description}
          </AlertDialogDescription>
        )}
      </div>

      {consequences === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลด">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        consequences.length > 0 && (
          <ul className="space-y-1.5 rounded-[12px] border border-[#f1ece5] bg-[#fffaf3] px-4 py-3 text-[14px] leading-normal font-medium text-cocoon-ink">
            {consequences.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden className="text-[#e8590c]">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )
      )}

      {warning && !blockedReason && (
        <p className="rounded-[12px] bg-[#fff1e8] px-4 py-3 text-[14px] leading-normal font-bold text-[#e8590c]">
          {warning}
        </p>
      )}

      {blockedReason && (
        <p className="rounded-[12px] bg-cocoon-blue-soft px-4 py-3 text-[14px] leading-normal font-bold text-cocoon-blue">
          {blockedReason}
        </p>
      )}

      {needsTyping && !blockedReason && (
        <div className="space-y-2">
          <Label htmlFor="confirm-type" className={LABEL}>
            พิมพ์ &quot;{typeToConfirm}&quot; เพื่อยืนยัน
          </Label>
          <Input
            id="confirm-type"
            className={INPUT}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={BTN_TERTIARY} onClick={() => onOpenChange(false)} disabled={pending}>
          ยกเลิก
        </button>
        {!blockedReason && (
          <button type="submit" className={cn(BTN_DANGER, 'disabled:opacity-50')} disabled={disabled}>
            {pending ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        )}
      </div>
    </form>
  );
}
