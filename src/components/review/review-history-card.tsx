import Link from 'next/link';
import { cn } from 'cn';
import { CARD } from '@/components/cocoon/ui';
import { formatSubmissionDate } from '@/lib/format';
import { REVIEW_ROUND_LABEL } from '@/lib/review';
import type { ReviewDetail } from '@/server/queries/review';

const COLOR: Record<ReviewDetail['history'][number]['status'], string> = {
  pending: 'text-cocoon-blue',
  rejected: 'text-cocoon-yellow',
  approved: 'text-cocoon-green',
};

// Right card on the review detail (design/mac home-12, mobile ref 08): every round, newest first.
export function ReviewHistoryCard({ history, currentId }: { history: ReviewDetail['history']; currentId: string }) {
  return (
    <section className={cn(CARD, 'min-w-0')}>
      <h2 className="text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[22px]">ประวัติการส่ง</h2>
      <ol className="mt-3 space-y-3 lg:mt-5 lg:space-y-4">
        {history.map((round) => {
          const current = round.id === currentId;
          const label = (
            <>
              <span className={cn('block text-[15px] leading-normal lg:text-[16px]', COLOR[round.status], current ? 'font-bold' : 'font-medium')}>
                ● ครั้งที่ {round.attempt} · {REVIEW_ROUND_LABEL[round.status]}
              </span>
              <span className="mt-0.5 block text-[13px] leading-normal font-medium text-cocoon-muted lg:text-[14px]">
                {formatSubmissionDate(round.createdAt)}
              </span>
            </>
          );
          return (
            <li key={round.id}>
              {current ? (
                <div aria-current="true">{label}</div>
              ) : (
                <Link
                  href={`/teacher/review/${round.id}`}
                  className="block rounded-md outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
