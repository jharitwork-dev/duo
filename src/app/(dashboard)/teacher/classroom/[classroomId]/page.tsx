import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from 'cn';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getClassroomById } from '@/server/queries/classroom';
import { getArchivedPhases, getClassroomPhases } from '@/server/queries/phase';
import { getTemplates } from '@/server/queries/template';
import { getClassroomTasksByPhase } from '@/server/queries/classroom-task';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupCard } from '@/components/group/group-card';
import { CreateGroupForm } from '@/components/group/create-group-form';
import { InviteCodeDisplay } from '@/components/classroom/invite-code-display';
import { ClassroomSettingsForm } from '@/components/classroom/classroom-settings-form';
import { PhaseList } from '@/components/phase/phase-list';
import { ArchivedPhaseList } from '@/components/phase/archived-phase-list';
import { InlineAddPhase } from '@/components/phase/inline-add-phase';
import { TemplatePicker } from '@/components/template/template-picker';
import { SaveTemplateDialog } from '@/components/template/save-template-dialog';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { EMPTY_CARD, PAGE_BODY, SEGMENT_LIST, SEGMENT_TRIGGER } from '@/components/cocoon/ui';
import { StudentRoster } from '@/components/classroom/student-roster';
import { ClassroomDangerZone } from '@/components/classroom/classroom-danger-zone';
import { ClassroomTeachers, type ClassroomTeacherRow } from '@/components/classroom/classroom-teachers';
import { canManageClassroomTeachers } from '@/lib/classroom-teachers';
import { listApprovedTeachers } from '@/lib/user-directory';
import { effectiveGroupLimit } from '@/lib/group-rules';
import { getClassroomDashboard } from '@/server/queries/deadline';
import { GroupStatusCard } from '@/components/dashboard/group-status-card';
import { ClassroomMatrix } from '@/components/dashboard/classroom-matrix';

const TABS = ['overview', 'students', 'groups', 'phases', 'settings'] as const;
type TabValue = (typeof TABS)[number];
// Five segments: tighter padding on mobile so they fit the full-width pill at 360px.
const TAB_TRIGGER = cn(SEGMENT_TRIGGER, 'px-1.5 text-[14px] lg:px-6 lg:text-[16px]');

interface ClassroomDashboardProps {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}

