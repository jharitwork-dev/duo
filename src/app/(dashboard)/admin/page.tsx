import { clerkClient } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { CARD, CARD_TITLE, EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';
import { AdminActions } from './admin-actions';

export default async function AdminDashboard() {
  await requireRole(ROLES.SUPERADMIN);

  const client = await clerkClient();
  const usersResponse = await client.users.getUserList({ limit: 100 });

  const pendingTeachers = usersResponse.data.filter(
    (user) => user.publicMetadata?.role === 'teacher_pending'
  );

  return (
    <>
      <CocoonHeader variant="home" />
      <PageHeader title="แอดมิน" subtitle="อนุมัติบัญชีครู" />

      <div className={PAGE_BODY}>
        <h2 className={`${CARD_TITLE} mb-4`}>ครูที่รอการอนุมัติ ({pendingTeachers.length})</h2>
        {pendingTeachers.length === 0 ? (
          <div className={EMPTY_CARD}>
            <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ไม่มีครูที่รอการอนุมัติ</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
              เมื่อมีครูสมัครใหม่ รายชื่อจะแสดงที่นี่
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </>
  );
}
