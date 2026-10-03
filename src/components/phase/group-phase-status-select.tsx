'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from 'cn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setGroupPhaseStatus } from '@/server/actions/phase';

export type GroupPhaseStatus = 'locked' | 'active' | 'completed';

export const statusLabels: Record<GroupPhaseStatus, string> = {
  locked: 'ล็อก',
  active: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
};

// StatusPill-like colours: active blue / locked grey / completed green.
export const statusColors: Record<GroupPhaseStatus, string> = {
  locked: 'bg-[rgba(15,23,42,.05)] text-[#9da1a6]',
  active: 'bg-[rgba(0,105,166,.15)] text-cocoon-blue',
  completed: 'bg-[rgb(0_168_107/.15)] text-cocoon-green',
};

export const statusDots: Record<GroupPhaseStatus, string> = {
  locked: 'bg-[rgba(29,37,49,.4)]',
  active: 'bg-cocoon-blue',
  completed: 'bg-cocoon-green',
};

export function PhaseStatusPill({ status }: { status: GroupPhaseStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold whitespace-nowrap',
        statusColors[status],
      )}
    >
      <span aria-hidden className={cn('size-2 rounded-full', statusDots[status])} />
      {statusLabels[status]}
    </span>
  );
}

const STATUS_ITEMS = (Object.keys(statusLabels) as GroupPhaseStatus[]).map((value) => ({
  value,
  label: statusLabels[value],
}));

/** D-3: teacher sets this group's status for one classroom phase (manual, no auto-unlock). */
export function GroupPhaseStatusSelect({
  groupId,
  phaseId,
  status,
}: {
  groupId: string;
  phaseId: string;
  status: GroupPhaseStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: GroupPhaseStatus | null) => {
    if (!value || value === status) return;
    startTransition(async () => {
      try {
        await setGroupPhaseStatus({ groupId, phaseId, status: value });
        toast.success('อัปเดตสถานะแล้ว');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'อัปเดตสถานะไม่สำเร็จ');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[14px] font-bold text-cocoon-ink">สถานะของกลุ่มนี้</span>
      <Select items={STATUS_ITEMS} value={status} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger
          aria-label="สถานะ Phase ของกลุ่มนี้"
          className="h-10 min-w-40 rounded-[12px] border-[#f1ece5] bg-[#fffaf3] text-[14px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
