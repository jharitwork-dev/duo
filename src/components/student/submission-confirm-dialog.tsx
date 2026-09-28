'use client';
/* eslint-disable @next/next/no-img-element -- static Figma asset */

import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatFileSize } from '@/lib/format';

interface SubmissionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todoTitle: string;
  files: { name: string; size: number }[];
  submitting: boolean;
  onConfirm: () => void;
}

export function SubmissionConfirmDialog({
  open,
  onOpenChange,
  todoTitle,
  files,
  submitting,
  onConfirm,
}: SubmissionConfirmDialogProps) {
  const total = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return; // keep open while uploading
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
            ยืนยันส่งงาน?
          </DialogTitle>
          <p className="text-[17px] leading-normal font-bold text-[#0269a7]">{todoTitle}</p>
          <DialogDescription className="text-[14px] leading-normal font-normal text-cocoon-subtle">
            ตรวจสอบรายการไฟล์ให้ครบก่อนยืนยันส่งงาน
          </DialogDescription>
        </div>

        <div className="rounded-[10px] border border-[#ebe5dd] bg-cocoon-cream p-4">
          <p className="text-[14px] leading-normal font-bold text-cocoon-heading">
            เลือกแล้ว {files.length} ไฟล์ · {formatFileSize(total)}
          </p>
          <ul className="mt-1">
            {files.map((f) => (
              <li
                key={`${f.name}-${f.size}`}
                className="truncate text-[12px] leading-normal font-normal text-cocoon-subtle"
              >
                {f.name} · {formatFileSize(f.size)}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-cocoon-orange text-[16px] font-bold text-white disabled:opacity-80"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {submitting ? 'กำลังส่ง…' : 'ยืนยันส่งงาน'}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-[45px] w-full rounded-[10px] border border-[#dce1e5] bg-white text-[15px] font-normal text-[#53616b] disabled:opacity-50"
          >
            กลับไปตรวจไฟล์
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
