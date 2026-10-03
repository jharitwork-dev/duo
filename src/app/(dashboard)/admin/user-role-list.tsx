'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from 'cn';
import { setUserRole } from '@/server/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MemberIdentity } from '@/components/cocoon/member-identity';
import { BTN_INFO, BTN_TERTIARY, CARD, INPUT } from '@/components/cocoon/ui';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  role: string | null;
  isSelf: boolean;
}

const ROLE_LABEL: Record<string, { label: string; className: string }> = {
  superadmin: { label: 'ผู้ดูแลระบบ', className: 'bg-cocoon-orange/15 text-cocoon-orange' },
  teacher: { label: 'ครู', className: 'bg-cocoon-blue-soft text-cocoon-blue' },
  teacher_pending: { label: 'ครู (รออนุมัติ)', className: 'bg-cocoon-yellow/20 text-[#b07300]' },
  student: { label: 'นักเรียน', className: 'bg-cocoon-green/15 text-cocoon-green' },
};

function RoleBadge({ role }: { role: string | null }) {
  const meta = (role && ROLE_LABEL[role]) || { label: 'ยังไม่ตั้งค่า', className: 'bg-black/5 text-cocoon-muted' };
  return (
    <span className={cn('inline-flex h-[26px] shrink-0 items-center rounded-full px-3 text-[12px] font-bold', meta.className)}>
      {meta.label}
    </span>
  );
}

export function UserRoleList({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, query]);

  function changeRole(user: AdminUserRow, role: 'teacher' | 'student') {
    setPendingId(user.id);
    startTransition(async () => {
      const result = await setUserRole(user.id, role);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        role === 'teacher'
          ? `ตั้ง ${user.name} เป็นครูแล้ว (มีผลเมื่อผู้ใช้รีเฟรชหน้า)`
          : `เปลี่ยน ${user.name} เป็นนักเรียนแล้ว`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาด้วยชื่อหรืออีเมล"
        aria-label="ค้นหาผู้ใช้"
        className={INPUT}
      />

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-[14px] font-medium text-cocoon-muted">ไม่พบผู้ใช้</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {filtered.map((user) => {
            const busy = pendingId === user.id;
            const locked = user.isSelf || user.role === 'superadmin';
            const isTeacher = user.role === 'teacher';
            return (
              <li key={user.id} className={cn(CARD, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:p-5')}>
                <div className="flex min-w-0 items-center gap-3">
                  <MemberIdentity name={user.name} email={user.email} imageUrl={user.imageUrl} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RoleBadge role={user.role} />
                  {!locked &&
                    (isTeacher ? (
                      <Button
                        variant="outline"
                        className={cn(BTN_TERTIARY, 'h-9 px-4 text-[14px]')}
                        disabled={busy}
                        onClick={() => changeRole(user, 'student')}
                      >
                        {busy ? 'กำลังบันทึก…' : 'เปลี่ยนเป็นนักเรียน'}
                      </Button>
                    ) : (
                      <Button
                        className={cn(BTN_INFO, 'h-9 px-4 text-[14px]')}
                        disabled={busy}
                        onClick={() => changeRole(user, 'teacher')}
                      >
                        {busy ? 'กำลังบันทึก…' : 'ตั้งเป็นครู'}
                      </Button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
