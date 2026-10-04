import Link from 'next/link';
import { cn } from 'cn';
import { CARD, CARD_META, BTN_APPROVE, BTN_INFO } from '@/components/cocoon/ui';
import { StatusPill } from '@/components/cocoon/status-pill';
import { formatSubmissionDate } from '@/lib/format';
import type { ReviewListItem } from '@/server/queries/review';
import { BTN_WARN } from './review-ui';


const LINK_BTN = 'inline-flex h-[44px] items-center justify-center lg:h-[49px] lg:min-w-[139px]';

// Review list card (design/mac home-11, mobile ref 07).
export function ReviewCard({ item }: { item: ReviewListItem }) {
  const button =
    item.status === 'pending'
      ? { label: 'เช็คงาน', className: BTN_INFO }
      : item.status === 'rejected'
        ? { label: 'ดูงาน', className: BTN_WARN }
        : { label: 'ดูงาน', className: BTN_APPROVE };

  return (
    <article className={cn(CARD, 'flex flex-col gap-2')}>
      <p className="flex items-center gap-2 text-[16px] leading-normal font-bold text-cocoon-ink">
        <span aria-hidden className="size-3 shrink-0 rounded-full bg-cocoon-ink" />
        <span className="min-w-0 break-words">
          {item.groupName}
          {item.ownerLabel && <span className="font-medium text-cocoon-subtle"> · {item.ownerLabel}</span>}
        </span>
      </p>
      <h2 className="text-[18px] leading-snug font-bold break-words text-cocoon-ink lg:mt-2 lg:text-[22px]">
        {item.todoTitle}
      </h2>
      <p className={CARD_META}>
        ส่งเมื่อ {formatSubmissionDate(item.createdAt)} · ครั้งที่ {item.attempt} · {item.fileCount} ไฟล์
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 lg:mt-6">
        <StatusPill status={item.status} size="sm" className="h-[26px] px-3 text-[12px] lg:h-[31px] lg:text-[14px]" />
        <Link href={`/teacher/review/${item.id}`} className={cn(button.className, LINK_BTN)}>
          {button.label}
        </Link>
      </div>
    </article>
  );
}