export default async function ClassroomDashboard({ params, searchParams }: ClassroomDashboardProps) {
  const role = await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const { classroomId } = await params;
  const { tab } = await searchParams;

  const [classroom, phases, archivedPhases, templates, overview, classroomTasks] = await Promise.all([
    getClassroomById(classroomId, userId, { allowAnyClassroom: role === ROLES.SUPERADMIN }),
    getClassroomPhases(classroomId),
    getArchivedPhases(classroomId),
    getTemplates(userId),
    // Informational: a dashboard failure must not break the classroom editor.
    getClassroomDashboard(classroomId, userId).catch(() => null),
    // Only rendered after getClassroomById authorized the caller (notFound below otherwise).
    getClassroomTasksByPhase(classroomId),
  ]);
  if (!classroom) {
    notFound();
  }

  const groups = classroom.groups;

  // "ครูประจำห้อง": owner first (even if a legacy classroom has no owner member row), then by name.
  const canManageTeachers = canManageClassroomTeachers({ role, userId, createdBy: classroom.createdBy });
  const teacherRows: ClassroomTeacherRow[] = classroom.members
    .filter((m) => m.role === 'teacher')
    .map((m) => ({ userId: m.userId, name: m.name, email: m.email, imageUrl: m.imageUrl, isOwner: m.userId === classroom.createdBy }));
  if (!teacherRows.some((t) => t.isOwner)) {
    const { owner } = classroom;
    teacherRows.push({ userId: owner.userId, name: owner.name, email: owner.email, imageUrl: owner.imageUrl, isOwner: true });
  }
  teacherRows.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name, 'th'));
  const memberIds = new Set(classroom.members.map((m) => m.userId));
  const availableTeachers = canManageTeachers
    ? (await listApprovedTeachers().catch(() => [])).filter((t) => !memberIds.has(t.userId) && t.userId !== classroom.createdBy)
    : [];
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  const students = classroom.members.filter((m) => m.role === 'student');
  const assignedUserIds = [...new Set(groups.flatMap((g) => g.members.map((m) => m.userId)))];
  const assignedSet = new Set(assignedUserIds);
  const hasUnassigned = students.some((s) => !assignedSet.has(s.userId));

  // Explicit ?tab= wins; otherwise open on the overview (unassigned students get a notice there).
  const requestedTab = typeof tab === 'string' && TABS.includes(tab as TabValue) ? (tab as TabValue) : null;
  const defaultTab: TabValue = requestedTab ?? 'overview';
  const unassignedCount = students.filter((s) => !assignedSet.has(s.userId)).length;
  const groupCardById = new Map((overview?.dashboard.groups ?? []).map((g) => [g.id, g]));
  const now = new Date();

  const rosterGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    limit: effectiveGroupLimit(g.maxMembers, classroom.maxGroupSize),
    memberIds: g.members.map((m) => m.userId),
  }));
  const rosterKey = rosterGroups.map((g) => `${g.id}:${g.limit}:${g.memberIds.join(',')}`).join('|') +
    `#${students.map((s) => s.userId).join(',')}`;

  return (
    <>
      <CocoonHeader variant="back" backHref="/teacher" />
      {/* Remount only when ?tab= changes (e.g. redirect to the roster) — not when hasUnassigned flips. */}
      <Tabs key={requestedTab ?? 'auto'} defaultValue={defaultTab} className="gap-0">
        <PageHeader
          backHref="/teacher"
          backLabel="ภาพรวม"
          title={classroom.name}
          subtitle={classroom.description || undefined}
          actions={
            <TabsList className={cn(SEGMENT_LIST, 'overflow-x-auto')}>
              <TabsTrigger value="overview" className={TAB_TRIGGER}>
                ภาพรวม
              </TabsTrigger>
              <TabsTrigger value="students" className={TAB_TRIGGER}>
                นักเรียน
              </TabsTrigger>
              <TabsTrigger value="groups" className={TAB_TRIGGER}>
                กลุ่ม
              </TabsTrigger>
              <TabsTrigger value="phases" className={TAB_TRIGGER}>
                Phase
              </TabsTrigger>
              <TabsTrigger value="settings" className={TAB_TRIGGER}>
                ตั้งค่า
              </TabsTrigger>
            </TabsList>
          }
          className="[&>div>div:last-child]:w-full lg:[&>div>div:last-child]:w-auto"
        />

        <TabsContent value="overview" className={cn(PAGE_BODY, 'space-y-6 lg:space-y-8')}>
          {hasUnassigned && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#a86a00]/25 bg-[rgba(250,168,25,.12)] px-4 py-3 text-[14px] font-bold text-[#a86a00]"
            >
              <span>มีนักเรียน {unassignedCount} คนยังไม่มีกลุ่ม</span>
              <Link href={`/teacher/classroom/${classroomId}?tab=students`} className="underline-offset-2 hover:underline">
                จัดกลุ่ม
              </Link>
            </div>
          )}
          {!overview ? (
            <div className={EMPTY_CARD}>
              <p className="text-[14px] leading-normal font-medium text-cocoon-muted">โหลดภาพรวมไม่สำเร็จ ลองรีเฟรชหน้า</p>
            </div>
          ) : overview.dashboard.groups.length === 0 ? (
            <div className={EMPTY_CARD}>
              <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีกลุ่ม</p>
              <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
                สร้างกลุ่มที่แท็บ “กลุ่ม” แล้วสถานะงานของแต่ละกลุ่มจะแสดงที่นี่
              </p>
            </div>
          ) : (
            <>
              <section aria-label="สถานะกลุ่ม" className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-3">
                {overview.dashboard.groups.map((group) => (
                  <GroupStatusCard
                    key={group.id}
                    classroomId={classroomId}
                    group={group}
                    members={overview.members}
                    now={now}
                  />
                ))}
              </section>
              <ClassroomMatrix
                dashboard={{
                  phases: overview.dashboard.phases,
                  groups: overview.dashboard.groups,
                  rows: overview.dashboard.rows,
                }}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="students" className={PAGE_BODY}>
          <StudentRoster
            key={rosterKey}
            classroomId={classroomId}
            students={students.map((s) => ({ userId: s.userId, name: s.name, email: s.email, imageUrl: s.imageUrl }))}
            groups={rosterGroups}
          />
        </TabsContent>

        <TabsContent value="groups" className={PAGE_BODY}>
          <div className="mb-4 flex items-center justify-between gap-3 lg:mb-6">
            <h2 className="text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]">
              กลุ่มทั้งหมด ({groups.length})
            </h2>
            {groups.length > 0 && (
              <CreateGroupForm classroomId={classroomId} classroomMaxGroupSize={classroom.maxGroupSize} />
            )}
          </div>

          {groups.length === 0 ? (
            <div className={EMPTY_CARD}>
              <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีกลุ่ม</p>
              <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
                สร้างกลุ่มแรกในห้องเรียนนี้
              </p>
              <CreateGroupForm classroomId={classroomId} classroomMaxGroupSize={classroom.maxGroupSize} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:gap-8 xl:grid-cols-3">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  id={group.id}
                  name={group.name}
                  memberCount={group.memberCount}
                  maxMembers={group.maxMembers}
                  classroomMaxGroupSize={classroom.maxGroupSize}
                  classroomId={classroomId}
                  classroomMembers={classroom.members}
                  assignedUserIds={assignedUserIds}
                  members={group.members}
                  pendingCount={groupCardById.get(group.id)?.pendingCount}
                  overdueCount={groupCardById.get(group.id)?.overdueCount}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="phases" className={PAGE_BODY}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
            <h2 className="text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]">
              Phase ของห้องเรียน ({phases.length})
            </h2>
            {phases.length > 0 && <SaveTemplateDialog classroomId={classroomId} groups={groupOptions} />}
          </div>

          {phases.length === 0 ? (
            <div className="space-y-6 lg:space-y-8">
              <div className={EMPTY_CARD}>
                <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มี Phase</p>
                <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
                  ทุกกลุ่มในห้องเรียนนี้ใช้ Phase ชุดเดียวกัน — เลือกเทมเพลตด้านล่าง หรือเพิ่ม Phase เอง
                </p>
              </div>
              <TemplatePicker classroomId={classroomId} templates={templates} groups={groupOptions} />
              <InlineAddPhase classroomId={classroomId} />
              <ArchivedPhaseList phases={archivedPhases} />
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-5">
              <PhaseList
                key={phases.map((p) => p.id).join(',')}
                classroomId={classroomId}
                initialPhases={phases}
                groups={groupOptions}
                classroomTasks={classroomTasks}
              />
              <ArchivedPhaseList phases={archivedPhases} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className={PAGE_BODY}>
          <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-8">
            {classroom.inviteCode && (
              <InviteCodeDisplay classroomId={classroomId} inviteCode={classroom.inviteCode} />
            )}
            <ClassroomSettingsForm
              classroomId={classroomId}
              name={classroom.name}
              description={classroom.description ?? ''}
              maxGroupSize={classroom.maxGroupSize}
              groupMode={classroom.groupMode}
              members={classroom.members}
            />
            <ClassroomTeachers
              classroomId={classroomId}
              teachers={teacherRows}
              canManage={canManageTeachers}
              availableTeachers={availableTeachers}
            />
            <ClassroomDangerZone
              classroomId={classroomId}
              classroomName={classroom.name}
              isArchived={classroom.isArchived}
            />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
