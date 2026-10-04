import { redirect } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getClassroomById } from '@/server/queries/classroom';
import { getStudentGroup } from '@/server/queries/group';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { HandIllustration } from '@/components/cocoon/illustrations';
import { StudentGroupPicker } from '@/components/group/student-group-picker';
import { EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';
import { effectiveGroupLimit } from '@/lib/group-rules';

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

  const groupMode = classroom.groupMode;

  return (
    <>
      <CocoonHeader variant="home" />
      <PageHeader
        title={classroom.name}
        subtitle={classroom.description || undefined}
      />
      <div className={PAGE_BODY}>
        {groupMode === 'teacher' ? (
          <div className={`${EMPTY_CARD} lg:mx-auto lg:max-w-[560px]`}>
            <HandIllustration className="h-20 w-auto" />
            <p className="text-[18px] leading-normal font-bold text-cocoon-ink">รอครูจัดกลุ่ม</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
              ครูจะเพิ่มคุณเข้ากลุ่มเร็ว ๆ นี้ — เมื่อมีกลุ่มแล้วหน้านี้จะพาไปที่งานของกลุ่ม
            </p>
          </div>
        ) : (
          <StudentGroupPicker
            classroomId={classroomId}
            groupMode={groupMode}
            groups={[...classroom.groups]
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
              .map((g) => ({
                id: g.id,
                name: g.name,
                memberCount: g.memberCount,
                limit: effectiveGroupLimit(g.maxMembers, classroom.maxGroupSize),
                // Classmates' emails never reach the client.
                members: g.members.map((m) => ({ name: m.name, imageUrl: m.imageUrl })),
              }))}
          />
        )}
      </div>
    </>
  );
}
