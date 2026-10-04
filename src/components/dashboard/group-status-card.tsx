import Link from 'next/link';
import { cn } from 'cn';
import { CARD } from '@/components/cocoon/ui';
import { MemberAvatar } from '@/components/cocoon/member-identity';
import { formatSubmissionDate } from '@/lib/format';
import { formatDeadlineRelative } from '@/lib/deadline';
import type { GroupCard } from '@/lib/deadline-dashboard';

export type MemberDirectoryProp = Record<string, { name: string; imageUrl: string | null }>;

const MAX_AVATARS = 4;

function ProgressBar({ label, approved, total }: { label: string; approved: number; total: number }) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-cocoon-muted">
        <span>{label}</span>
        <span className="font-latin font-bold text-cocoon-ink">
          {approved}/{total}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[#f1ece5]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={approved}
      >
        <div className="h-full rounded-full bg-cocoon-green" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CountChip({ count, label, tone }: { count: number; label: string; tone: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn('inline-flex h-[24px] items-center rounded-full px-2.5 text-[12px] font-bold whitespace-nowrap', tone)}>
      {label} {count}
    </span>
  );
}

/** Classroom overview / teacher home: one group's status at a glance (261004-03i). Server-safe. */
export function GroupStatusCard({
  classroomId,
  group,
  members,
  now,
}: {
  classroomId: string;
  group: GroupCard;
  members: MemberDirectoryProp;
  now: Date;
}) {
  const shown = group.memberIds.slice(0, MAX_AVATARS);
  const extra = group.memberIds.length - shown.length;
  const next = group.nextDeadline;

  return (
    <Link
      href={`/teacher/classroom/${classroomId}/group/${group.id}`}
      className={cn(
        CARD,
        'flex min-w-0 flex-col gap-3 p-4 outline-none hover:border-cocoon-blue/40 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:p-5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[18px] leading-normal font-bold text-cocoon-ink">{group.name}</p>
          <p className="truncate text-[13px] font-medium text-cocoon-blue">
            {group.currentPhase ? `Phase ${group.currentPhase.index + 1} · ${group.currentPhase.name}` : 'ยังไม่มี Phase'}
          </p>
        </div>
        {group.memberIds.length > 0 && (
          <div className="flex shrink-0 -space-x-2" aria-label={`สมาชิก ${group.memberIds.length} คน`}>
            {shown.map((id) => (
              <MemberAvatar
                key={id}
                name={members[id]?.name ?? '?'}
                imageUrl={members[id]?.imageUrl ?? null}
                className="size-7 ring-2 ring-white"
              />
            ))}
            {extra > 0 && (
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-cocoon-blue-soft text-[11px] font-bold text-cocoon-blue ring-2 ring-white">
                +{extra}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <ProgressBar label="Phase นี้" approved={group.currentProgress.approved} total={group.currentProgress.total} />
        <ProgressBar label="ทั้งหมด" approved={group.overallProgress.approved} total={group.overallProgress.total} />
      </div>

      {(group.pendingCount > 0 || group.rejectedCount > 0 || group.overdueCount > 0) && (
        <div className="flex flex-wrap gap-1.5">
          <CountChip count={group.pendingCount} label="รอตรวจ" tone="bg-cocoon-blue-soft text-cocoon-blue" />
          <CountChip count={group.rejectedCount} label="ต้องแก้ไข" tone="bg-[rgba(250,168,25,.15)] text-[#a86a00]" />
          <CountChip count={group.overdueCount} label="เลยกำหนด" tone="bg-[rgba(255,27,15,.12)] text-[#d11a0f]" />
        </div>
      )}

      <p className="text-[13px] leading-snug font-medium text-cocoon-muted">
        {next ? (
          <>
            <span className="font-bold text-cocoon-ink">ถัดไป:</span> {next.title} · {formatSubmissionDate(next.deadline)} ·{' '}
            {formatDeadlineRelative(next.deadline, now)}
          </>
        ) : (
          'ไม่มีกำหนดส่งถัดไป'
        )}
      </p>
    </Link>
  );
}
