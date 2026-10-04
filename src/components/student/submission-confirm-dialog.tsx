'use client';
/* eslint-disable @next/next/no-img-element -- static Figma asset */

import { Loader2 } from 'lucide-react';
import { cn } from 'cn';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatFileSize } from '@/lib/format';

export interface SubmissionSummary {
  hasText: boolean;
  checklist: { done: number; total: number };
  files: { name: string; size: number }[];
}

interface SubmissionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todoTitle: string;
  summary: SubmissionSummary;
  submitting: boolean;
  onConfirm: () => void;
  resubmit?: boolean;
}

/** "ข้อความ · to-do 3/5 · 2 ไฟล์" (absent parts omitted). */
export function summaryLine(summary: SubmissionSummary): string {
  const parts: string[] = [];
  if (summary.hasText) parts.push('ข้อความ');
  if (summary.checklist.total > 0) parts.push(`to-do ${summary.checklist.done}/${summary.checklist.total}`);
  if (summary.files.length > 0) parts.push(`${summary.files.length} ไฟล์`);
  return parts.join(' · ') || 'หน้างานว่าง';
}

export function SubmissionConfirmDialog({
  open,
  onOpenChange,
  todoTitle,
  summary,
  submitting,
  onConfirm,
  resubmit = false,
}: SubmissionConfirmDialogProps) {
  const total = summary.files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return; // keep open while submitting
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgba(20,32,43,.48)] supports-backdrop-filter:backdrop-blur-none"
        className="w-[calc(100%-48px)] max-w-[354px] gap-4 rounded-[16px] bg-white p-6 font-sans text-cocoon-ink ring-0 sm:max-w-[354px]"
      >
        <div className="flex size-10 items-center justify-center rounded-[12px] bg-[#fff0ea]">
          <img src="/figma/0d869.svg" alt="" width={21} height={19} className="h-[19px] w-[21px]" />
        </div>

        <div className="space-y-1">
          <DialogTitle className="text-[22px] leading-normal font-bold text-cocoon-heading">
            {resubmit ? 'ยืนยันส่งอีกครั้ง?' : 'ยืนยันส่งงาน?'}
          </DialogTitle>
          <p className="text-[17px] leading-normal font-bold break-words text-[#0269a7]">{todoTitle}</p>
          <DialogDescription className="text-[14px] leading-normal font-normal text-cocoon-subtle">
            หลังส่งแล้วจะแก้ไขหน้างานไม่ได้จนกว่าครูจะตรวจ
          </DialogDescription>
        </div>

        <div className="rounded-[10px] border border-[#ebe5dd] bg-cocoon-cream p-4">
          <p className="text-[14px] leading-normal font-bold text-cocoon-heading">{summaryLine(summary)}</p>
          {summary.files.length > 0 && (
            <>
              <p className="mt-1 text-[12px] leading-normal font-medium text-cocoon-subtle">
                ไฟล์รวม {formatFileSize(total)}
              </p>
              <ul className="mt-1">
                {summary.files.map((f, i) => (
                  <li
                    key={`${f.name}-${f.size}-${i}`}
                    className="truncate text-[12px] leading-normal font-normal text-cocoon-subtle"
                  >
                    {f.name} · {formatFileSize(f.size)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={cn(
              'flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[16px] font-bold text-white disabled:opacity-80',
              resubmit ? 'bg-cocoon-yellow' : 'bg-cocoon-orange',
            )}
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {submitting ? 'กำลังส่ง…' : resubmit ? 'ยืนยันส่งอีกครั้ง' : 'ยืนยันส่งงาน'}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-[45px] w-full rounded-[10px] border border-[#dce1e5] bg-white text-[15px] font-normal text-[#53616b] disabled:opacity-50"
          >
            กลับไปแก้ไข
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
