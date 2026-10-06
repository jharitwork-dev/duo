import Link from 'next/link';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { cn } from 'cn';
import { BTN_INFO, EMPTY_CARD, PILL_CAPACITY } from '@/components/cocoon/ui';
import { ReviewPhaseStepper } from '@/components/review/review-phase-stepper';
import { ReviewTabs } from '@/components/review/review-tabs';
import { ReviewCard } from '@/components/review/review-card';
import { ReviewClassroomPicker } from '@/components/review/review-classroom-picker';
import { ReviewSuccessBanner } from '@/components/review/review-success-banner';
import { parseReviewTab, reviewListHref, REVIEW_PENDING_HINT, type ReviewTab } from '@/lib/review';
import { getReviewList } from '@/server/queries/review';

// Teacher review list (quick task 261004-gic; design/mac home-11..17, mobile ref 07).
// URL state: ?classroom=&phase=&tab=pending|rejected|approved&mine=1&done=approved|rejected

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const EMPTY_TAB: Record<ReviewTab, string> = {
  pending: 'ยังไม่มีงานรอตรวจ',
  rejected: 'ไม่มีงานที่รอแก้ไข',
  approved: 'ยังไม่มีงานที่ผ่าน',
};

function Title() {
  return <h1 className="text-[26px] leading-tight font-bold text-cocoon-blue lg:text-[30px]">ตรวจงาน</h1>;
}

export default async function TeacherReviewPage({ searchParams }: Props) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const sp = await searchParams;
  const tab = parseReviewTab(first(sp.tab));
  const doneParam = first(sp.done);
  const done = doneParam === 'approved' || doneParam === 'rejected' ? doneParam : null;

  const data = await getReviewList(userId, {
    classroomId: first(sp.classroom),
    phaseId: first(sp.phase),
    mine: first(sp.mine) === '1',
  });

  if (!data.classroomId) {
    return (
      <>
        <CocoonHeader variant="home" />
        <div className="px-[33px] pt-4 lg:px-0 lg:pt-[26px]">
          <Title />
          <div className={`${EMPTY_CARD} mt-6`}>
            <p className="text-[16px] font-bold text-cocoon-ink">ยังไม่มีห้องเรียน</p>
            <Link href="/teacher" className={`${BTN_INFO} inline-flex items-center`}>
              ไปที่หน้าแรก
            </Link>
          </div>
        </div>
      </>
    );
  }

  const counts = data.phaseId ? data.countsByPhase[data.phaseId] : { pending: 0, rejected: 0, approved: 0 };
  const items = data.items.filter((i) => i.tab === tab);
  const pendingByPhase = Object.fromEntries(Object.entries(data.countsByPhase).map(([id, c]) => [id, c.pending]));

  return (
    <>
      <CocoonHeader variant="home" />
      {data.classrooms.length > 1 && (
        <div className="px-[33px] pt-4 lg:px-0 lg:pt-6">
          <ReviewClassroomPicker classrooms={data.classrooms} classroomId={data.classroomId} />
        </div>
      )}

      {/* Mobile: title first (ref 07). Desktop: stepper on top (home-11). */}
      <div className="px-[33px] pt-4 lg:hidden">
        <Title />
      </div>

      {data.phases.length === 0 ? (
        <div className="px-[33px] pt-4 lg:px-0 lg:pt-[26px]">
          <div className="hidden lg:block">
            <Title />
          </div>
          <div className={`${EMPTY_CARD} mt-6`}>
            <p className="text-[16px] font-bold text-cocoon-ink">ห้องเรียนนี้ยังไม่มี Phase</p>
          </div>
        </div>
      ) : (
        <>
          <ReviewPhaseStepper
            phases={data.phases}
            activePhaseId={data.phaseId}
            pendingByPhase={pendingByPhase}
            classroomId={data.classroomId}
            tab={tab}
            mine={data.mine}
          />
          <div className="px-[33px] pt-6 pb-6 lg:px-0 lg:pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="hidden lg:block">
                <Title />
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <Link
                  href={reviewListHref({ classroom: data.classroomId, phase: data.phaseId, tab, mine: !data.mine })}
                  aria-current={data.mine ? 'true' : undefined}
                  className={cn(
                    PILL_CAPACITY,
                    'h-[36px] justify-center self-start px-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:self-auto',
                    data.mine
                      ? 'bg-cocoon-blue text-white'
                      : 'border border-cocoon-blue/40 bg-white hover:bg-cocoon-blue-soft',
                  )}
                >
                  กลุ่มที่ฉันดูแล
                </Link>
                <ReviewTabs
                  tab={tab}
                  counts={counts}
                  classroomId={data.classroomId}
                  phaseId={data.phaseId}
                  mine={data.mine}
                />
              </div>
            </div>
            {data.mine && data.myGroupCount === 0 && (
              <p className="mt-3 text-[14px] leading-normal font-medium text-cocoon-muted lg:text-right">
                คุณยังไม่ได้ดูแลกลุ่มใดในห้องนี้ — ตั้งค่าได้ที่หน้ากลุ่ม
              </p>
            )}
            {tab === 'rejected' && (
              <p className="mt-3 text-[14px] leading-normal font-medium text-cocoon-muted lg:text-right">
                {REVIEW_PENDING_HINT}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-4 lg:mt-8">
              <ReviewSuccessBanner done={done} />
              {items.length === 0 ? (
                <div className={EMPTY_CARD}>
                  <p className="text-[16px] font-bold text-cocoon-muted">{EMPTY_TAB[tab]}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                  {items.map((item) => (
                    <ReviewCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
