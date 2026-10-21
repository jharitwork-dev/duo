// "แบบฟอร์มที่ต้องตอบ" section on the student group / classroom pages (quick task 261021-r1c).
// Server-safe (no 'use client'); the data comes from getStudentForms.
import Link from 'next/link';
import { cn } from 'cn';
import { formatDateTime } from '@/lib/format';
import type { StudentFormItem, StudentFormState } from '@/server/queries/form-response';

const PILL_BASE =
  'inline-flex h-[26px] shrink-0 items-center rounded-full px-3 text-[12px] font-bold whitespace-nowrap';

const STATE_PILL: Record<StudentFormState, { label: string; className: string }> = {
  todo: { label: 'ยังไม่ตอบ', className: 'bg-[#fff1e8] text-[#e8590c]' },
  done: { label: 'ตอบแล้ว', className: 'bg-[rgb(0_168_107/.15)] text-cocoon-green' },
  closed: { label: 'ปิดแล้ว', className: 'bg-[rgba(15,23,42,.05)] text-cocoon-muted' },
  no_group: { label: 'ต้องเข้ากลุ่มก่อน', className: 'bg-[rgba(15,23,42,.05)] text-cocoon-muted' },
};

export function StudentFormStatePill({ state, className }: { state: StudentFormState; className?: string }) {
  const s = STATE_PILL[state];
  return <span className={cn(PILL_BASE, s.className, className)}>{s.label}</span>;
}

/** Small orange "แบบฟอร์มรอตอบ {n}" pill for classroom cards; renders nothing when n is 0. */
export function PendingFormsPill({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return <span className={cn(PILL_BASE, 'bg-[#fff1e8] text-[#e8590c]', className)}>แบบฟอร์มรอตอบ {count}</span>;
}

export function StudentFormCards({ forms, className }: { forms: StudentFormItem[]; className?: string }) {
  if (forms.length === 0) return null;
  return (
    <section aria-label="แบบฟอร์มที่ต้องตอบ" className={cn('mx-[33px] lg:mx-0', className)}>
      <h2 className="text-[16px] leading-normal font-bold text-cocoon-blue lg:text-[18px]">แบบฟอร์มที่ต้องตอบ</h2>
      <ul className="mt-2 grid gap-2 lg:grid-cols-2 lg:gap-3">
        {forms.map((f) => (
          <li key={f.id}>
            <Link
              href={`/forms/${f.id}`}
              className="flex items-center gap-3 rounded-[12px] border border-cocoon-line bg-white px-4 py-3 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] leading-normal font-bold text-cocoon-ink">{f.title}</p>
                {f.closesAt && (
                  <p className="text-[12px] leading-normal font-medium text-cocoon-muted">
                    ปิดรับ {formatDateTime(f.closesAt)}
                  </p>
                )}
              </div>
              <StudentFormStatePill state={f.state} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
