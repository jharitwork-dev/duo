import Link from 'next/link';
import { cn } from 'cn';
import { REVIEW_TAB_LABEL, REVIEW_TABS, reviewListHref, type ReviewTab } from '@/lib/review';

const SEGMENT_LIST = 'flex h-[47px] w-full rounded-full border border-[#f1ece5] bg-white lg:w-auto';
const SEGMENT_TRIGGER =
  'flex h-full flex-1 items-center justify-center rounded-full px-6 text-[16px] font-bold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:flex-none lg:px-10';

const ACTIVE: Record<ReviewTab, string> = {
  pending: 'bg-cocoon-blue text-white',
  rejected: 'bg-cocoon-yellow text-white',
  approved: 'bg-cocoon-green text-white',
};
const INACTIVE: Record<ReviewTab, string> = {
  pending: 'text-cocoon-blue',
  rejected: 'text-cocoon-yellow',
  approved: 'text-cocoon-green',
};

// Segmented รอตรวจ / รอแก้ไข / ผ่าน tabs (design/mac home-11). URL state only.
export function ReviewTabs({
  tab,
  counts,
  classroomId,
  phaseId,
  mine,
}: {
  tab: ReviewTab;
  counts: Record<ReviewTab, number>;
  classroomId: string;
  phaseId: string | null;
  /** Keep the "กลุ่มที่ฉันดูแล" filter across tab links. */
  mine?: boolean;
}) {
  return (
    <nav aria-label="สถานะงาน" className={SEGMENT_LIST}>
      {REVIEW_TABS.map((t) => {
        const active = t === tab;
        return (
          <Link
            key={t}
            href={reviewListHref({ classroom: classroomId, phase: phaseId, tab: t, mine })}
            aria-current={active ? 'page' : undefined}
            className={cn(SEGMENT_TRIGGER, active ? ACTIVE[t] : INACTIVE[t])}
          >
            {REVIEW_TAB_LABEL[t]}
            {counts[t] > 0 && ` (${counts[t]})`}
          </Link>
        );
      })}
    </nav>
  );
}
