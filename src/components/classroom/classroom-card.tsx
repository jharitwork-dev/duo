'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from 'cn';
import { BTN_INFO, BTN_TERTIARY, CARD } from '@/components/cocoon/ui';
import { OverflowMenu } from '@/components/cocoon/overflow-menu';
import { DeleteClassroomDialog, toggleClassroomArchived } from '@/components/classroom/classroom-danger-zone';

interface ClassroomCardProps {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  groupCount: number;
  isArchived?: boolean;
}

// Classroom card in the design/mac home-11 card language (name, meta, blue action bottom-right).
export function ClassroomCard({ id, name, description, memberCount, groupCount, isArchived = false }: ClassroomCardProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const href = `/teacher/classroom/${id}`;

  async function handleArchive() {
    if (await toggleClassroomArchived(id, !isArchived)) router.refresh();
  }

  return (
    <div className={cn(CARD, 'flex min-h-[200px] flex-col', isArchived && 'bg-[#fafbfc]')}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[20px] leading-normal font-bold break-words text-cocoon-ink lg:text-[24px]">{name}</p>
        <OverflowMenu
          className="-mt-2 -mr-2"
          label={`ตัวเลือกของ ${name}`}
          items={[
            { label: 'เปิด', href },
            { label: 'ตั้งค่า', href: `${href}?tab=settings` },
            { label: isArchived ? 'นำกลับมา' : 'เก็บห้องเรียน', onSelect: handleArchive },
            { label: 'ลบ', destructive: true, onSelect: () => setDeleteOpen(true) },
          ]}
        />
      </div>
      {description && (
        <p className="mt-1 line-clamp-2 text-[14px] leading-normal font-medium text-cocoon-subtle">{description}</p>
      )}
      <p className="mt-2 text-[14px] leading-normal font-medium text-cocoon-muted">
        สมาชิก {memberCount} คน · {groupCount} กลุ่ม
      </p>
      <div className="mt-auto flex justify-end pt-5">
        <Link
          href={href}
          className={cn(
            isArchived ? BTN_TERTIARY : BTN_INFO,
            'inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40',
          )}
        >
          เปิดห้องเรียน
        </Link>
      </div>
      <DeleteClassroomDialog classroomId={id} classroomName={name} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
