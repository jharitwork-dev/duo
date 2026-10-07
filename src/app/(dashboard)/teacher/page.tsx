import Link from 'next/link';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { cn } from 'cn';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getTeacherClassrooms } from '@/server/queries/classroom';
import { getTeacherDashboard } from '@/server/queries/deadline';
import { DashboardSummaryChips } from '@/components/dashboard/dashboard-summary-chips';
import { GroupStatusCard } from '@/components/dashboard/group-status-card';
import { ClassroomCard } from '@/components/classroom/classroom-card';
import { Button } from '@/components/ui/button';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_PRIMARY, EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';
import { MineFilterToggle } from '@/components/group/mine-filter-toggle';

function NewClassroomButton({ className }: { className?: string }) {
  return (
    <Button render={<Link href="/teacher/classroom/new" />} nativeButton={false} className={cn(BTN_PRIMARY, className)}>
      <Plus className="size-4" />
      สร้างห้องเรียน
    </Button>
  );
}

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TeacherDashboard({ searchParams }: Props) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  // "กลุ่มที่ฉันดูแล" filter (quick task 261008-0y9): ?mine=1 restricts sections + chips to my groups.
  const mine = first((await searchParams).mine) === '1';
  const [all, overview] = await Promise.all([getTeacherClassrooms(userId), getTeacherDashboard(userId, { mine })]);
  const classrooms = all.filter((c) => !c.isArchived);
  const archived = all.filter((c) => c.isArchived);
  const now = new Date();
  const sections = mine ? overview.classrooms.filter((e) => e.dashboard.groups.length > 0) : overview.classrooms;

  return (
    <>
      <CocoonHeader variant="home" />
      <PageHeader
        title="ภาพรวม"
        subtitle={mine ? 'สถานะงานของกลุ่มที่คุณดูแล' : 'สถานะงานทุกกลุ่มในห้องเรียนของคุณ'}
        actions={
          classrooms.length > 0 ? (
            <>
              <MineFilterToggle href={mine ? '/teacher' : '/teacher?mine=1'} active={mine} />
              <NewClassroomButton />
            </>
          ) : undefined
        }
      />

      <div className={PAGE_BODY}>
        {classrooms.length === 0 ? (
          <div className={EMPTY_CARD}>
            <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีห้องเรียน</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">สร้างห้องเรียนแรกของคุณเพื่อเริ่มต้น</p>
            <NewClassroomButton />
          </div>
        ) : (
          <div className="space-y-8 lg:space-y-12">
            <DashboardSummaryChips counts={overview.counts} />

            {mine && sections.length === 0 && (
              <div className={EMPTY_CARD}>
                <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
                  คุณยังไม่ได้ดูแลกลุ่มใด — ตั้งค่าได้ที่หน้ากลุ่มในแต่ละห้องเรียน
                </p>
              </div>
            )}

            {sections.map(({ classroom, dashboard }) => {
              const overviewHref = `/teacher/classroom/${classroom.id}?tab=overview${mine ? '&mine=1' : ''}`;
              return (
                <section key={classroom.id} aria-labelledby={`dash-${classroom.id}`} className="space-y-3 lg:space-y-4">
                  <h2 id={`dash-${classroom.id}`} className="text-[20px] leading-normal font-bold text-cocoon-blue lg:text-[22px]">
                    <Link href={overviewHref} className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40">
                      {classroom.name}
                    </Link>
                  </h2>
                  {dashboard.groups.length === 0 ? (
                    <p className="text-[14px] font-medium text-cocoon-muted">ห้องเรียนนี้ยังไม่มีกลุ่ม</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-3">
                      {dashboard.groups.map((group) => (
                        <GroupStatusCard
                          key={group.id}
                          classroomId={classroom.id}
                          group={group}
                          members={overview.members}
                          now={now}
                        />
                      ))}
                    </div>
                  )}
                  <Link
                    href={overviewHref}
                    className="inline-flex items-center gap-1 rounded-sm text-[14px] font-bold text-cocoon-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
                  >
                    ดูภาพรวมทั้งหมด
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </section>
              );
            })}

            <section aria-labelledby="all-classrooms" className="space-y-3 lg:space-y-4">
              <h2 id="all-classrooms" className="text-[20px] leading-normal font-bold text-cocoon-ink lg:text-[22px]">
                ห้องเรียนทั้งหมด
              </h2>
              <div className="grid gap-4 lg:grid-cols-2 lg:gap-8">
                {classrooms.map((classroom) => (
                  <ClassroomCard
                    key={classroom.id}
                    id={classroom.id}
                    name={classroom.name}
                    description={classroom.description}
                    memberCount={classroom.memberCount}
                    groupCount={classroom.groupCount}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {archived.length > 0 && (
          <details className="group mt-6 lg:mt-10">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-[15px] font-bold text-cocoon-muted outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 [&::-webkit-details-marker]:hidden">
              ห้องเรียนที่เก็บไว้ ({archived.length})
              <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-8">
              {archived.map((classroom) => (
                <ClassroomCard
                  key={classroom.id}
                  id={classroom.id}
                  name={classroom.name}
                  description={classroom.description}
                  memberCount={classroom.memberCount}
                  groupCount={classroom.groupCount}
                  isArchived
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
