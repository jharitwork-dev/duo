import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getGroupById } from '@/server/queries/group';
import { getActivePhases } from '@/server/queries/phase';
import { PhaseList } from '@/components/phase/phase-list';

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

  const phases = await getActivePhases(groupId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <span>ห้องเรียน</span>
        <span className="mx-1">/</span>
        <span>{group.name}</span>
      </nav>

      <h1 className="text-2xl font-bold">{group.name}</h1>

      {phases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            ยังไม่มี Phase — เพิ่ม Phase แรกหรือเลือกจากเทมเพลต
          </p>
        </div>
      ) : null}

      <PhaseList initialPhases={phases} groupId={groupId} />
    </div>
  );
}
