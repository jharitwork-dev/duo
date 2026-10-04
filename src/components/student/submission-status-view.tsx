'use client';

import { useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { getSubmissionFileUrl } from '@/server/actions/submission';
import { formatSubmissionDate } from '@/lib/format';
import type { WorkPageDoc } from '@/lib/work-page';
import { WorkPageViewer } from '@/components/work-page/work-page-viewer';
import { SubmissionFileRow } from './submission-file-row';

export interface StudentSubmission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date | string;
  /** Bumped by "อัปเดตงานที่ส่ง" (261004-03i); createdAt stays the first-send time. */
  updatedAt?: Date | string;
  attempt: number;
  files: { id: string; fileName: string; fileSize: number }[];
  reviewerComment?: string | null;
  /** Work page snapshot (null / absent for legacy file-only submissions). */
  content?: WorkPageDoc | null;
}

export const STATUS_LABEL: Record<StudentSubmission['status'], string> = {
  pending: 'รอตรวจ',
  approved: 'ผ่านแล้ว',
  rejected: 'ต้องแก้ไข',
};

const STATUS_COLOR: Record<StudentSubmission['status'], string> = {
  pending: 'text-cocoon-blue',
  approved: 'text-cocoon-green',
  rejected: 'text-[#c98200]',
};

const STATUS_COLOR_DESKTOP: Record<StudentSubmission['status'], string> = {
  pending: 'text-cocoon-blue',
  approved: 'text-cocoon-green',
  rejected: 'text-cocoon-yellow',
};

/** Desktop card shell (design/mac): white, 16px radius, warm border, 28px padding. */
export const DESKTOP_CARD = 'rounded-[16px] border border-[#f1ece5] bg-white p-7';

/** "18 ก.ย. 13.59" → "18 ก.ย. 13:59" (desktop history list). */
function historyDate(date: Date | string): string {
  return formatSubmissionDate(date).replace(/(\d{2})\.(\d{2})$/, '$1:$2');
}

/** "อัปเดตล่าสุด …" when the pending snapshot was updated after it was sent (> 1 s apart). */
function updatedLabel(s: StudentSubmission, desktop?: boolean): string | null {
  if (!s.updatedAt) return null;
  if (new Date(s.updatedAt).getTime() - new Date(s.createdAt).getTime() <= 1000) return null;
  return `อัปเดตล่าสุด ${desktop ? historyDate(s.updatedAt) : formatSubmissionDate(s.updatedAt)}`;
}

function hasSnapshot(s: StudentSubmission): boolean {
  return Boolean(s.content) || s.files.length > 0;
}

/** Expanded body of one history attempt: page snapshot (if any) + submitted files. */
function AttemptBody({ submission }: { submission: StudentSubmission }) {
  return (
    <div className="mt-2 space-y-3 rounded-[10px] border border-[#f1ece5] bg-white p-3">
      {submission.content ? (
        <WorkPageViewer content={submission.content} />
      ) : (
        <p className="text-[12px] font-medium text-cocoon-muted">ส่งเป็นไฟล์</p>
      )}
      {submission.files.length > 0 && <SubmittedFiles files={submission.files} />}
    </div>
  );
}

function AttemptSummary({ s, desktop }: { s: StudentSubmission; desktop?: boolean }) {
  return desktop ? (
    <span className="min-w-0 flex-1">
      <span className={cn('block text-[16px] leading-normal font-bold', STATUS_COLOR_DESKTOP[s.status])}>
        ● ครั้งที่ {s.attempt} · {STATUS_LABEL[s.status]}
      </span>
      <span className="mt-1 block text-[14px] leading-normal font-medium text-cocoon-muted">{historyDate(s.createdAt)}</span>
      {updatedLabel(s, true) && (
        <span className="block text-[13px] leading-normal font-medium text-cocoon-muted">{updatedLabel(s, true)}</span>
      )}
    </span>
  ) : (
    <>
      <span className={cn('min-w-0 flex-1 text-[12px] leading-normal font-normal', STATUS_COLOR[s.status])}>
        ● ครั้งที่ {s.attempt} · {STATUS_LABEL[s.status]}
      </span>
      <span className="text-right text-[12px] leading-normal font-medium text-cocoon-muted">
        {formatSubmissionDate(s.createdAt)}
        {updatedLabel(s) && <span className="block text-[11px]">{updatedLabel(s)}</span>}
      </span>
    </>
  );
}

