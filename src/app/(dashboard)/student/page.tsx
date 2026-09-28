import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getStudentClassrooms } from '@/server/queries/classroom';
import { getStudentGroup } from '@/server/queries/group';
import { JoinCodeInput } from '@/components/student/join-code-input';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';

export default async function StudentDashboard() {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();

  const classrooms = await getStudentClassrooms(userId);

  // 0 classrooms: show empty state with join input
  if (classrooms.length === 0) {
    return (
      <>
        <CocoonHeader variant="home" />
        <div className="px-[33px] pt-4">
          <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue">
            ยังไม่ได้เข้าร่วมห้องเรียน
          </h1>
          <div className="mt-4 space-y-4 rounded-[12px] border border-cocoon-line bg-white p-6">
            <p className="text-center text-[14px] leading-normal font-medium text-cocoon-muted">
              ใส่รหัสเข้าร่วมที่ได้รับจากครูเพื่อเข้าห้องเรียน
            </p>
            <JoinCodeInput />
          </div>
        </div>
      </>
    );
  }

  // 1 classroom: auto-redirect (D-20, avoiding Pitfall 7)
  if (classrooms.length === 1) {
    const classroom = classrooms[0];
    const group = await getStudentGroup(classroom.id, userId);

    if (group) {
      // Has group: go directly to group phase view
      redirect(`/student/classroom/${classroom.id}/group/${group.id}`);
    } else {
      // No group: go to classroom page (shows waiting/group-picker state)
      redirect(`/student/classroom/${classroom.id}`);
    }
  }

  // Multiple classrooms: show classroom cards
  return (
    <>
      <CocoonHeader variant="home" />
      <div className="px-[33px] pt-4">
        <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue">ห้องเรียนของฉัน</h1>
        <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
          เลือกห้องเรียนเพื่อดูโปรเจกต์ของคุณ
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {classrooms.map((classroom) => (
            <li key={classroom.id}>
              <Link
                href={`/student/classroom/${classroom.id}`}
                className="block rounded-[12px] border border-cocoon-line bg-white p-5 transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
              >
                <p className="text-[16px] leading-normal font-bold text-cocoon-ink">
                  {classroom.name}
                  {classroom.isArchived && (
                    <span className="ml-2 rounded-[26px] bg-[rgba(15,23,42,.05)] px-2 text-[12px] font-medium text-cocoon-disabled">
                      Archived
                    </span>
                  )}
                </p>
                {classroom.description && (
                  <p className="mt-1 text-[14px] leading-normal font-medium text-cocoon-muted">
                    {classroom.description}
                  </p>
                )}
                <p className="mt-1 text-[12px] leading-normal font-medium text-cocoon-muted">
                  {classroom.groupCount} กลุ่ม
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
