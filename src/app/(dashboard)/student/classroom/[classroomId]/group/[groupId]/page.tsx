import { redirect } from 'next/navigation';
import { requireRole, getCurrentUserId, getCurrentRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getGroupById } from '@/server/queries/group';
import { getActivePhases } from '@/server/queries/phase';
import { getTemplates } from '@/server/queries/template';
import { GroupPhaseView } from '@/components/student/group-phase-view';
import { TemplatePicker } from '@/components/template/template-picker';

interface Props {
  params: Promise<{ classroomId: string; groupId: string }>;
}

export default async function StudentGroupPage({ params }: Props) {
  const role = await getCurrentRole();
  // Allow both students and teachers to view this page
  if (!role || !['student', 'teacher', 'superadmin'].includes(role)) {
    redirect('/');
  }

  const userId = await getCurrentUserId();
  const { classroomId, groupId } = await params;

  // Verify user has access to this group (via classroom membership)
  const group = await getGroupById(groupId, userId);
  if (!group) {
    redirect('/student');
  }

  // Fetch phases with todos
  const phases = await getActivePhases(groupId);

  const isTeacher = role === 'teacher' || role === 'superadmin';

  // Empty state: show template picker for teachers
  if (phases.length === 0 && isTeacher) {
    const templates = await getTemplates(userId);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground text-sm">
            กลุ่มนี้ยังไม่มีเนื้อหา เลือก Template เพื่อเริ่มต้น
          </p>
        </div>
        <TemplatePicker groupId={groupId} templates={templates} />
      </div>
    );
  }

  // Empty state for students
  if (phases.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
        </div>
        <div className="text-muted-foreground py-12 text-center">
          <p>ยังไม่มีเนื้อหาในกลุ่มนี้</p>
          <p className="text-sm">ครูจะเพิ่มเนื้อหาให้เร็ว ๆ นี้</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{group.name}</h1>
      </div>
      <GroupPhaseView phases={phases} />
    </div>
  );
}
