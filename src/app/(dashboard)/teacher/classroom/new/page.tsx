import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CreateClassroomForm } from '@/components/classroom/create-classroom-form';

export default async function NewClassroomPage() {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สร้างห้องเรียนใหม่</h1>
      <CreateClassroomForm />
    </div>
  );
}
