'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, UserMinus } from 'lucide-react';
import { cn } from 'cn';
import { assignStudent, moveStudent, removeFromGroup } from '@/server/actions/group';
import { removeStudent } from '@/server/actions/classroom';
import { Input } from '@/components/ui/input';
import { MemberIdentity } from '@/components/cocoon/member-identity';
import { OverflowMenu } from '@/components/cocoon/overflow-menu';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import {
  BTN_PRIMARY,
  BTN_TERTIARY,
  CARD,
  CARD_META,
  CARD_TITLE,
  EMPTY_CARD,
  INPUT,
  PILL_CAPACITY,
  PILL_FULL,
  SELECT,
} from '@/components/cocoon/ui';
import { capacityLabel, isGroupFull } from '@/lib/group-rules';

export interface RosterStudent {
  userId: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}

export interface RosterGroup {
  id: string;
  name: string;
  /** Effective limit (group ?? classroom default), null = unlimited. */
  limit: number | null;
  memberIds: string[];
}

interface StudentRosterProps {
  classroomId: string;
  students: RosterStudent[];
  groups: RosterGroup[];
}

/** userId -> groupId (null = unassigned); 'removed' = removed from classroom. */
type Override = string | null | 'removed';

const CHECKBOX = 'size-5 shrink-0 accent-primary';

/**
 * "นักเรียน" tab: unassigned students with one-click / bulk assign, assigned students grouped by
 * group with move / remove, search by name or email. Optimistic, rolled back on failure.
 * The parent keys this component on the membership snapshot so overrides reset after refresh.
 */
