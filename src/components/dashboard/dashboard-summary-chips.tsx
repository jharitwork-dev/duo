import { cn } from 'cn';
import type { DashboardCounts } from '@/lib/deadline-dashboard';

const CHIPS: { key: keyof DashboardCounts; label: string; tone: string }[] = [
  { key: 'pending', label: 'รอตรวจ', tone: 'border-cocoon-blue/30 bg-cocoon-blue-soft text-cocoon-blue' },
  { key: 'overdue', label: 'เลยกำหนด', tone: 'border-[#d11a0f]/25 bg-[rgba(255,27,15,.08)] text-[#d11a0f]' },
  { key: 'dueSoon', label: 'ใกล้ถึงกำหนด (48 ชม.)', tone: 'border-[#a86a00]/25 bg-[rgba(250,168,25,.12)] text-[#a86a00]' },
  { key: 'late', label: 'ส่งช้า', tone: 'border-cocoon-orange/25 bg-[rgb(239_73_36/.08)] text-cocoon-orange' },
];

/** Teacher dashboard summary across classrooms (261004-03i). Server-safe. */
export function DashboardSummaryChips({ counts, className }: { counts: DashboardCounts; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4', className)}>
      {CHIPS.map((chip) => (
        <div
          key={chip.key}
          className={cn(
            'flex min-w-0 flex-col justify-between gap-1 rounded-[16px] border px-4 py-3 lg:px-5 lg:py-4',
            chip.tone,
            counts[chip.key] === 0 && 'opacity-70',
          )}
        >
          <span className="text-[13px] leading-snug font-bold lg:text-[14px]">{chip.label}</span>
          <span className="font-latin text-[28px] leading-none font-bold lg:text-[32px]">{counts[chip.key]}</span>
        </div>
      ))}
    </div>
  );
}
