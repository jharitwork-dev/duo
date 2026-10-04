import { getCurrentUserId, requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getStudentDeadlines } from '@/server/queries/deadline';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { StudentDeadlineList } from '@/components/student/student-deadline-list';

export default async function StudentDeadlinesPage() {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const sections = await getStudentDeadlines(userId);

  return (
    <>
      <CocoonHeader variant="home" />
      <div className="px-[33px] pt-4 pb-8 lg:px-0 lg:pt-[26px]">
        <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue lg:text-[30px]">กำหนดส่ง</h1>
        <StudentDeadlineList sections={sections} />
      </div>
    </>
  );
}
