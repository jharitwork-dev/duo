import { Check } from 'lucide-react';
import { TodoAttachmentsList } from '@/components/todo/todo-attachments-list';
import { FileRequirementBadge } from '@/components/work-page/work-page-files';
import type { FileRequirement } from '@/lib/work-page';

interface TodoDetailViewProps {
  /** Description lines after the first one (the first line is the page subtitle). */
  description: string;
  /** Notes that are not deliverable bullets. */
  notes: string;
  deliverables: string[];
  attachments: { id: string; fileName: string; contentType: string; fileSize: number }[];
  /** Teacher-set file requirement, shown as a badge under "สิ่งที่ต้องส่ง". */
  fileRequirement: FileRequirement;
}

const CARD =
  'rounded-[12px] border border-cocoon-line bg-white p-5 lg:rounded-[16px] lg:border-[#f1ece5] lg:p-7';
const CARD_TITLE = 'text-[16px] leading-normal font-bold text-cocoon-blue lg:text-[20px]';

// To-do detail (design/mac home-1): "รายละเอียดงาน" + "สิ่งที่ต้องส่ง". The work page below replaces
// the old "เลือกไฟล์" upload step (261004-01i).
export function TodoDetailView({ description, notes, deliverables, attachments, fileRequirement }: TodoDetailViewProps) {
  const hasDetail = !!description || !!notes || attachments.length > 0;

  return (
    <div className="mt-4 space-y-4 px-[33px] lg:mt-[35px] lg:grid lg:grid-cols-[664px_1fr] lg:gap-8 lg:space-y-0 lg:px-0 max-xl:lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className={`${CARD} lg:min-h-[350px]`}>
        <h2 className={CARD_TITLE}>รายละเอียดงาน</h2>
        {hasDetail ? (
          <div className="mt-2 space-y-2 lg:mt-3">
            {description && (
              <p className="text-[14px] leading-normal break-words whitespace-pre-wrap text-cocoon-ink lg:text-[16px]">
                {description}
              </p>
            )}
            {notes && (
              <p className="text-[14px] leading-normal break-words whitespace-pre-wrap text-cocoon-muted lg:text-[16px]">
                {notes}
              </p>
            )}
            {attachments.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-[14px] leading-normal font-bold text-cocoon-ink lg:text-[16px]">ไฟล์แนบจากครู</p>
                <TodoAttachmentsList attachments={attachments} />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[14px] leading-normal text-cocoon-muted lg:mt-3 lg:text-[16px]">
            ครูยังไม่ได้เพิ่มรายละเอียด
          </p>
        )}
      </section>

      <section className={`${CARD} flex flex-col lg:min-h-[350px]`}>
        <h2 className={CARD_TITLE}>สิ่งที่ต้องส่ง</h2>
        {deliverables.length === 0 && (
          <p className="mt-2 text-[14px] leading-normal text-cocoon-muted lg:mt-3 lg:text-[16px]">
            เขียนงานในหน้างานด้านล่าง แล้วกดส่งงาน
          </p>
        )}
        {deliverables.length > 0 && (
          <ul className="mt-3 space-y-3 lg:mt-[22px] lg:space-y-[18px]">
            {deliverables.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] leading-normal text-cocoon-ink lg:text-[16px]">
                <Check aria-hidden size={16} strokeWidth={2} className="mt-[3px] shrink-0 lg:mt-1" />
                <span className="break-words">{item}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 lg:mt-auto lg:pt-6">
          <FileRequirementBadge requirement={fileRequirement} />
        </div>
      </section>
    </div>
  );
}
