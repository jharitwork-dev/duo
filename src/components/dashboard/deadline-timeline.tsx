import Link from 'next/link';
import { cn } from 'cn';
import { CARD } from '@/components/cocoon/ui';
import { formatDeadline, formatDeadlineRelative } from '@/lib/deadline';
import type { DeadlineTimeline as Timeline, TimelineItem } from '@/lib/deadline-dashboard';

const SECTIONS: { key: keyof Timeline; title: string; accent: string }[] = [
  { key: 'overdue', title: 'เลยกำหนด', accent: 'text-[#d11a0f]' },
  { key: 'today', title: 'วันนี้', accent: 'text-[#a86a00]' },
  { key: 'next7', title: '7 วันข้างหน้า', accent: 'text-cocoon-blue' },
  { key: 'later', title: 'ภายหลัง', accent: 'text-cocoon-muted' },
];

function TimelineRow({ item, now, overdue }: { item: TimelineItem; now: Date; overdue: boolean }) {
  const allSubmitted = item.totalGroups > 0 && item.submittedGroups === item.totalGroups;
  return (
    <li>
      <Link
        href={`/teacher/classroom/${item.classroomId}?tab=overview`}
        className={cn(
          CARD,
          'flex flex-col gap-1 p-4 outline-none hover:border-cocoon-blue/40 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:flex-row lg:items-center lg:gap-4 lg:p-5',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-cocoon-muted">
            {item.classroomName} · {item.phaseName}
          </p>
          <p className="text-[16px] leading-normal font-bold break-words text-cocoon-ink">{item.title}</p>
          <p className={cn('text-[13px] font-medium', overdue ? 'text-[#d11a0f]' : 'text-cocoon-muted')}>
            {formatDeadline(item.deadline)} · {formatDeadlineRelative(item.deadline, now)}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex h-[26px] w-fit shrink-0 items-center rounded-full px-3 text-[12px] font-bold whitespace-nowrap',
            allSubmitted ? 'bg-[rgb(0_168_107/.12)] text-cocoon-green' : 'bg-cocoon-blue-soft text-cocoon-blue',
          )}
        >
          ส่งแล้ว {item.submittedGroups}/{item.totalGroups} กลุ่ม
        </span>
      </Link>
    </li>
  );
}

/** /teacher/deadlines: cross-classroom deadline timeline (261004-03i). Server component. */
export function DeadlineTimeline({ timeline, now }: { timeline: Timeline; now: Date }) {
  return (
    <div className="space-y-6 lg:space-y-8">
      {SECTIONS.map(({ key, title, accent }) => {
        const items = timeline[key];
        if (items.length === 0) return null;
        return (
          <section key={key} aria-labelledby={`timeline-${key}`} className="space-y-3">
            <h2 id={`timeline-${key}`} className={cn('text-[18px] font-bold lg:text-[20px]', accent)}>
              {title} ({items.length})
            </h2>
            <ul className="space-y-3">
              {items.map((item) => (
                <TimelineRow key={`${item.classroomId}:${item.firstTodoId}`} item={item} now={now} overdue={key === 'overdue'} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
