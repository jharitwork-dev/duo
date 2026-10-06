import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cn } from 'cn';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_INFO, EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';
import { getCurrentUserId, getCurrentRole } from '@/lib/auth';
import { getGroupById } from '@/server/queries/group';
import { getClassroomGroupMode } from '@/server/queries/classroom';
import { StudentGroupActions } from '@/components/group/student-group-actions';
import { getActivePhases } from '@/server/queries/phase';
import { getTodoSubmissionSummaries } from '@/server/queries/submission';
import { buildNodeDeadlines } from '@/lib/node-deadline';
import { getUnreadTeacherCommentTodoIds } from '@/server/queries/comment';
import { GroupPhaseView } from '@/components/student/group-phase-view';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { ResponsibleTeachersLabel } from '@/components/group/responsible-teachers';
import { getGroupTeachersByClassroom } from '@/server/queries/group-teachers';
import type { ResponsibleTeacher } from '@/lib/group-teachers';
import { PhaseStepper } from '@/components/student/phase-stepper';
import { NodePath } from '@/components/student/node-path';
import { NodePathDesktop } from '@/components/student/node-path-desktop';
import {
  buildNodeRows,
  computeLockedTodoIds,
  isPhasePreview,
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
  // Locked phase opened from the stepper: read-only preview (261004-iyj). Every node renders locked
  // (computeLockedTodoIds) — no links, no comment dots; work/submit/comment gates are unchanged.
  const isPreview = selected ? isPhasePreview(selected) : false;

  const todos = selected?.todos ?? [];
  const [summaries, unreadTodoIds] = selected
    ? await Promise.all([
        getTodoSubmissionSummaries(groupId, userId, todos),
        // The dot is decorative: never let it break the home page.
        isPreview
          ? Promise.resolve([] as string[])
          : getUnreadTeacherCommentTodoIds(groupId, userId, todos).catch(() => [] as string[]),
      ])
    : [{}, [] as string[]];
  const statuses = Object.fromEntries(Object.entries(summaries).map(([id, s]) => [id, s.status]));
  // Deadline line per node (261004-03i): lateness from the first submission, server clock.
  const deadlines = buildNodeDeadlines(todos, selected, summaries, new Date());
  const rows = buildNodeRows(todos);
  const locked = selected ? computeLockedTodoIds(selected, rows, statuses) : new Set<string>();
  const currentId = pickCurrentTodoId(rows, locked, statuses);
  // Self-grouping classrooms: students may leave (and the self_create creator may delete) their group.
  const groupMode = await getClassroomGroupMode(group.classroomId);
  // "ครูที่ดูแล" (261006-ij6): publicName only; decorative, never break the home page.
  const groupTeachers = await getGroupTeachersByClassroom(group.classroomId).catch(
    () => ({}) as Record<string, ResponsibleTeacher[]>,
  );

  return (
    <>
      <CocoonHeader variant="home" />
      <PhaseStepper phases={phases} selectedId={selectedId} />

      <h1 className="mt-[27px] px-[33px] text-[20px] leading-normal font-bold text-cocoon-blue lg:mt-[22px] lg:px-0 lg:text-[28px]">
        งานของฉัน
      </h1>
      <ResponsibleTeachersLabel teachers={groupTeachers[group.id] ?? []} className="mx-[33px] mt-2 lg:mx-0" />

      {isPreview && (
        <p
          role="status"
          className="mx-[33px] mt-3 rounded-[12px] border border-cocoon-line bg-black/5 px-4 py-2.5 text-[14px] leading-normal font-bold text-cocoon-muted lg:mx-0"
        >
          Phase นี้ยังไม่ปลดล็อค · ดูล่วงหน้าได้ แต่ยังส่งงานไม่ได้
        </p>
      )}

      {phases.length === 0 ? (
        <EmptyCard title="ยังไม่มีเนื้อหาในกลุ่มนี้" description="ครูจะเพิ่มเนื้อหาให้เร็ว ๆ นี้" />
      ) : todos.length === 0 ? (
        <EmptyCard
          title={selected?.name ?? 'Phase นี้'}
          description="ยังไม่มีงานใน Phase นี้ ครูจะเพิ่มให้เร็ว ๆ นี้"
        />
      ) : (
        <>
          <NodePath
            rows={rows}
            statuses={statuses}
            locked={locked}
            currentId={currentId}
            unreadTodoIds={unreadTodoIds}
            deadlines={deadlines}
          />
          <NodePathDesktop
            rows={rows}
            statuses={statuses}
            locked={locked}
            currentId={currentId}
            unreadTodoIds={unreadTodoIds}
            deadlines={deadlines}
          />
        </>
      )}

      {groupMode && groupMode !== 'teacher' && (
        <StudentGroupActions
          classroomId={group.classroomId}
          groupId={group.id}
          groupName={group.name}
          canDelete={groupMode === 'self_create' && group.createdBy === userId}
        />
      )}
    </>
  );
}
