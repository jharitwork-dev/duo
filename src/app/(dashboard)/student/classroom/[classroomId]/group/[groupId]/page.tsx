import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cn } from 'cn';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_INFO, EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';
import { getCurrentUserId, getCurrentRole } from '@/lib/auth';
import { getGroupById } from '@/server/queries/group';
import { getActivePhases } from '@/server/queries/phase';
import { getTodoSubmissionStatuses } from '@/server/queries/submission';
import { GroupPhaseView } from '@/components/student/group-phase-view';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PhaseStepper } from '@/components/student/phase-stepper';
import { NodePath } from '@/components/student/node-path';
import { NodePathDesktop } from '@/components/student/node-path-desktop';
import {
  buildNodeRows,
  computeLockedTodoIds,
  pickCurrentTodoId,
  pickDefaultPhaseId,
} from '@/lib/node-path';

interface Props {
  params: Promise<{ classroomId: string; groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-[33px] mt-4 rounded-[12px] border border-cocoon-line bg-white p-6 text-center lg:mx-0 lg:mt-8 lg:rounded-[16px] lg:border-[#f1ece5] lg:p-10">
      <p className="text-[16px] leading-normal font-bold text-cocoon-ink">{title}</p>
      <p className="mt-1 text-[14px] leading-normal font-medium text-cocoon-muted">{description}</p>
    </div>
  );
}

export default async function StudentGroupPage({ params, searchParams }: Props) {
  const role = await getCurrentRole();
  // Allow both students and teachers to view this page
  if (!role || !['student', 'teacher', 'superadmin'].includes(role)) {
    redirect('/');
  }

  const userId = await getCurrentUserId();
  const { groupId } = await params;

  // Verify user has access to this group (via classroom membership)
  const group = await getGroupById(groupId, userId);
  if (!group) {
    redirect('/student');
  }

  // Fetch phases with todos
  const phases = await getActivePhases(groupId);

  const isTeacher = role === 'teacher' || role === 'superadmin';

  if (isTeacher) {
    // Empty state: phases are managed once per classroom (Phase tab)
    const { classroomId } = await params;
    const editorHref = `/teacher/classroom/${classroomId}/group/${groupId}`;
    const classroomHref = `/teacher/classroom/${classroomId}`;

    if (phases.length === 0) {
      return (
        <>
          <CocoonHeader variant="back" backHref={classroomHref} />
          <PageHeader
            backHref={classroomHref}
            backLabel="ห้องเรียน"
            title={group.name}
            subtitle="ภาพรวม Phase และงานของกลุ่ม"
          />
          <div className={PAGE_BODY}>
            <div className={EMPTY_CARD}>
              <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ห้องเรียนนี้ยังไม่มี Phase</p>
              <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
                สร้าง Phase หรือเลือกเทมเพลตได้ที่แท็บ Phase ของห้องเรียน
              </p>
              <Link href={`${classroomHref}?tab=phases`} className={cn(BTN_INFO, 'inline-flex items-center')}>
                จัดการ Phase
              </Link>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <CocoonHeader variant="back" backHref={classroomHref} />
        <PageHeader
          backHref={classroomHref}
          backLabel="ห้องเรียน"
          title={group.name}
          subtitle="ภาพรวม Phase และงานของกลุ่ม"
          actions={
            <Link href={editorHref} className={cn(BTN_INFO, 'inline-flex items-center')}>
              จัดการ Phase
            </Link>
          }
        />
        <div className={PAGE_BODY}>
          <GroupPhaseView phases={phases} />
        </div>
      </>
    );
  }

  // ---- Student: Cocoon node-path home ----
  // Students may only open their own group's path.
  if (!group.members.some((m) => m.userId === userId)) {
    redirect('/student');
  }

  const { phase: requested } = await searchParams;
  const selectedId = pickDefaultPhaseId(
    phases,
    typeof requested === 'string' ? requested : undefined,
  );
  const selected = phases.find((p) => p.id === selectedId) ?? null;

  const todos = selected?.todos ?? [];
  const statuses = selected ? await getTodoSubmissionStatuses(groupId, userId, todos) : {};
  const rows = buildNodeRows(todos);
  const locked = selected ? computeLockedTodoIds(selected, rows, statuses) : new Set<string>();
  const currentId = pickCurrentTodoId(rows, locked, statuses);

  return (
    <>
      <CocoonHeader variant="home" />
      <PhaseStepper phases={phases} selectedId={selectedId} />

      <h1 className="mt-[27px] px-[33px] text-[20px] leading-normal font-bold text-cocoon-blue lg:mt-[22px] lg:px-0 lg:text-[28px]">
        งานของฉัน
      </h1>

      {phases.length === 0 ? (
        <EmptyCard title="ยังไม่มีเนื้อหาในกลุ่มนี้" description="ครูจะเพิ่มเนื้อหาให้เร็ว ๆ นี้" />
      ) : todos.length === 0 ? (
        <EmptyCard
          title={selected?.name ?? 'Phase นี้'}
          description="ยังไม่มีงานใน Phase นี้ ครูจะเพิ่มให้เร็ว ๆ นี้"
        />
      ) : (
        <>
          <NodePath rows={rows} statuses={statuses} locked={locked} currentId={currentId} />
          <NodePathDesktop rows={rows} statuses={statuses} locked={locked} currentId={currentId} />
        </>
      )}
    </>
  );
}
