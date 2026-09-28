import Link from 'next/link';
import { cn } from 'cn';
import { BTN_INFO, CARD } from '@/components/cocoon/ui';

interface ClassroomCardProps {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  groupCount: number;
}

// Classroom card in the design/mac home-11 card language (name, meta, blue action bottom-right).
export function ClassroomCard({ id, name, description, memberCount, groupCount }: ClassroomCardProps) {
  return (
    <div className={cn(CARD, 'flex min-h-[200px] flex-col')}>
      <p className="text-[20px] leading-normal font-bold break-words text-cocoon-ink lg:text-[24px]">{name}</p>
      {description && (
        <p className="mt-1 line-clamp-2 text-[14px] leading-normal font-medium text-cocoon-subtle">{description}</p>
      )}
      <p className="mt-2 text-[14px] leading-normal font-medium text-cocoon-muted">
        สมาชิก {memberCount} คน · {groupCount} กลุ่ม
      </p>
      <div className="mt-auto flex justify-end pt-5">
        <Link
          href={`/teacher/classroom/${id}`}
          className={cn(BTN_INFO, 'inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40')}
        >
          เปิดห้องเรียน
        </Link>
      </div>
    </div>
  );
}
