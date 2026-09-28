import { cn } from 'cn';

export type PillStatus = 'none' | 'locked' | 'pending' | 'rejected' | 'approved';

const STYLES: Record<PillStatus, { wrap: string; text: string; dot: string; label: string }> = {
  none: {
    wrap: 'bg-[rgba(255,27,15,.2)] text-cocoon-orange',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-orange',
    label: 'ยังไม่ส่ง',
  },
  locked: {
    wrap: 'bg-[rgba(15,23,42,.05)] text-[#9da1a6]',
    text: 'text-[12px]',
    dot: 'size-[7px] bg-[rgba(29,37,49,.4)]',
    label: 'ยังไม่ปลดล็อค',
  },
  pending: {
    wrap: 'bg-[rgba(0,105,166,.2)] text-cocoon-blue',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-blue',
    label: 'รอตรวจ',
  },
  rejected: {
    wrap: 'bg-[rgba(250,168,25,.2)] text-[#c98200]',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-yellow',
    label: 'ต้องแก้ไข',
  },
  approved: {
    wrap: 'bg-[rgb(26_158_85/.15)] text-cocoon-green',
    text: 'text-[10px]',
    dot: 'size-2 bg-cocoon-green',
    label: 'สำเร็จแล้ว',
  },
};

export function StatusPill({
  status,
  size = 'sm',
  label,
  className,
}: {
  status: PillStatus;
  size?: 'sm' | 'lg';
  label?: string;
  className?: string;
}) {
  const s = STYLES[status];
  const lg = size === 'lg';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[26px] px-2 leading-normal font-medium whitespace-nowrap',
        s.wrap,
        lg ? 'h-[31px] gap-2 px-3 text-[16px]' : s.text,
        className,
      )}
    >
      <span aria-hidden className={cn('shrink-0 rounded-full', s.dot, lg && 'size-[17px]')} />
      {label ?? s.label}
    </span>
  );
}
