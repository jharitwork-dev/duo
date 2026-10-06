'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserMinus } from 'lucide-react';
import { addClassroomTeacher, removeClassroomTeacher } from '@/server/actions/classroom';
import { MemberIdentity } from '@/components/cocoon/member-identity';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { BTN_PRIMARY, CARD, CARD_META, CARD_TITLE, PILL_CAPACITY, SELECT } from '@/components/cocoon/ui';
import type { TeacherOption } from '@/lib/user-directory';

export interface ClassroomTeacherRow {
  userId: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  isOwner: boolean;
}

interface ClassroomTeachersProps {
  classroomId: string;
  teachers: ClassroomTeacherRow[];
  /** Owner or superadmin: may add / remove teachers. Others see a read-only list. */
  canManage: boolean;
  /** Approved teachers not yet in this classroom. */
  availableTeachers: TeacherOption[];
}

/** Settings tab: "ครูประจำห้อง" — who teaches this classroom; owner/superadmin can add or remove. */
export function ClassroomTeachers({ classroomId, teachers, canManage, availableTeachers }: ClassroomTeachersProps) {
  const router = useRouter();
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<ClassroomTeacherRow | null>(null);

  async function handleAdd() {
    if (!selected) return;
    setPending(true);
    try {
      const result = await addClassroomTeacher({ classroomId, userId: selected });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('เพิ่มครูแล้ว');
      setSelected('');
      router.refresh();
    } catch {
      toast.error('ทำรายการไม่สำเร็จ');
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(teacher: ClassroomTeacherRow) {
    try {
      const result = await removeClassroomTeacher({ classroomId, userId: teacher.userId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('นำครูออกจากห้องเรียนแล้ว');
      setRemoving(null);
      router.refresh();
    } catch {
      toast.error('ทำรายการไม่สำเร็จ');
    }
  }

  return (
    <section className={CARD}>
      <h2 className={CARD_TITLE}>ครูประจำห้อง ({teachers.length})</h2>

      <ul className="mt-4 divide-y divide-[#f1ece5]">
        {teachers.map((teacher) => (
          <li key={teacher.userId} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <MemberIdentity name={teacher.name} email={teacher.email} imageUrl={teacher.imageUrl} />
              {teacher.isOwner && <span className={PILL_CAPACITY}>เจ้าของห้อง</span>}
            </div>
            {canManage && !teacher.isOwner && (
              <button
                type="button"
                aria-label={`นำ ${teacher.name} ออก`}
                disabled={pending}
                onClick={() => setRemoving(teacher)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-cocoon-muted transition-colors hover:bg-[#fff1e8] hover:text-[#e8590c] disabled:opacity-50"
              >
                <UserMinus className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage &&
        (availableTeachers.length === 0 ? (
          <p className={`${CARD_META} mt-3`}>ไม่มีครูที่เพิ่มได้</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor={`add-teacher-${classroomId}`} className="sr-only">
              เพิ่มครู
            </label>
            <select
              id={`add-teacher-${classroomId}`}
              value={selected}
              disabled={pending}
              onChange={(e) => setSelected(e.target.value)}
              className={`${SELECT} flex-1`}
            >
              <option value="">เลือกครูที่จะเพิ่ม…</option>
              {availableTeachers.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.email ? `${t.name} · ${t.email}` : t.name}
                </option>
              ))}
            </select>
            <button type="button" disabled={pending || !selected} onClick={handleAdd} className={BTN_PRIMARY}>
              {pending ? 'กำลังเพิ่ม…' : 'เพิ่ม'}
            </button>
          </div>
        ))}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `นำ ${removing.name} ออกจากห้องเรียน?` : ''}
        consequences={
          removing ? [`${removing.name} จะไม่เห็นและแก้ไขห้องเรียนนี้อีก`, 'เพิ่มกลับเข้ามาใหม่ได้ภายหลัง'] : []
        }
        confirmLabel="นำครูออก"
        onConfirm={async () => {
          if (removing) await handleRemove(removing);
        }}
      />
    </section>
  );
}
