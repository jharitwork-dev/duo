import { cn } from 'cn';

export type PillStatus = 'none' | 'locked' | 'pending' | 'rejected' | 'approved';

const STYLES: Record<
  PillStatus,
  { wrap: string; text: string; dot: string; label: string; border: string; soft: string }
> = {
  none: {
    wrap: 'bg-[rgba(255,27,15,.2)] text-cocoon-orange',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-orange',
    label: 'ยังไม่ส่ง',
    border: 'border-cocoon-orange',
    soft: 'bg-[rgb(239_73_36/.12)]',
  },
  locked: {
    wrap: 'bg-[rgba(15,23,42,.05)] text-[#9da1a6]',
    text: 'text-[12px]',
    dot: 'size-[7px] bg-[rgba(29,37,49,.4)]',
    label: 'ยังไม่ปลดล็อค',
    border: 'border-[#9da1a6]',
    soft: 'bg-[rgba(15,23,42,.05)]',
  },
  pending: {
    wrap: 'bg-[rgba(0,105,166,.2)] text-cocoon-blue',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-blue',
    label: 'รอตรวจ',
    border: 'border-cocoon-blue',
    soft: 'bg-[rgb(0_105_166/.12)]',
  },
  rejected: {
    wrap: 'bg-[rgba(250,168,25,.2)] text-[#c98200]',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-yellow',
    label: 'ต้องแก้ไข',
    border: 'border-cocoon-yellow',
    soft: 'bg-[rgb(250_168_25/.15)]',
  },
  approved: {
    wrap: 'bg-[rgb(0_168_107/.15)] text-cocoon-green',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-green',
    label: 'ผ่านแล้ว',
    border: 'border-cocoon-green',
    soft: 'bg-[rgb(0_168_107/.15)]',
  },
};

/**
 * sm: node/list pill. lg: mobile status card pill (ref 05).
 * xl: desktop title-row pill (design/mac home-4/7/9) — 1px border in the status colour.
 */
export function StatusPill({
  status,
  size = 'sm',
  label,
  className,
}: {
  status: PillStatus;
  size?: 'sm' | 'lg' | 'xl';
  label?: string;
  className?: string;
}) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[26px] px-2 leading-normal font-medium whitespace-nowrap',
        s.wrap,
        size === 'sm' && s.text,
        size === 'lg' && 'h-[31px] gap-2 px-3 text-[16px]',
        size === 'xl' && cn('h-[31px] min-w-[118px] gap-1.5 border px-3 text-[14px] font-bold', s.border, s.soft),
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('shrink-0 rounded-full', s.dot, size === 'lg' && 'size-[17px]', size === 'xl' && 'size-[11px]')}
      />
      {label ?? s.label}
    </span>
  );
}
