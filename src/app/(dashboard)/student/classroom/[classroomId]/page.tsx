import { redirect } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getClassroomById } from '@/server/queries/classroom';
import { getStudentGroup } from '@/server/queries/group';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';

interface Props {
  params: Promise<{ classroomId: string }>;
}

export default async function StudentClassroomPage({ params }: Props) {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const { classroomId } = await params;

  // Verify student is a classroom member
  const classroom = await getClassroomById(classroomId, userId);
  if (!classroom) {
    redirect('/student');
  }

  // Check if student has a group
  const group = await getStudentGroup(classroomId, userId);

  if (group) {
    // Per D-21: redirect directly to the student's group page
    redirect(`/student/classroom/${classroomId}/group/${group.id}`);
  }

  // No group: show waiting state
  return (
    <>
      <CocoonHeader variant="home" />
      <div className="px-[33px] pt-4 lg:px-0 lg:pt-[26px]">
        <h1 className="text-[20px] leading-normal font-bold text-cocoon-blue lg:text-[30px]">{classroom.name}</h1>
        <div className="mt-4 space-y-1 rounded-[12px] border border-cocoon-line bg-white p-6 lg:mx-auto lg:mt-8 lg:max-w-[560px] lg:rounded-[16px] lg:border-[#f1ece5] lg:p-10 text-center">
          <p className="text-[16px] leading-normal font-bold text-cocoon-ink">รอจัดกลุ่ม</p>
          <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
            ครูจะจัดกลุ่มให้คุณเร็ว ๆ นี้ กรุณารอสักครู่
          </p>
        </div>
      </div>
    </>
  );
}
