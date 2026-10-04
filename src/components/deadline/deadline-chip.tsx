import { cn } from 'cn';
import {
  DEADLINE_STATUS_LABEL,
  LATENESS_HELP,
  formatDeadlineRelative,
  formatLateness,
  type DeadlineStatus,
} from '@/lib/deadline';

/** "เลยกำหนด 1 วัน" / "เหลือ 5 ชม." from a span (formatDeadlineRelative with a synthetic clock). */
export function formatSpanRelative(ms: number, direction: 'past' | 'future'): string {
  return direction === 'past'
    ? formatDeadlineRelative(new Date(0), new Date(ms))
    : formatDeadlineRelative(new Date(ms), new Date(0));
}

export const DEADLINE_TONE: Record<Exclude<DeadlineStatus, 'none'>, string> = {
  overdue: 'bg-[rgba(255,27,15,.12)] text-[#d11a0f]',
  due_soon: 'bg-[rgba(250,168,25,.15)] text-[#a86a00]',
  on_time: 'bg-[rgb(0_168_107/.12)] text-cocoon-green',
  late: 'bg-[rgb(239_73_36/.12)] text-cocoon-orange',
  upcoming: 'bg-cocoon-blue-soft text-cocoon-blue',
};

interface DeadlineChipProps {
  status: DeadlineStatus;
  lateMs?: number;
  overdueMs?: number;
  remainingMs?: number;
  size?: 'sm' | 'md';
  /** Render a neutral "กำลังจะมาถึง" chip for upcoming (hidden by default). */
  showUpcoming?: boolean;
  className?: string;
}

/**
 * Deadline status chip (261004-03i). Server-safe (no hooks). Renders nothing for none, and for
 * upcoming unless `showUpcoming`. on_time / late carry the lateness rule as a tooltip.
 */
export function DeadlineChip({
  status,
  lateMs,
  overdueMs,
  remainingMs,
  size = 'sm',
  showUpcoming = false,
  className,
}: DeadlineChipProps) {
  if (status === 'none') return null;
  if (status === 'upcoming' && !showUpcoming) return null;

  let label: string;
  if (status === 'upcoming') {
    label = size === 'md' && remainingMs !== undefined ? formatSpanRelative(remainingMs, 'future') : 'กำลังจะมาถึง';
  } else {
    label = DEADLINE_STATUS_LABEL[status];
    if (status === 'late' && lateMs !== undefined) label = `${label} · ${formatLateness(lateMs)}`;
    if (size === 'md' && status === 'overdue' && overdueMs !== undefined) label = formatSpanRelative(overdueMs, 'past');
    if (size === 'md' && status === 'due_soon' && remainingMs !== undefined)
      label = `${label} · ${formatSpanRelative(remainingMs, 'future')}`;
  }

  return (
    <span
      title={status === 'on_time' || status === 'late' ? LATENESS_HELP : undefined}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-bold whitespace-nowrap',
        size === 'sm' ? 'h-[22px] px-2 text-[11px]' : 'h-[26px] px-3 text-[12px]',
        DEADLINE_TONE[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
