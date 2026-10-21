// Small server-safe pills for classroom forms (quick task 261021-r1c). No 'use client'.
import { cn } from 'cn';
import { FORM_STATUS_LABEL, type FormStatus, type ResponseMode } from '@/lib/forms';

const PILL_BASE =
  'inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold whitespace-nowrap';

const STATUS_STYLE: Record<FormStatus, { wrap: string; dot: string }> = {
  draft: { wrap: 'bg-[rgba(15,23,42,.06)] text-[#6b7280]', dot: 'bg-[#9da1a6]' },
  open: { wrap: 'bg-[rgb(0_168_107/.15)] text-cocoon-green', dot: 'bg-cocoon-green' },
  closed: { wrap: 'bg-[rgba(15,23,42,.05)] text-cocoon-muted', dot: 'bg-[rgba(29,37,49,.4)]' },
};

export function FormStatusPill({ status, className }: { status: FormStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn(PILL_BASE, s.wrap, className)}>
      <span aria-hidden className={cn('size-2 rounded-full', s.dot)} />
      {FORM_STATUS_LABEL[status]}
    </span>
  );
}

export const RESPONSE_MODE_LABEL: Record<ResponseMode, string> = {
  individual: 'รายบุคคล',
  group: 'กลุ่ม',
};

export function FormMetaPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(PILL_BASE, 'bg-cocoon-blue-soft text-cocoon-blue', className)}>{children}</span>;
}
