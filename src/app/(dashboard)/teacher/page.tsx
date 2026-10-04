import Link from 'next/link';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from 'cn';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getTeacherClassrooms } from '@/server/queries/classroom';
import { ClassroomCard } from '@/components/classroom/classroom-card';
import { Button } from '@/components/ui/button';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_PRIMARY, EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';

function NewClassroomButton({ className }: { className?: string }) {
  return (
    <Button render={<Link href="/teacher/classroom/new" />} nativeButton={false} className={cn(BTN_PRIMARY, className)}>
      <Plus className="size-4" />
      สร้างห้องเรียน
    </Button>
  );
}

export default async function TeacherDashboard() {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const all = await getTeacherClassrooms(userId);
  const classrooms = all.filter((c) => !c.isArchived);
  const archived = all.filter((c) => c.isArchived);

  return (
    <>
      <CocoonHeader variant="home" />
      <PageHeader
        title="ทีมของฉัน"
        subtitle="ห้องเรียนทั้งหมดของคุณ"
        actions={classrooms.length > 0 ? <NewClassroomButton /> : undefined}
      />

      <div className={PAGE_BODY}>
        {classrooms.length === 0 ? (
          <div className={EMPTY_CARD}>
            <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีห้องเรียน</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">สร้างห้องเรียนแรกของคุณเพื่อเริ่มต้น</p>
            <NewClassroomButton />
          </div>
        ) : (
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
