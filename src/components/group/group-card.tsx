'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { cn } from 'cn';
import { MemberIdentity, type MemberDisplay } from '@/components/cocoon/member-identity';
import { AssignStudentDialog } from '@/components/group/assign-student-dialog';
import { BTN_INFO, CARD } from '@/components/cocoon/ui';

interface ClassroomMember extends MemberDisplay {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date | null;
}

interface GroupMember extends MemberDisplay {
  userId: string;
}

interface GroupCardProps {
  id: string;
  name: string;
  memberCount: number;
  maxGroupSize: number | null;
  classroomId: string;
  classroomMembers: ClassroomMember[];
  members: GroupMember[];
}

export function GroupCard({
  id,
  name,
  memberCount,
  maxGroupSize,
  classroomId,
  classroomMembers,
  members,
}: GroupCardProps) {
  const capacityText = maxGroupSize ? `${memberCount}/${maxGroupSize}` : `${memberCount}`;
  const href = `/teacher/classroom/${classroomId}/group/${id}`;

  return (
    <div className={cn(CARD, 'flex flex-col gap-4')}>
      <div className="flex items-start justify-between gap-3">
        <Link
          href={href}
          className="min-w-0 rounded-sm text-[20px] leading-normal font-bold break-words text-cocoon-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
        >
          {name}
        </Link>
        <span className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-full bg-cocoon-blue-soft px-3 text-[12px] font-bold text-cocoon-blue">
          <Users className="size-3.5" aria-hidden />
          {capacityText} คน
        </span>
      </div>

      {members.length === 0 ? (
        <span className="text-[14px] font-medium text-cocoon-muted">ยังไม่มีสมาชิก</span>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.userId}>
              <MemberIdentity name={member.name} email={member.email} imageUrl={member.imageUrl} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
        <AssignStudentDialog groupId={id} classroomMembers={classroomMembers} />
        <Link href={href} className={cn(BTN_INFO, 'inline-flex h-10 items-center text-[14px]')}>
          จัดการ Phase
        </Link>
      </div>
    </div>
  );
}
