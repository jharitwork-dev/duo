'use client';

// "สื่อการเรียน" section on the student group / classroom pages (quick task 261113-lz7).
// Read-only: no submit UI (D-03). Data comes from getStudentMaterials (archived phases excluded).
import { ExternalLink } from 'lucide-react';
import { cn } from 'cn';
import { MaterialFileButtons } from '@/components/material/material-file-buttons';
import type { MaterialItem } from '@/server/queries/material';

export function StudentMaterialCards({ materials, className }: { materials: MaterialItem[]; className?: string }) {
  if (materials.length === 0) return null;
  return (
    <section aria-label="สื่อการเรียน" className={cn('mx-[33px] lg:mx-0', className)}>
      <h2 className="text-[16px] leading-normal font-bold text-cocoon-blue lg:text-[18px]">สื่อการเรียน</h2>
      <ul className="mt-2 grid gap-2 lg:grid-cols-2 lg:gap-3">
        {materials.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-[12px] border border-cocoon-line bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-[15px] leading-normal font-bold break-words text-cocoon-ink">
                {m.title}
              </p>
              <span className="inline-flex h-[26px] shrink-0 items-center rounded-full bg-cocoon-blue-soft px-3 text-[12px] font-bold whitespace-nowrap text-cocoon-blue">
                {m.phaseId === null ? 'ทั้งห้องเรียน' : (m.phaseName ?? 'Phase')}
              </span>
            </div>
            {m.description && (
              <p className="text-[14px] leading-normal whitespace-pre-line text-cocoon-ink">{m.description}</p>
            )}
            {m.linkUrl && (
              <a
                href={m.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 text-[14px] font-bold break-all text-cocoon-blue hover:underline"
              >
                <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden />
                {m.linkUrl}
              </a>
            )}
            <MaterialFileButtons files={m.files} />
          </li>
        ))}
      </ul>
    </section>
  );
}