export function StudentRoster({ classroomId, students, groups }: StudentRosterProps) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Map<string, Override>>(() => new Map());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [rowTarget, setRowTarget] = useState<Record<string, string>>({});
  const [bulkTarget, setBulkTarget] = useState('');
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [removing, setRemoving] = useState<RosterStudent | null>(null);

  // Effective membership = server snapshot + optimistic overrides.
  const baseGroupOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) for (const id of g.memberIds) if (!map.has(id)) map.set(id, g.id);
    return map;
  }, [groups]);

  const groupOf = (userId: string): string | null => {
    const o = overrides.get(userId);
    if (o === 'removed') return null;
    if (o !== undefined) return o;
    return baseGroupOf.get(userId) ?? null;
  };

  const visibleStudents = students.filter((s) => overrides.get(s.userId) !== 'removed');
  const counts = new Map<string, number>(groups.map((g) => [g.id, 0]));
  for (const s of visibleStudents) {
    const gid = groupOf(s.userId);
    if (gid) counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }

  const q = query.trim().toLowerCase();
  const matches = (s: RosterStudent) =>
    !q || s.name.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q);

  const unassigned = visibleStudents.filter((s) => groupOf(s.userId) === null);
  const unassignedShown = unassigned.filter(matches);

  const groupLabel = (g: RosterGroup) => `${g.name} (${capacityLabel(counts.get(g.id) ?? 0, g.limit).replace(' คน', '')})`;
  const isFull = (g: RosterGroup) => isGroupFull(counts.get(g.id) ?? 0, g.limit);

  function setOverride(userId: string, value: Override | undefined) {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (value === undefined) next.delete(userId);
      else next.set(userId, value);
      return next;
    });
  }

  function setBusyFor(userId: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  /** Runs one optimistic membership change; returns the error message or null. */
  async function runChange(
    userId: string,
    optimistic: Override,
    call: () => Promise<{ success: true } | { success: false; error: string }>,
  ): Promise<string | null> {
    const previous = overrides.get(userId);
    setOverride(userId, optimistic);
    setBusyFor(userId, true);
    try {
      const result = await call();
      if (!result.success) {
        setOverride(userId, previous);
        return result.error;
      }
      return null;
    } catch {
      setOverride(userId, previous);
      return 'ทำรายการไม่สำเร็จ';
    } finally {
      setBusyFor(userId, false);
    }
  }

  async function handleAssign(student: RosterStudent, groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const error = await runChange(student.userId, groupId, () => assignStudent({ groupId, userId: student.userId }));
    if (error) toast.error(error);
    else {
      toast.success(`เพิ่ม ${student.name} เข้า ${group.name} แล้ว`);
      router.refresh();
    }
  }

  async function handleMove(student: RosterStudent, toGroupId: string) {
    const group = groups.find((g) => g.id === toGroupId);
    if (!group || groupOf(student.userId) === toGroupId) return;
    const error = await runChange(student.userId, toGroupId, () =>
      moveStudent({ classroomId, userId: student.userId, toGroupId }),
    );
    if (error) toast.error(error);
    else {
      toast.success(`ย้าย ${student.name} ไป ${group.name} แล้ว`);
      router.refresh();
    }
  }

  async function handleUnassign(student: RosterStudent, groupId: string) {
    const error = await runChange(student.userId, null, () => removeFromGroup({ groupId, userId: student.userId }));
    if (error) toast.error(error);
    else {
      toast.success(`นำ ${student.name} ออกจากกลุ่มแล้ว`);
      router.refresh();
    }
  }

  async function handleRemoveFromClassroom(student: RosterStudent) {
    const error = await runChange(student.userId, 'removed', () =>
      removeStudent({ classroomId, userId: student.userId }),
    );
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`นำ ${student.name} ออกจากห้องเรียนแล้ว`);
    setRemoving(null);
    router.refresh();
  }

  async function handleBulkAssign() {
    const group = groups.find((g) => g.id === bulkTarget);
    if (!group) return;
    const queue = unassigned.filter((s) => selected.has(s.userId));
    setBulkBusy(true);
    let done = 0;
    let failure: string | null = null;
    for (const student of queue) {
      const error = await runChange(student.userId, group.id, () =>
        assignStudent({ groupId: group.id, userId: student.userId }),
      );
      if (error) {
        failure = error;
        break;
      }
      done++;
    }
    setBulkBusy(false);
    setSelected(new Set());
    if (failure) toast.error(`เพิ่มแล้ว ${done} คน, ไม่สำเร็จ: ${failure}`);
    else toast.success(`เพิ่ม ${done} คนเข้า ${group.name} แล้ว`);
    router.refresh();
  }

  function toggleSelected(userId: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  const removeMenuItem = (student: RosterStudent) => ({
    label: 'ลบออกจากห้องเรียน',
    destructive: true,
    onSelect: () => setRemoving(student),
  });

  if (students.length === 0) {
    return (
      <div className={EMPTY_CARD}>
        <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีนักเรียน</p>
        <p className="text-[14px] leading-normal font-medium text-cocoon-muted">แชร์รหัสเชิญจากแท็บตั้งค่า</p>
      </div>
    );
  }

  const selectedInView = unassigned.filter((s) => selected.has(s.userId));
  const removingGroup = removing ? groups.find((g) => g.id === groupOf(removing.userId)) : undefined;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className={PILL_CAPACITY}>ทั้งหมด {visibleStudents.length} คน</span>
          <span className={cn(PILL_CAPACITY, unassigned.length > 0 && 'bg-[#fff1e8] text-[#e8590c]')}>
            ยังไม่มีกลุ่ม {unassigned.length} คน
          </span>
        </div>
        <label className="relative block w-full lg:w-[320px]">
          <span className="sr-only">ค้นหานักเรียน</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-cocoon-muted" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อหรืออีเมล"
            className={cn(INPUT, 'pl-10')}
          />
        </label>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        {/* Unassigned */}
        <section className={cn(CARD, 'space-y-4')}>
          <div>
            <h2 className={CARD_TITLE}>ยังไม่มีกลุ่ม ({unassigned.length})</h2>
            <p className={CARD_META}>เลือกกลุ่มแล้วกด เพิ่ม หรือเลือกหลายคนแล้วย้ายพร้อมกัน</p>
          </div>

          {selectedInView.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-cocoon-blue-soft p-3">
              <span className="text-[14px] font-bold text-cocoon-blue">เลือก {selectedInView.length} คน</span>
              <select
                aria-label="ย้ายที่เลือกไปกลุ่ม"
                className={cn(SELECT, 'flex-1 bg-white')}
                value={bulkTarget}
                onChange={(e) => setBulkTarget(e.target.value)}
                disabled={bulkBusy}
              >
                <option value="">ย้ายที่เลือกไปกลุ่ม…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id} disabled={isFull(g)}>
                    {groupLabel(g)}
                    {isFull(g) ? ' · เต็ม' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={cn(BTN_PRIMARY, 'h-10 text-[14px] disabled:opacity-50')}
                disabled={!bulkTarget || bulkBusy}
                onClick={handleBulkAssign}
              >
                {bulkBusy ? 'กำลังเพิ่ม...' : 'ย้าย'}
              </button>
            </div>
          )}

          {unassigned.length === 0 ? (
            <p className="text-[14px] font-medium text-cocoon-muted">ทุกคนมีกลุ่มแล้ว</p>
          ) : unassignedShown.length === 0 ? (
            <p className="text-[14px] font-medium text-cocoon-muted">ไม่พบนักเรียนที่ค้นหา</p>
          ) : groups.length === 0 ? (
            <>
              <p className="text-[14px] font-medium text-cocoon-muted">สร้างกลุ่มก่อนในแท็บ กลุ่ม</p>
              <ul className="space-y-2">
                {unassignedShown.map((s) => (
                  <li key={s.userId} className="flex items-center gap-2 rounded-[12px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <MemberIdentity name={s.name} email={s.email} imageUrl={s.imageUrl} />
                    </div>
                    <OverflowMenu label={`ตัวเลือกของ ${s.name}`} items={[removeMenuItem(s)]} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className="space-y-2">
              {unassignedShown.map((s) => {
                const target = rowTarget[s.userId] ?? '';
                const rowBusy = busy.has(s.userId) || bulkBusy;
                return (
                  <li
                    key={s.userId}
                    className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      className={CHECKBOX}
                      aria-label={`เลือก ${s.name}`}
                      checked={selected.has(s.userId)}
                      onChange={(e) => toggleSelected(s.userId, e.target.checked)}
                      disabled={rowBusy}
                    />
                    <div className="min-w-0 flex-1 basis-40">
                      <MemberIdentity name={s.name} email={s.email} imageUrl={s.imageUrl} />
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <select
                        aria-label={`กลุ่มสำหรับ ${s.name}`}
                        className={cn(SELECT, 'flex-1 sm:w-44 sm:flex-none')}
                        value={target}
                        onChange={(e) => setRowTarget((prev) => ({ ...prev, [s.userId]: e.target.value }))}
                        disabled={rowBusy}
                      >
                        <option value="">เลือกกลุ่ม</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id} disabled={isFull(g)}>
                            {groupLabel(g)}
                            {isFull(g) ? ' · เต็ม' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={cn(BTN_PRIMARY, 'h-10 px-4 text-[14px] disabled:opacity-50')}
                        disabled={!target || rowBusy}
                        onClick={() => handleAssign(s, target)}
                      >
                        เพิ่ม
                      </button>
                      <OverflowMenu label={`ตัวเลือกของ ${s.name}`} items={[removeMenuItem(s)]} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Assigned, grouped by group */}
        <section className={cn(CARD, 'space-y-4')}>
          <div>
            <h2 className={CARD_TITLE}>มีกลุ่มแล้ว ({visibleStudents.length - unassigned.length})</h2>
            <p className={CARD_META}>ย้ายกลุ่มหรือนำออกจากกลุ่ม</p>
          </div>
          {groups.length === 0 ? (
            <p className="text-[14px] font-medium text-cocoon-muted">ยังไม่มีกลุ่มในห้องเรียนนี้</p>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => {
                const members = visibleStudents.filter((s) => groupOf(s.userId) === g.id);
                const shown = members.filter(matches);
                if (q && shown.length === 0) return null;
                return (
                  <div key={g.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-[16px] font-bold text-cocoon-ink">{g.name}</h3>
                      {isFull(g) && <span className={PILL_FULL}>เต็ม</span>}
                      <span className={PILL_CAPACITY}>{capacityLabel(counts.get(g.id) ?? 0, g.limit)}</span>
                    </div>
                    {shown.length === 0 ? (
                      <p className="text-[13px] font-medium text-cocoon-muted">ยังไม่มีสมาชิก</p>
                    ) : (
                      <ul className="space-y-2">
                        {shown.map((s) => {
                          const rowBusy = busy.has(s.userId);
                          return (
                            <li
                              key={s.userId}
                              className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2"
                            >
                              <div className="min-w-0 flex-1 basis-40">
                                <MemberIdentity name={s.name} email={s.email} imageUrl={s.imageUrl} />
                              </div>
                              <div className="flex w-full items-center gap-2 sm:w-auto">
                                <select
                                  aria-label={`ย้ายกลุ่มของ ${s.name}`}
                                  className={cn(SELECT, 'flex-1 sm:w-40 sm:flex-none')}
                                  value=""
                                  onChange={(e) => e.target.value && handleMove(s, e.target.value)}
                                  disabled={rowBusy || groups.length < 2}
                                >
                                  <option value="">ย้ายกลุ่ม</option>
                                  {groups
                                    .filter((other) => other.id !== g.id)
                                    .map((other) => (
                                      <option key={other.id} value={other.id} disabled={isFull(other)}>
                                        {groupLabel(other)}
                                        {isFull(other) ? ' · เต็ม' : ''}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  className={cn(BTN_TERTIARY, 'inline-flex h-10 items-center gap-1 px-3 text-[13px] disabled:opacity-50')}
                                  disabled={rowBusy}
                                  onClick={() => handleUnassign(s, g.id)}
                                >
                                  <UserMinus className="size-4" aria-hidden />
                                  นำออกจากกลุ่ม
                                </button>
                                <OverflowMenu label={`ตัวเลือกของ ${s.name}`} items={[removeMenuItem(s)]} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `นำ ${removing.name} ออกจากห้องเรียน?` : ''}
        consequences={
          removing
            ? [
                `${removing.name} จะไม่เห็นห้องเรียนนี้อีก (เข้าร่วมใหม่ได้ด้วยรหัสเชิญ)`,
                ...(removingGroup ? [`จะถูกนำออกจาก ${removingGroup.name} ด้วย`] : []),
                'งานที่เคยส่งไว้ยังคงอยู่กับกลุ่ม',
              ]
            : []
        }
        confirmLabel="นำออกจากห้องเรียน"
        onConfirm={async () => {
          if (removing) await handleRemoveFromClassroom(removing);
        }}
      />
    </div>
  );
}
