'use client';

// แบบฟอร์ม tab on the teacher classroom page (quick task 261021-r1c).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { BTN_PRIMARY, BTN_TERTIARY, CARD, CARD_META, EMPTY_CARD } from '@/components/cocoon/ui';
import { formatDateTime } from '@/lib/format';
import { createForm } from '@/server/actions/form';
import type { ClassroomFormListItem } from '@/server/queries/form';
import { FormMetaPill, FormStatusPill, RESPONSE_MODE_LABEL } from './form-pills';

export function FormsTab({
  classroomId,
  forms,
  groupCount,
}: {
  classroomId: string;
  forms: ClassroomFormListItem[];
  groupCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createForm({ classroomId });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        router.push(`/teacher/classroom/${classroomId}/forms/${result.formId}`);
      } catch {
        toast.error('สร้างแบบฟอร์มไม่สำเร็จ');
      }
    });
  };

  const createButton = (
    <button type="button" onClick={handleCreate} disabled={isPending} className={cn(BTN_PRIMARY, 'inline-flex items-center gap-2 disabled:opacity-50')}>
      <Plus className="size-4" aria-hidden />
      {isPending ? 'กำลังสร้าง...' : 'สร้างแบบฟอร์ม'}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
        <h2 className="text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]">
          แบบฟอร์ม ({forms.length})
        </h2>
        {forms.length > 0 && createButton}
      </div>

      {forms.length === 0 ? (
        <div className={EMPTY_CARD}>
          <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีแบบฟอร์ม</p>
          <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
            สร้างแบบฟอร์มให้นักเรียนตอบคำถาม — ตอบรายบุคคลหรือตอบเป็นกลุ่มก็ได้
          </p>
          {createButton}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-3">
          {forms.map((form) => {
            const audience =
              form.audienceGroupIds.length === 0 ? 'ทั้งห้อง' : `${form.audienceGroupIds.length} กลุ่ม`;
            const base = `/teacher/classroom/${classroomId}/forms/${form.id}`;
            return (
              <li key={form.id} className={cn(CARD, 'flex flex-col gap-3')}>
                <div className="flex flex-wrap items-center gap-2">
                  <FormStatusPill status={form.effectiveStatus} />
                  <FormMetaPill>{RESPONSE_MODE_LABEL[form.responseMode]}</FormMetaPill>
                  <FormMetaPill>{audience}</FormMetaPill>
                </div>
                <Link
                  href={base}
                  className="text-[18px] leading-normal font-bold break-words text-cocoon-ink hover:text-cocoon-blue"
                >
                  {form.title}
                </Link>
                <div className={cn(CARD_META, 'space-y-0.5')}>
                  <p>
                    {form.questionCount} คำถาม · ตอบแล้ว{' '}
                    <span className="font-bold text-cocoon-ink">
                      {form.responseCount}/{form.expectedCount}
                    </span>
                    {form.responseMode === 'group' ? ' กลุ่ม' : ' คน'}
                  </p>
                  {form.closesAt && <p>ปิดรับ {formatDateTime(form.closesAt)}</p>}
                  {form.responseMode === 'group' && groupCount === 0 && <p>ห้องนี้ยังไม่มีกลุ่ม</p>}
                </div>
                <div className="mt-auto flex gap-2">
                  <Link href={base} className={cn(BTN_TERTIARY, 'inline-flex h-10 flex-1 items-center justify-center text-[14px]')}>
                    แก้ไข
                  </Link>
                  <Link
                    href={`${base}/responses`}
                    className={cn(BTN_TERTIARY, 'inline-flex h-10 flex-1 items-center justify-center text-[14px]')}
                  >
                    คำตอบ
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
