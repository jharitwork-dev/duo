'use client';

import { CARD, CARD_TITLE } from '@/components/cocoon/ui';

interface TodoDetailProps {
  notes: string | null;
  description: string | null;
}

export function TodoDetail({ notes, description }: TodoDetailProps) {
  const hasContent = notes || description;

  if (!hasContent) {
    return (
      <section className={CARD}>
        <h2 className={CARD_TITLE}>รายละเอียดงาน</h2>
        <p className="mt-2 text-[14px] text-cocoon-muted lg:text-[16px]">ยังไม่มีโน้ต</p>
      </section>
    );
  }

  return (
    <section className={CARD}>
      <h2 className={CARD_TITLE}>รายละเอียดงาน</h2>
      <div className="mt-3 space-y-3">
        {description && (
          <p className="text-[14px] leading-normal whitespace-pre-wrap text-cocoon-ink lg:text-[16px]">{description}</p>
        )}
        {notes && (
          <pre className="font-sans text-[14px] leading-relaxed break-words whitespace-pre-wrap text-cocoon-subtle lg:text-[16px]">
            {notes}
          </pre>
        )}
      </div>
    </section>
  );
}
