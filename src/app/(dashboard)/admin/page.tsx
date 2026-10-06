import Link from 'next/link';
import { clerkClient } from '@clerk/nextjs/server';
import { ChevronRight } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { CARD, CARD_META, CARD_TITLE, PAGE_BODY } from '@/components/cocoon/ui';
import { getAllClassroomsForAdmin } from '@/server/queries/classroom';
import { AdminActions } from './admin-actions';
import { UserRoleList, type AdminUserRow } from './user-role-list';
import { getCurrentUserId } from '@/lib/auth';

export default async function AdminDashboard() {
  await requireRole(ROLES.SUPERADMIN);

  const currentUserId = await getCurrentUserId();
  const client = await clerkClient();
  const [usersResponse, allClassrooms] = await Promise.all([
    client.users.getUserList({ limit: 200, orderBy: '-created_at' }),
    getAllClassroomsForAdmin(),
  ]);

  const allUsers: AdminUserRow[] = usersResponse.data.map((user) => {
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return {
      id: user.id,
      name: fullName || user.username || email || 'ไม่ระบุชื่อ',
      email,
      imageUrl: user.hasImage ? user.imageUrl : null,
      role: (user.publicMetadata?.role as string | undefined) ?? null,
      isSelf: user.id === currentUserId,
    };
  });

  const pendingTeachers = usersResponse.data.filter(
    (user) => user.publicMetadata?.role === 'teacher_pending'
  );

  return (
    <>
      <CocoonHeader variant="home" />
      <PageHeader title="แอดมิน" subtitle="จัดการบทบาทผู้ใช้ (ครู / นักเรียน)" />

      <div className={PAGE_BODY}>
        {pendingTeachers.length > 0 && (
          <section className="mb-10">
            <h2 className={`${CARD_TITLE} mb-4`}>ครูที่รอการอนุมัติ ({pendingTeachers.length})</h2>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-8">
              {pendingTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className={`${CARD} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
                >
                  <div className="min-w-0">
                    <p className="text-[18px] leading-normal font-bold break-words text-cocoon-ink">
                      {[teacher.firstName, teacher.lastName].filter(Boolean).join(' ') || 'ไม่มีชื่อ'}
                    </p>
                    <p className="text-[14px] leading-normal font-medium break-all text-cocoon-muted">
                      {teacher.emailAddresses[0]?.emailAddress ?? 'ไม่มีอีเมล'}
                    </p>
                  </div>
                  <AdminActions teacherUserId={teacher.id} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <h2 className={`${CARD_TITLE} mb-1`}>ห้องเรียนทั้งหมด ({allClassrooms.length})</h2>
          <p className={`${CARD_META} mb-4`}>เปิดห้องเรียนเพื่อจัดการ “ครูประจำห้อง” ในแท็บตั้งค่า</p>
          {allClassrooms.length === 0 ? (
            <p className={CARD_META}>ยังไม่มีห้องเรียน</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
              {allClassrooms.map((c) => (
                <Link
                  key={c.id}
                  href={`/teacher/classroom/${c.id}?tab=settings`}
                  className={`${CARD} flex items-center justify-between gap-3 transition-colors hover:border-cocoon-blue/30`}
                >
                  <div className="min-w-0">
                    <p className="text-[16px] leading-normal font-bold break-words text-cocoon-ink">{c.name}</p>
                    <p className={CARD_META}>
                      เจ้าของ: {c.ownerName}
                      {c.isArchived && ' · เก็บแล้ว'}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-cocoon-muted" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className={`${CARD_TITLE} mb-1`}>ผู้ใช้ทั้งหมด ({allUsers.length})</h2>
          <p className="mb-4 text-[14px] leading-normal font-medium text-cocoon-muted">
            ผู้สมัครใหม่ทุกคนเป็นนักเรียน กด “ตั้งเป็นครู” เพื่อให้สิทธิ์ครู
          </p>
          <UserRoleList users={allUsers} />
        </section>
      </div>
    </>
  );
}
