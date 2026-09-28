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
  reviewerComment?: string | null;
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

export const PRIMARY_BUTTON_CLASS =
  'flex h-[55px] w-full items-center justify-center rounded-[12px] bg-cocoon-orange text-[16px] font-bold text-white transition-opacity disabled:opacity-50';

/** Desktop card shell (design/mac): white, 16px radius, warm border, 28px padding. */
export const DESKTOP_CARD = 'rounded-[16px] border border-[#f1ece5] bg-white p-7';

/** "18 ก.ย. 13.59" → "18 ก.ย. · 13:59" (desktop submission card). */
function cardDate(date: Date | string): string {
  return formatSubmissionDate(date).replace(/ (\d{2})\.(\d{2})$/, ' · $1:$2');
}

/** "18 ก.ย. 13.59" → "18 ก.ย. 13:59" (desktop history list). */
function historyDate(date: Date | string): string {
  return formatSubmissionDate(date).replace(/(\d{2})\.(\d{2})$/, '$1:$2');
}

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

/** Yellow reviewer note (design/mac home-7 "คำแนะนำจากผู้ตรวจ", home-9 "คำแนะนำครั้งก่อน"). */
export function ReviewerNoteCard({
  title,
  comment,
  className,
}: {
  title: string;
  comment: string | null | undefined;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[12px] border border-[#fbe6b8] bg-[#fff4df] px-5 py-4 lg:rounded-[16px] lg:px-6 lg:py-[18px]',
        className,
      )}
    >
      <h2 className="text-[16px] leading-normal font-bold text-[#a86a00]">{title}</h2>
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

/** Desktop "ส่งครั้งที่ n" card with the stored files. */
export function LatestSubmissionCard({ submission }: { submission: StudentSubmission }) {
  return (
    <section className={cn(DESKTOP_CARD, 'min-h-[338px]')}>
      <h2 className="text-[24px] leading-normal font-bold text-cocoon-blue">ส่งครั้งที่ {submission.attempt}</h2>
      <p className="text-[16px] leading-normal font-medium text-cocoon-muted">{cardDate(submission.createdAt)}</p>
      <SubmittedFiles files={submission.files} className="mt-3" />
    </section>
  );
}

/** Desktop "ประวัติการส่ง" card. */
export function HistoryListCard({ submissions }: { submissions: StudentSubmission[] }) {
  return (
    <section className={cn(DESKTOP_CARD, 'min-h-[338px]')}>
      <h2 className="text-[20px] leading-normal font-bold text-cocoon-blue">ประวัติการส่ง</h2>
      <ul className="mt-5 space-y-5">
        {submissions.map((s) => (
          <li key={s.id}>
            <p className={cn('text-[16px] leading-normal font-bold', STATUS_COLOR_DESKTOP[s.status])}>
              ● ครั้งที่ {s.attempt} · {STATUS_LABEL[s.status]}
            </p>
            <p className="mt-1 text-[14px] leading-normal font-medium text-cocoon-muted">{historyDate(s.createdAt)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const DESKTOP_ACTION_BUTTON =
  'flex h-[49px] w-[313px] items-center justify-center rounded-[12px] text-[16px] font-bold text-white transition-opacity';

/** Mobile submitted / approved state (ref 05). */
export function SubmissionStatusView({
  latest,
  history,
  backHref,
  previousComment,
}: {
  latest: StudentSubmission;
  history: StudentSubmission[];
  backHref: string;
  previousComment?: string | null;
}) {
  const approved = latest.status === 'approved';

  return (
    <div className="space-y-5 px-[33px]">
      <section className="rounded-[12px] border border-cocoon-line bg-white p-5">
        <div className="-ml-1 flex items-center gap-3">
          <div className="relative size-[86px] shrink-0" aria-hidden>
            <img src="/figma/ff79c.svg" alt="" className="absolute inset-0 size-[86px] max-w-none" />
            <img
              src="/figma/c536c.svg"
              alt=""
              className="absolute -right-[8px] -bottom-[8px] size-[38px] max-w-none"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <StatusPill status={approved ? 'approved' : 'pending'} size="lg" />
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

      {previousComment && <ReviewerNoteCard title="คำแนะนำครั้งก่อน" comment={previousComment} />}

      <HistoryCard submissions={history} />

      <Link href={backHref} className={PRIMARY_BUTTON_CLASS}>
        กลับหน้าหลัก
      </Link>
    </div>
  );
}

/** Desktop submitted / approved state (design/mac home-4, home-9). */
export function SubmissionStatusDesktop({
  latest,
  history,
  backHref,
  previousComment,
}: {
  latest: StudentSubmission;
  history: StudentSubmission[];
  backHref: string;
  previousComment?: string | null;
}) {
  const approved = latest.status === 'approved';
  return (
    <div className="mt-[35px] grid grid-cols-[684px_1fr] gap-x-8 gap-y-6 max-xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <LatestSubmissionCard submission={latest} />
      <HistoryListCard submissions={history} />
      {previousComment ? (
        <ReviewerNoteCard title="คำแนะนำครั้งก่อน" comment={previousComment} />
      ) : (
        <p className="min-h-[99px] pt-[20px] text-[16px] leading-normal font-medium text-cocoon-blue">
          {approved ? 'งานนี้ผ่านการตรวจแล้ว' : 'รอผู้ตรวจตรวจงาน แล้วจะแจ้งผลให้ทราบ'}
        </p>
      )}
      <Link
        href={backHref}
        className={cn(DESKTOP_ACTION_BUTTON, 'self-end justify-self-end bg-cocoon-orange hover:opacity-90')}
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}
