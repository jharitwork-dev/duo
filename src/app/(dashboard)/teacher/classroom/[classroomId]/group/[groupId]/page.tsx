import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getGroupById } from '@/server/queries/group';
import { getActivePhases } from '@/server/queries/phase';
import { getClassroomById } from '@/server/queries/classroom';
import { PhaseList } from '@/components/phase/phase-list';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';

export default async function GroupPage({
  params,
}: {
  params: Promise<{ classroomId: string; groupId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { classroomId, groupId } = await params;

  const group = await getGroupById(groupId, userId);
  if (!group) redirect(`/teacher/classroom/${classroomId}`);

  const [phases, classroom] = await Promise.all([
    getActivePhases(groupId),
    getClassroomById(classroomId, userId),
  ]);
  const classroomHref = `/teacher/classroom/${classroomId}`;

  return (
    <>
      <CocoonHeader variant="back" backHref={classroomHref} />
      <PageHeader
        backHref={classroomHref}
        backLabel={classroom?.name ?? 'ห้องเรียน'}
        title={group.name}
        subtitle="จัดการ Phase และงานของกลุ่ม"
      />

      <div className={`${PAGE_BODY} space-y-4 lg:space-y-5`}>
        {phases.length === 0 && (
          <div className={EMPTY_CARD}>
            <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มี Phase</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
              เพิ่ม Phase แรกด้านล่าง หรือเลือกจากเทมเพลตในหน้ากลุ่ม
            </p>
          </div>
        )}

        <PhaseList initialPhases={phases} classroomId={classroomId} groupId={groupId} />
      </div>
    </>
  );
}
