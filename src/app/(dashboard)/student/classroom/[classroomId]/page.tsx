import { redirect } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getClassroomById } from '@/server/queries/classroom';
import { getStudentGroup } from '@/server/queries/group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="mx-auto max-w-md pt-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-xl">
            {classroom.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-center">
          <p className="text-muted-foreground">
            รอจัดกลุ่ม
          </p>
          <p className="text-muted-foreground text-sm">
            ครูจะจัดกลุ่มให้คุณเร็ว ๆ นี้ กรุณารอสักครู่
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
