'use client';

import Link from 'next/link';
import { cn } from 'cn';
import { formatSubmissionDate } from '@/lib/format';
import {
  DESKTOP_ACTION_BUTTON,
  HistoryCard,
  HistoryListCard,
  LatestSubmissionCard,
  ReviewerNoteCard,
  SubmittedFiles,
  type StudentSubmission,
} from './submission-status-view';

/**
 * Rejected state (design/mac home-7). Shows the latest reviewer comment (read-only) and a
 * yellow "แก้ไขงาน" action that opens the re-upload step (?step=upload).
 */
export function SubmissionRejectedView({
  latest,
  history,
  editHref,
  canResubmit,
}: {
  latest: StudentSubmission;
  history: StudentSubmission[];
  editHref: string;
  canResubmit: boolean;
}) {
  const lockedNote = (
    <p className="text-[14px] leading-normal font-medium text-cocoon-muted lg:text-[16px]">
      Phase นี้ยังไม่ปลดล็อค — รอครูปลดล็อคก่อนจึงจะส่งงานได้
    </p>
  );

  return (
    <>
      {/* Mobile: note → submission → history → button */}
      <div className="space-y-5 px-[33px] lg:hidden">
        <ReviewerNoteCard title="คำแนะนำจากผู้ตรวจ" comment={latest.reviewerComment} />
        <section className="rounded-[12px] border border-cocoon-line bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-[16px] leading-normal font-bold text-black">ส่งครั้งที่ {latest.attempt}</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
              {formatSubmissionDate(latest.createdAt)}
            </p>
          </div>
          <SubmittedFiles files={latest.files} />
        </section>
        <HistoryCard submissions={history} />
        {canResubmit ? (
          <Link
            href={editHref}
            className="flex h-[55px] w-full items-center justify-center rounded-[12px] bg-cocoon-yellow text-[16px] font-bold text-white"
          >
            แก้ไขงาน
          </Link>
        ) : (
          lockedNote
        )}
      </div>

      {/* Desktop: 2 columns, note under the submission card, button bottom-right */}
      <div className="mt-[35px] hidden grid-cols-[684px_1fr] gap-x-8 gap-y-6 max-xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid">
        <LatestSubmissionCard submission={latest} />
        <HistoryListCard submissions={history} />
        <ReviewerNoteCard title="คำแนะนำจากผู้ตรวจ" comment={latest.reviewerComment} />
        {canResubmit ? (
          <Link
            href={editHref}
            className={cn(DESKTOP_ACTION_BUTTON, 'self-end justify-self-end bg-cocoon-yellow hover:opacity-90')}
          >
            แก้ไขงาน
          </Link>
        ) : (
          <div className="self-end justify-self-end">{lockedNote}</div>
        )}
      </div>
    </>
  );
}
