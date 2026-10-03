import { notFound } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getClassroomById } from '@/server/queries/classroom';
import { getArchivedPhases, getClassroomPhases } from '@/server/queries/phase';
import { getTemplates } from '@/server/queries/template';
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

interface ClassroomDashboardProps {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}

export default async function ClassroomDashboard({ params, searchParams }: ClassroomDashboardProps) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const { classroomId } = await params;
  const { tab } = await searchParams;
  const defaultTab = tab === 'phases' ? 'phases' : tab === 'settings' ? 'settings' : 'groups';

  const [classroom, phases, archivedPhases, templates] = await Promise.all([
    getClassroomById(classroomId, userId),
    getClassroomPhases(classroomId),
    getArchivedPhases(classroomId),
    getTemplates(userId),
  ]);
  if (!classroom) {
    notFound();
  }

  const groups = classroom.groups;
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <CocoonHeader variant="back" backHref="/teacher" />
      <Tabs defaultValue={defaultTab} className="gap-0">
        <PageHeader
          backHref="/teacher"
          backLabel="ทีมของฉัน"
          title={classroom.name}
          subtitle={classroom.description || undefined}
          actions={
            <TabsList className={SEGMENT_LIST}>
              <TabsTrigger value="groups" className={SEGMENT_TRIGGER}>
                กลุ่ม
              </TabsTrigger>
              <TabsTrigger value="phases" className={SEGMENT_TRIGGER}>
                Phase
              </TabsTrigger>
              <TabsTrigger value="settings" className={SEGMENT_TRIGGER}>
                ตั้งค่า
              </TabsTrigger>
            </TabsList>
          }
          className="[&>div>div:last-child]:w-full lg:[&>div>div:last-child]:w-auto"
        />

        <TabsContent value="groups" className={PAGE_BODY}>
          <div className="mb-4 flex items-center justify-between gap-3 lg:mb-6">
            <h2 className="text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]">
              กลุ่มทั้งหมด ({groups.length})
            </h2>
            {groups.length > 0 && <CreateGroupForm classroomId={classroomId} />}
          </div>

          {groups.length === 0 ? (
            <div className={EMPTY_CARD}>
              <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีกลุ่ม</p>
              <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
                สร้างกลุ่มแรกในห้องเรียนนี้
              </p>
              <CreateGroupForm classroomId={classroomId} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:gap-8 xl:grid-cols-3">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  id={group.id}
                  name={group.name}
                  memberCount={group.memberCount}
                  maxGroupSize={classroom.maxGroupSize}
                  classroomId={classroomId}
                  classroomMembers={classroom.members}
                  members={group.members}
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
              members={classroom.members}
            />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
