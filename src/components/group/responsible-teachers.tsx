'use client';

// "ครูที่ดูแล" label + group-page control (quick task 261006-ij6).
// Rendered from server pages too: all props are plain serialisable data.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { cn } from 'cn';
import { setGroupTeacher } from '@/server/actions/group-teacher';
import { BTN_PRIMARY, BTN_TERTIARY, PILL_CAPACITY, SELECT } from '@/components/cocoon/ui';
import { TEACHER_RANK_LABEL, type ResponsibleTeacher, type TeacherRank } from '@/lib/group-teachers';

interface ResponsibleTeachersLabelProps {
  teachers: ResponsibleTeacher[];
  /** Teacher views: show "ยังไม่มีครูดูแล" when empty (students see nothing). */
  showEmpty?: boolean;
  compact?: boolean;
  className?: string;
}

/** Read-only "ครูที่ดูแล" label: one pill per teacher with rank. No interactive elements (safe inside a Link). */
export function ResponsibleTeachersLabel({ teachers, showEmpty, compact, className }: ResponsibleTeachersLabelProps) {
  if (teachers.length === 0 && !showEmpty) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'mt-1.5' : 'mt-2', className)}>
      <span className="text-[12px] font-bold text-cocoon-muted">ครูที่ดูแล</span>
      {teachers.length === 0 ? (
        <span className="text-[12px] font-medium text-cocoon-muted">ยังไม่มีครูดูแล</span>
      ) : (
        teachers.map((t) => (
          <span key={t.userId} className={PILL_CAPACITY}>
            {`${t.name} · ${TEACHER_RANK_LABEL[t.rank]}`}
          </span>
        ))
      )}
    </div>
  );
}

interface GroupTeachersControlProps {
  groupId: string;
  currentUserId: string;
  /** Caller is a teacher of this classroom (owner or teacher member). */
  canSelfAssign: boolean;
  /** Owner or superadmin: may assign / unassign any classroom teacher. */
  canManage: boolean;
  assigned: ResponsibleTeacher[];
  classroomTeachers: { userId: string; name: string; rank: TeacherRank }[];
}

/** Teacher group page: label + "ดูแลกลุ่มนี้" toggle (self) + assign/unassign (owner/superadmin). */
export function GroupTeachersControl({
  groupId,
  currentUserId,
  canSelfAssign,
  canManage,
  assigned,
  classroomTeachers,
}: GroupTeachersControlProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState('');

  const isAssigned = assigned.some((t) => t.userId === currentUserId);
  const assignable = classroomTeachers.filter((t) => !assigned.some((a) => a.userId === t.userId));

  async function change(userId: string, responsible: boolean) {
    setPending(true);
    try {
      const result = await setGroupTeacher({ groupId, userId, responsible });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('บันทึกครูที่ดูแลแล้ว');
      setSelected('');
      router.refresh();
    } catch {
      toast.error('ทำรายการไม่สำเร็จ');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[14px] font-bold text-cocoon-ink">ครูที่ดูแล</span>
        {assigned.length === 0 ? (
          <span className="text-[14px] font-medium text-cocoon-muted">ยังไม่มีครูดูแล</span>
        ) : (
          assigned.map((t) => (
            <span key={t.userId} className={PILL_CAPACITY}>
              {`${t.name} · ${TEACHER_RANK_LABEL[t.rank]}`}
              {canManage && (
                <button
                  type="button"
                  aria-label={`นำ${t.name}ออกจากครูที่ดูแล`}
                  disabled={pending}
                  onClick={() => change(t.userId, false)}
                  className="-mr-1 flex size-4 items-center justify-center rounded-full hover:bg-cocoon-blue/10 disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {(canSelfAssign || canManage) && (
        <div className="flex flex-wrap items-center gap-2">
          {canSelfAssign && (
            <button
              type="button"
              disabled={pending}
              onClick={() => change(currentUserId, !isAssigned)}
              className={cn(isAssigned ? BTN_TERTIARY : BTN_PRIMARY, 'h-10 text-[14px] disabled:opacity-50')}
            >
              {isAssigned ? 'เลิกดูแลกลุ่มนี้' : 'ดูแลกลุ่มนี้'}
            </button>
          )}
          {canManage && assignable.length > 0 && (
            <>
              <label htmlFor={`assign-teacher-${groupId}`} className="sr-only">
                เพิ่มครูที่ดูแล
              </label>
              <select
                id={`assign-teacher-${groupId}`}
                value={selected}
                disabled={pending}
                onChange={(e) => setSelected(e.target.value)}
                className={`${SELECT} flex-1`}
              >
                <option value="">เลือกครูที่ดูแล…</option>
                {assignable.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {`${t.name} · ${TEACHER_RANK_LABEL[t.rank]}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !selected}
                onClick={() => selected && change(selected, true)}
                className={cn(BTN_PRIMARY, 'h-10 text-[14px] disabled:opacity-50')}
              >
                เพิ่ม
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
