import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getClassroomById } from '@/server/queries/classroom';
import { getGroupsByClassroom } from '@/server/queries/group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { GroupCard } from '@/components/group/group-card';
import { CreateGroupForm } from '@/components/group/create-group-form';
import { InviteCodeDisplay } from '@/components/classroom/invite-code-display';
import { ClassroomSettingsForm } from '@/components/classroom/classroom-settings-form';
import { ChevronRight } from 'lucide-react';

interface ClassroomDashboardProps {
  params: Promise<{ classroomId: string }>;
}

export default async function ClassroomDashboard({
  params,
}: ClassroomDashboardProps) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const { classroomId } = await params;

  const classroom = await getClassroomById(classroomId, userId);
  if (!classroom) {
    notFound();
  }

  const groups = await getGroupsByClassroom(classroomId);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/teacher" className="hover:text-foreground">
          ห้องเรียน
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">{classroom.name}</span>
      </nav>

      <h1 className="text-2xl font-bold">{classroom.name}</h1>

      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups">กลุ่ม</TabsTrigger>
          <TabsTrigger value="settings">ตั้งค่า</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              กลุ่มทั้งหมด ({groups.length})
            </h2>
            <CreateGroupForm classroomId={classroomId} />
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="mb-4 text-muted-foreground">
                ยังไม่มีกลุ่ม — สร้างกลุ่มแรกในห้องเรียนนี้
              </p>
              <CreateGroupForm classroomId={classroomId} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  id={group.id}
                  name={group.name}
                  memberCount={group.memberCount}
                  maxGroupSize={classroom.maxGroupSize}
                  classroomId={classroomId}
                  classroomMembers={classroom.members}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {classroom.inviteCode && (
            <InviteCodeDisplay
              classroomId={classroomId}
              inviteCode={classroom.inviteCode}
            />
          )}
          <ClassroomSettingsForm
            classroomId={classroomId}
            name={classroom.name}
            description={classroom.description ?? ''}
            maxGroupSize={classroom.maxGroupSize}
            members={classroom.members}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
