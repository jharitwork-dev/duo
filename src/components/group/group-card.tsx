'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { cn } from 'cn';
import { MemberIdentity, type MemberDisplay } from '@/components/cocoon/member-identity';
import { AssignStudentDialog } from '@/components/group/assign-student-dialog';
import { EditGroupDialog } from '@/components/group/edit-group-dialog';
import { DeleteGroupButton } from '@/components/group/delete-group-button';
import { OverflowMenu } from '@/components/cocoon/overflow-menu';
import { BTN_INFO, CARD, PILL_CAPACITY, PILL_FULL } from '@/components/cocoon/ui';
import { capacityLabel, effectiveGroupLimit, isGroupFull } from '@/lib/group-rules';

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
  maxMembers: number | null;
  classroomMaxGroupSize: number | null;
  classroomId: string;
  classroomMembers: ClassroomMember[];
  /** Students already in some group of the classroom. */
  assignedUserIds: string[];
  members: GroupMember[];
  /** Dashboard counts (261004-03i); chips render only when > 0. */
  pendingCount?: number;
  overdueCount?: number;
}

export function GroupCard({
  id,
  name,
  memberCount,
  maxMembers,
  classroomMaxGroupSize,
  classroomId,
  classroomMembers,
  assignedUserIds,
  members,
  pendingCount = 0,
  overdueCount = 0,
}: GroupCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const limit = effectiveGroupLimit(maxMembers, classroomMaxGroupSize);
  const full = isGroupFull(memberCount, limit);
  const href = `/teacher/classroom/${classroomId}/group/${id}`;

  return (
    <div className={cn(CARD, 'flex flex-col gap-4')}>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={href}
          className="min-w-0 rounded-sm text-[20px] leading-normal font-bold break-words text-cocoon-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
        >
          {name}
        </Link>
        <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1.5">
          {full && <span className={PILL_FULL}>เต็ม</span>}
          <span className={PILL_CAPACITY}>
            <Users className="size-3.5" aria-hidden />
            {capacityLabel(memberCount, limit)}
          </span>
          <OverflowMenu
            label={`ตัวเลือกของ ${name}`}
            items={[
              { label: 'เปิด', href },
              { label: 'แก้ไข', onSelect: () => setEditOpen(true) },
              { label: 'ลบกลุ่ม', destructive: true, onSelect: () => setDeleteOpen(true) },
            ]}
          />
        </div>
      </div>
      {(pendingCount > 0 || overdueCount > 0) && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {pendingCount > 0 && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-cocoon-blue-soft px-2 text-[11px] font-bold text-cocoon-blue">
              รอตรวจ {pendingCount}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-[rgba(255,27,15,.12)] px-2 text-[11px] font-bold text-[#d11a0f]">
              เลยกำหนด {overdueCount}
            </span>
          )}
        </div>
      )}

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
        <AssignStudentDialog
          groupId={id}
          classroomMembers={classroomMembers}
          assignedUserIds={assignedUserIds}
          isFull={full}
        />
        <Link href={href} className={cn(BTN_INFO, 'inline-flex h-10 items-center text-[14px]')}>
          จัดการ Phase
        </Link>
      </div>

      <EditGroupDialog
        groupId={id}
        name={name}
        maxMembers={maxMembers}
        memberCount={memberCount}
        classroomMaxGroupSize={classroomMaxGroupSize}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteGroupButton
        groupId={id}
        groupName={name}
        redirectHref={`/teacher/classroom/${classroomId}?tab=students`}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
