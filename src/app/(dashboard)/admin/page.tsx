import { clerkClient } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { CARD, CARD_TITLE, PAGE_BODY } from '@/components/cocoon/ui';
import { AdminActions } from './admin-actions';
import { UserRoleList, type AdminUserRow } from './user-role-list';
import { getCurrentUserId } from '@/lib/auth';

export default async function AdminDashboard() {
  await requireRole(ROLES.SUPERADMIN);

  const currentUserId = await getCurrentUserId();
  const client = await clerkClient();
  const usersResponse = await client.users.getUserList({ limit: 200, orderBy: '-created_at' });

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
