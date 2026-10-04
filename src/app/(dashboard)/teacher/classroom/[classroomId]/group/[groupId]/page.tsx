import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cn } from 'cn';
import { getGroupById, getGroupsByClassroom } from '@/server/queries/group';
import { getActivePhases } from '@/server/queries/phase';
import { getClassroomById } from '@/server/queries/classroom';
import { GroupPhaseBoard } from '@/components/phase/group-phase-board';
import { EditGroupDialog } from '@/components/group/edit-group-dialog';
import { DeleteGroupButton } from '@/components/group/delete-group-button';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_INFO, EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';

export default async function GroupPage({
  params,
}: {
  params: Promise<{ classroomId: string; groupId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { classroomId, groupId } = await params;

  const group = await getGroupById(groupId, userId);
  if (!group || group.classroomId !== classroomId) redirect(`/teacher/classroom/${classroomId}`);

  const [phases, classroom, classroomGroups] = await Promise.all([
    getActivePhases(groupId),
    getClassroomById(classroomId, userId),
    getGroupsByClassroom(classroomId),
  ]);
  const classroomHref = `/teacher/classroom/${classroomId}`;
  const managePhasesHref = `${classroomHref}?tab=phases`;
  const groupOptions = [...classroomGroups]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <CocoonHeader variant="back" backHref={classroomHref} />
      <PageHeader
        backHref={classroomHref}
        backLabel={classroom?.name ?? 'ห้องเรียน'}
        title={group.name}
        subtitle="Phase ของห้องเรียน · งานของกลุ่มนี้"
        actions={
          <>
            <EditGroupDialog
              groupId={group.id}
              name={group.name}
              maxMembers={group.maxMembers}
              memberCount={group.members.length}
              classroomMaxGroupSize={classroom?.maxGroupSize ?? null}
            />
            <DeleteGroupButton
              groupId={group.id}
              groupName={group.name}
              redirectHref={`${classroomHref}?tab=students`}
            />
            <Link href={managePhasesHref} className={cn(BTN_INFO, 'inline-flex h-10 items-center text-[14px]')}>
              จัดการ Phase
            </Link>
          </>
        }
      />

      <div className={`${PAGE_BODY} space-y-4 lg:space-y-5`}>
        {phases.length === 0 ? (
          <div className={EMPTY_CARD}>
            <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ห้องเรียนนี้ยังไม่มี Phase</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
              สร้าง Phase หรือเลือกเทมเพลตได้ที่แท็บ Phase ของห้องเรียน
            </p>
            <Link href={managePhasesHref} className={cn(BTN_INFO, 'inline-flex items-center')}>
              จัดการ Phase
            </Link>
          </div>
        ) : (
          <GroupPhaseBoard groupId={groupId} phases={phases} groups={groupOptions} />
        )}
      </div>
    </>
  );
}
