'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';
import { cn } from 'cn';
import { createGroupAsStudent, joinGroup } from '@/server/actions/group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberAvatar } from '@/components/cocoon/member-identity';
import {
  BTN_PRIMARY,
  CARD,
  CARD_META,
  CARD_TITLE,
  EMPTY_CARD,
  INPUT,
  LABEL,
  PILL_CAPACITY,
  PILL_FULL,
} from '@/components/cocoon/ui';
import { capacityLabel, isGroupFull, type GroupMode } from '@/lib/group-rules';

export interface PickerGroup {
  id: string;
  name: string;
  memberCount: number;
  /** Effective limit; null = unlimited. */
  limit: number | null;
  /** Classmates: name + avatar only (no emails). */
  members: { name: string; imageUrl: string | null }[];
}

interface StudentGroupPickerProps {
  classroomId: string;
  groupMode: Exclude<GroupMode, 'teacher'>;
  groups: PickerGroup[];
}

/** Groupless student in a self_join / self_create classroom: join a group (or create one). */
export function StudentGroupPicker({ classroomId, groupMode, groups }: StudentGroupPickerProps) {
  const router = useRouter();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const busy = joiningId !== null || creating;

  async function handleJoin(group: PickerGroup) {
    setJoiningId(group.id);
    try {
      const result = await joinGroup({ groupId: group.id });
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(`เข้าร่วม ${group.name} แล้ว`);
      router.push(`/student/classroom/${classroomId}/group/${result.groupId}`);
    } catch {
      toast.error('เข้าร่วมกลุ่มไม่สำเร็จ');
    } finally {
      setJoiningId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const result = await createGroupAsStudent({ classroomId, name });
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(`สร้างกลุ่ม ${name} แล้ว`);
      router.push(`/student/classroom/${classroomId}/group/${result.groupId}`);
    } catch {
      toast.error('สร้างกลุ่มไม่สำเร็จ');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h2 className={CARD_TITLE}>เลือกกลุ่มของคุณ</h2>
        <p className={CARD_META}>
          {groupMode === 'self_create'
            ? 'เข้าร่วมกลุ่มที่มีอยู่ หรือสร้างกลุ่มใหม่ให้เพื่อนเข้าร่วม'
            : 'เลือกกลุ่มที่ต้องการเข้าร่วม'}
        </p>
      </div>

      {groupMode === 'self_create' && (
        <form onSubmit={handleCreate} className={cn(CARD, 'space-y-3 border-dashed border-cocoon-blue/40 bg-cocoon-blue-soft')}>
          <div className="space-y-2">
            <Label htmlFor="new-group-name" className={LABEL}>สร้างกลุ่มใหม่</Label>
            <Input
              id="new-group-name"
              className={cn(INPUT, 'bg-white')}
              value={newName}
              maxLength={100}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ตั้งชื่อกลุ่ม"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className={cn(BTN_PRIMARY, 'inline-flex w-full items-center justify-center gap-2 disabled:opacity-50 lg:w-auto')}
          >
            <Plus className="size-4" aria-hidden />
            {creating ? 'กำลังสร้าง...' : 'สร้างกลุ่มใหม่'}
          </button>
        </form>
      )}

      {groups.length === 0 ? (
        <div className={EMPTY_CARD}>
          <p className="text-[16px] leading-normal font-bold text-cocoon-ink">ยังไม่มีกลุ่มให้เลือก</p>
          <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
            {groupMode === 'self_create' ? 'สร้างกลุ่มแรกของห้องเรียนได้เลย' : 'รอครูสร้างกลุ่ม'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
          {groups.map((group) => {
            const full = isGroupFull(group.memberCount, group.limit);
            return (
              <div key={group.id} className={cn(CARD, 'flex flex-col gap-4', full && 'bg-[#fafbfc]')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[18px] leading-normal font-bold break-words text-cocoon-ink">{group.name}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {full && <span className={PILL_FULL}>เต็ม</span>}
                    <span className={PILL_CAPACITY}>
                      <Users className="size-3.5" aria-hidden />
                      {capacityLabel(group.memberCount, group.limit)}
                    </span>
                  </div>
                </div>
                {group.members.length === 0 ? (
                  <p className="text-[14px] font-medium text-cocoon-muted">ยังไม่มีสมาชิก — เป็นคนแรกได้เลย</p>
                ) : (
                  <ul className="flex flex-wrap gap-x-3 gap-y-2">
                    {group.members.map((m, i) => (
                      <li key={`${m.name}-${i}`} className="flex min-w-0 items-center gap-2">
                        <MemberAvatar name={m.name} imageUrl={m.imageUrl} className="size-7" />
                        <span className="max-w-[140px] truncate text-[13px] font-medium text-cocoon-ink">{m.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  disabled={full || busy}
                  onClick={() => handleJoin(group)}
                  className={cn(BTN_PRIMARY, 'mt-auto w-full disabled:opacity-50')}
                >
                  {joiningId === group.id ? 'กำลังเข้าร่วม...' : full ? 'กลุ่มเต็มแล้ว' : 'เข้าร่วมกลุ่มนี้'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
