import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { formatDeadline } from '@/lib/deadline';
import type { StudentDeadlineItem, StudentDeadlineSections } from '@/lib/deadline-dashboard';
import { StatusPill } from '@/components/cocoon/status-pill';
import { DeadlineChip } from '@/components/deadline/deadline-chip';

const SECTIONS: { key: keyof Omit<StudentDeadlineSections, 'noDeadlineCount'>; title: string; accent: string }[] = [
  { key: 'overdue', title: 'เลยกำหนด', accent: 'text-[#d11a0f]' },
  { key: 'dueSoon', title: 'ใกล้ถึงกำหนด · 48 ชม.', accent: 'text-[#a86a00]' },
  { key: 'upcoming', title: 'กำลังจะมาถึง', accent: 'text-cocoon-blue' },
  { key: 'submitted', title: 'ส่งแล้ว', accent: 'text-cocoon-green' },
];

function DeadlineRow({ item }: { item: StudentDeadlineItem }) {
  return (
    <li>
      <Link
        href={`/todo/${item.todoId}`}
        className="flex items-center gap-3 rounded-[12px] border border-cocoon-line bg-white px-4 py-3 transition-colors outline-none hover:border-cocoon-blue/40 focus-visible:ring-2 focus-visible:ring-cocoon-blue/50 lg:rounded-[16px] lg:border-[#f1ece5] lg:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] leading-normal font-medium text-cocoon-muted">
            {item.phaseName} · {item.classroomName}
          </span>
          <span className="block truncate text-[16px] leading-normal font-bold text-cocoon-ink">{item.title}</span>
          {item.deadline && (
            <span className="block text-[13px] leading-normal font-medium text-cocoon-subtle">
              {formatDeadline(item.deadline)}
            </span>
          )}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusPill status={item.reviewStatus} size="sm" />
            <DeadlineChip
              status={item.deadlineStatus}
              lateMs={item.lateMs}
              overdueMs={item.overdueMs}
              remainingMs={item.remainingMs}
              size="md"
              showUpcoming
            />
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-cocoon-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** Student "กำหนดส่ง" page body (261004-03i). Server component. */
export function StudentDeadlineList({ sections }: { sections: StudentDeadlineSections }) {
  const visible = SECTIONS.filter((s) => sections[s.key].length > 0);

  return (
    <div className="mt-4 lg:mt-8">
      {visible.length === 0 ? (
        <div className="rounded-[12px] border border-cocoon-line bg-white p-6 text-center lg:rounded-[16px] lg:border-[#f1ece5] lg:p-10">
          <CalendarClock className="mx-auto size-8 text-cocoon-muted" aria-hidden />
          <p className="mt-2 text-[16px] leading-normal font-bold text-cocoon-ink">ยังไม่มีงานที่มีกำหนดส่ง</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
          {visible.map((s) => (
            <section key={s.key} aria-label={s.title}>
              <h2 className={cn('mb-2 text-[16px] leading-normal font-bold lg:mb-3 lg:text-[18px]', s.accent)}>
                {s.title} ({sections[s.key].length})
              </h2>
              <ul className="space-y-2 lg:space-y-3">
                {sections[s.key].map((item) => (
                  <DeadlineRow key={`${item.groupId}:${item.todoId}`} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {sections.noDeadlineCount > 0 && (
        <p className="mt-6 text-[13px] leading-normal font-medium text-cocoon-muted">
          งานที่ไม่มีกำหนดส่ง {sections.noDeadlineCount} งาน
        </p>
      )}
    </div>
  );
}