/** Mobile "ประวัติการส่ง": each attempt expands to its snapshot. */
export function HistoryCard({ submissions }: { submissions: StudentSubmission[] }) {
  if (submissions.length === 0) return null;
  return (
    <section className="rounded-[12px] border border-cocoon-line bg-white p-5">
      <h2 className="text-[16px] leading-normal font-bold text-black">ประวัติการส่ง</h2>
      <ul className="mt-3 space-y-2">
        {submissions.map((s) => (
          <li key={s.id} className="rounded-[10px] border border-cocoon-line bg-[rgba(245,245,245,.3)] px-4">
            {hasSnapshot(s) ? (
              <details className="group py-2">
                <summary className="flex min-h-[39px] cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                  <AttemptSummary s={s} />
                  <ChevronDown className="size-4 shrink-0 text-cocoon-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <AttemptBody submission={s} />
              </details>
            ) : (
              <div className="flex h-[55px] items-center gap-2">
                <AttemptSummary s={s} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SubmittedFiles({ files, className }: { files: StudentSubmission['files']; className?: string }) {
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
    <div className={cn('space-y-[7px] lg:space-y-4', className)}>
      {files.map((f) => (
        <SubmissionFileRow
          key={f.id}
          fileName={f.fileName}
          fileSize={f.fileSize}
          action={{ kind: 'open', onOpen: () => open(f.id) }}
          disabled={isPending}
        />
      ))}
    </div>
  );
}

/**
 * Reviewer note (design/mac home-7 "คำแนะนำจากผู้ตรวจ", home-9 "คำแนะนำครั้งก่อน"): yellow by default;
 * tone "approved" = green "ข้อความจากผู้ตรวจ" for an approval note (261004-gic).
 */
export function ReviewerNoteCard({
  title,
  comment,
  className,
  tone = 'rejected',
}: {
  title: string;
  comment: string | null | undefined;
  className?: string;
  tone?: 'rejected' | 'approved';
}) {
  return (
    <section
      className={cn(
        'rounded-[12px] border px-5 py-4 lg:rounded-[16px] lg:px-6 lg:py-[18px]',
        tone === 'approved' ? 'border-cocoon-green/30 bg-[rgb(0_168_107/.08)]' : 'border-[#fbe6b8] bg-[#fff4df]',
        className,
      )}
    >
      <h2
        className={cn(
          'text-[16px] leading-normal font-bold',
          tone === 'approved' ? 'text-cocoon-green' : 'text-[#a86a00]',
        )}
      >
        {title}
      </h2>
      {comment ? (
        <p className="mt-1 text-[14px] leading-normal break-words whitespace-pre-wrap text-cocoon-ink lg:mt-2 lg:text-[16px]">
          {comment}
        </p>
      ) : (
        <p className="mt-1 text-[14px] leading-normal text-cocoon-muted lg:mt-2 lg:text-[16px]">
          ผู้ตรวจส่งงานกลับให้แก้ไข
        </p>
      )}
    </section>
  );
}

/** Desktop "ประวัติการส่ง" card: each attempt expands to its snapshot. */
export function HistoryListCard({ submissions }: { submissions: StudentSubmission[] }) {
  return (
    <section className={DESKTOP_CARD}>
      <h2 className="text-[20px] leading-normal font-bold text-cocoon-blue">ประวัติการส่ง</h2>
      <ul className="mt-5 space-y-5">
        {submissions.map((s) => (
          <li key={s.id}>
            {hasSnapshot(s) ? (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
                  <AttemptSummary s={s} desktop />
                  <ChevronDown
                    className="mt-1 size-5 shrink-0 text-cocoon-muted transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <AttemptBody submission={s} />
              </details>
            ) : (
              <AttemptSummary s={s} desktop />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
