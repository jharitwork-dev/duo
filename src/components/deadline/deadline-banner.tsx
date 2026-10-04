import { CalendarClock } from 'lucide-react';
import { cn } from 'cn';
import {
  LATENESS_HELP,
  formatDeadline,
  formatDeadlineRelative,
  type DeadlineStatus,
} from '@/lib/deadline';
import { DeadlineChip } from './deadline-chip';

const TINT: Record<DeadlineStatus, { card: string; icon: string }> = {
  none: { card: 'border-cocoon-line bg-white', icon: 'text-cocoon-subtle' },
  upcoming: { card: 'border-cocoon-blue/20 bg-cocoon-blue-soft', icon: 'text-cocoon-blue' },
  due_soon: { card: 'border-cocoon-yellow/50 bg-[rgba(250,168,25,.08)]', icon: 'text-[#a86a00]' },
  overdue: { card: 'border-[rgba(209,26,15,.3)] bg-[rgba(255,27,15,.05)]', icon: 'text-[#d11a0f]' },
  on_time: { card: 'border-cocoon-green/30 bg-[rgb(0_168_107/.06)]', icon: 'text-cocoon-green' },
  late: { card: 'border-cocoon-orange/30 bg-[rgb(239_73_36/.06)]', icon: 'text-cocoon-orange' },
};

interface DeadlineBannerProps {
  /** Effective deadline ISO; null renders nothing. */
  deadline: string | null;
  status: DeadlineStatus;
  lateMs?: number;
  overdueMs?: number;
  /** Server time used for the relative "อีก 2 วัน" text. */
  nowIso: string;
  className?: string;
}

/** Deadline card on the student to-do page (261004-03i). Server component. */
export function DeadlineBanner({ deadline, status, lateMs, overdueMs, nowIso, className }: DeadlineBannerProps) {
  if (!deadline) return null;
  const tint = TINT[status];
  const submitted = status === 'on_time' || status === 'late';
  // Lateness ("ช้า 2 วัน") is already in the chip; relative time only matters before a first submission.
  const secondary = submitted ? null : formatDeadlineRelative(deadline, new Date(nowIso));

  return (
    <div role="status" className={cn('rounded-[12px] border px-4 py-3 lg:rounded-[16px] lg:px-6', tint.card, className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CalendarClock className={cn('size-5 shrink-0', tint.icon)} aria-hidden />
        <p className="min-w-0 flex-1 text-[14px] leading-normal font-bold text-cocoon-ink lg:text-[16px]">
          {formatDeadline(deadline)}
          {secondary && <span className="ml-2 font-medium text-cocoon-subtle">· {secondary}</span>}
        </p>
        <DeadlineChip status={status} lateMs={lateMs} overdueMs={overdueMs} />
      </div>
      {submitted && (
        <p className="mt-1 text-[12px] leading-normal font-medium text-cocoon-subtle">{LATENESS_HELP}</p>
      )}
    </div>
  );
}
