'use client';
/* eslint-disable @next/next/no-img-element -- static Figma assets */

import { useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from 'cn';
import { getSubmissionFileUrl } from '@/server/actions/submission';
import { formatSubmissionDate } from '@/lib/format';
import { StatusPill } from '@/components/cocoon/status-pill';
import { SubmissionFileRow } from './submission-file-row';

export interface StudentSubmission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date | string;
  attempt: number;
  files: { id: string; fileName: string; fileSize: number }[];
}

const STATUS_LABEL: Record<StudentSubmission['status'], string> = {
  pending: 'รอตรวจ',
  approved: 'ผ่านการตรวจ',
  rejected: 'ต้องแก้ไข',
};

const STATUS_COLOR: Record<StudentSubmission['status'], string> = {
  pending: 'text-cocoon-blue',
  approved: 'text-cocoon-green',
  rejected: 'text-[#c98200]',
};

export const PRIMARY_BUTTON_CLASS =
  'flex h-[55px] w-full items-center justify-center rounded-[12px] bg-cocoon-orange text-[16px] font-bold text-white transition-opacity disabled:opacity-50';

export function HistoryCard({ submissions }: { submissions: StudentSubmission[] }) {
  if (submissions.length === 0) return null;
  return (
    <section className="rounded-[12px] border border-cocoon-line bg-white p-5">
      <h2 className="text-[16px] leading-normal font-bold text-black">ประวัติการส่ง</h2>
      <ul className="mt-3 space-y-2">
        {submissions.map((s) => (
          <li
            key={s.id}
            className="flex h-[55px] items-center justify-between rounded-[10px] border border-cocoon-line bg-[rgba(245,245,245,.3)] px-4"
          >
            <span className={cn('text-[12px] leading-normal font-normal', STATUS_COLOR[s.status])}>
              ● ครั้งที่ {s.attempt} · {STATUS_LABEL[s.status]}
            </span>
            <span className="text-[12px] leading-normal font-medium text-cocoon-muted">
              {formatSubmissionDate(s.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SubmittedFiles({ files }: { files: StudentSubmission['files'] }) {
  const [isPending, startTransition] = useTransition();

  function open(fileId: string) {
    // Open the tab synchronously (popup blockers) then point it at the presigned URL.
    const win = window.open('', '_blank');
    startTransition(async () => {
      const result = await getSubmissionFileUrl({ fileId }).catch(() => null);
      if (!result || !result.ok) {
        win?.close();
        toast.error(result && !result.ok ? result.error : 'ไม่สามารถเปิดไฟล์ได้');
        return;
      }
      if (win) {
        win.opener = null;
        win.location.href = result.url;
      } else {
        window.open(result.url, '_blank', 'noopener');
      }
    });
  }

  return (
    <div className="space-y-[7px]">
      {files.map((f) => (
        <SubmissionFileRow
          key={f.id}
          fileName={f.fileName}
          fileSize={f.fileSize}
          onOpen={() => open(f.id)}
          disabled={isPending}
        />
      ))}
    </div>
  );
}

export function SubmissionStatusView({
  latest,
  history,
  backHref,
}: {
  latest: StudentSubmission;
  history: StudentSubmission[];
  backHref: string;
}) {
  const approved = latest.status === 'approved';

  return (
    <div className="space-y-5 px-[33px]">
      <section className="rounded-[12px] border border-cocoon-line bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="relative size-[86px] shrink-0" aria-hidden>
            <img src="/figma/ff79c.svg" alt="" className="absolute inset-0 size-[86px] max-w-none" />
            <img
              src="/figma/c536c.svg"
              alt=""
              className="absolute -right-[8px] -bottom-[8px] size-[38px] max-w-none"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <StatusPill
              status={approved ? 'approved' : 'pending'}
              size="lg"
              label={approved ? 'ผ่านการตรวจ' : undefined}
            />
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
              {approved ? 'งานนี้ผ่านการตรวจแล้ว' : 'รอตรวจงานแล้วแจ้งผลให้ทราบ'}
            </p>
          </div>
        </div>

        <div className="my-4 border-t border-cocoon-line" />

        <div className="mb-3 flex items-baseline justify-between gap-2">
          <p className="text-[16px] leading-normal font-bold text-black">ส่งครั้งที่ {latest.attempt}</p>
          <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
            {formatSubmissionDate(latest.createdAt)}
          </p>
        </div>
        <SubmittedFiles files={latest.files} />
      </section>

      <HistoryCard submissions={history} />

      <Link href={backHref} className={PRIMARY_BUTTON_CLASS}>
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
