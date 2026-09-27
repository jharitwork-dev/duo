import { redirect } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getStudentClassrooms } from '@/server/queries/classroom';
import { getStudentGroup } from '@/server/queries/group';
import { ClassroomCards } from '@/components/student/classroom-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JoinCodeInput } from '@/components/student/join-code-input';

export default async function StudentDashboard() {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();

  const classrooms = await getStudentClassrooms(userId);

  // 0 classrooms: show empty state with join input
  if (classrooms.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-6 pt-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">
              ยังไม่ได้เข้าร่วมห้องเรียน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-center text-sm">
              ใส่รหัสเข้าร่วมที่ได้รับจากครูเพื่อเข้าห้องเรียน
            </p>
            <JoinCodeInput />
          </CardContent>
        </Card>
      </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ห้องเรียนของฉัน</h1>
        <p className="text-muted-foreground text-sm">
          เลือกห้องเรียนเพื่อดูโปรเจกต์ของคุณ
        </p>
      </div>
      <ClassroomCards classrooms={classrooms} />
    </div>
  );
}
