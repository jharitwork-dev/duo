import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getTeacherDeadlineTimeline } from '@/server/queries/deadline';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { EMPTY_CARD, PAGE_BODY } from '@/components/cocoon/ui';
import { DeadlineTimeline } from '@/components/dashboard/deadline-timeline';

/** Cross-classroom deadline timeline (261004-03i). */
export default async function TeacherDeadlinesPage() {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const timeline = await getTeacherDeadlineTimeline(userId);
  const now = new Date();
  const empty =
    timeline.overdue.length + timeline.today.length + timeline.next7.length + timeline.later.length === 0;

  return (
    <>
      <CocoonHeader variant="home" />
      <PageHeader title="กำหนดส่ง" subtitle="กำหนดส่งงานทุกห้องเรียน และจำนวนกลุ่มที่ส่งแล้ว" />
      <div className={PAGE_BODY}>
        {empty ? (
          <div className={EMPTY_CARD}>
            <p className="text-[18px] leading-normal font-bold text-cocoon-ink">ยังไม่มีงานที่มีกำหนดส่ง</p>
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">
              ตั้งกำหนดส่งได้ที่ Phase หรือที่งานแต่ละชิ้นในหน้ากลุ่ม
            </p>
          </div>
        ) : (
          <DeadlineTimeline timeline={timeline} now={now} />
        )}
      </div>
    </>
  );
}
