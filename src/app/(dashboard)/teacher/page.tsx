import Link from 'next/link';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getTeacherClassrooms } from '@/server/queries/classroom';
import { ClassroomCard } from '@/components/classroom/classroom-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function TeacherDashboard() {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const classrooms = await getTeacherClassrooms(userId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ห้องเรียนของฉัน</h1>
        <Button asChild>
          <Link href="/teacher/classroom/new">
            <Plus className="mr-2 size-4" />
            สร้างห้องเรียน
          </Link>
        </Button>
      </div>

      {classrooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="mb-4 text-muted-foreground">
            ยังไม่มีห้องเรียน — สร้างห้องเรียนแรกของคุณ
          </p>
          <Button asChild>
            <Link href="/teacher/classroom/new">
              <Plus className="mr-2 size-4" />
              สร้างห้องเรียน
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((classroom) => (
            <ClassroomCard
              key={classroom.id}
              id={classroom.id}
              name={classroom.name}
              description={classroom.description}
              memberCount={classroom.memberCount}
              groupCount={classroom.groupCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
