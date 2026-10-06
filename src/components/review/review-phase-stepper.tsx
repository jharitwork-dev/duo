import Link from 'next/link';
import { cn } from 'cn';
import { reviewListHref, type ReviewTab } from '@/lib/review';

// Review list phase picker (design/mac home-11): numbered circles on a track, "Phase n" captions.
// Teacher-side only — the student PhaseStepper (03i) has different semantics.
export function ReviewPhaseStepper({
  phases,
  activePhaseId,
  pendingByPhase,
  classroomId,
  tab,
  mine,
}: {
  phases: { id: string; name: string }[];
  activePhaseId: string | null;
  pendingByPhase: Record<string, number>;
  classroomId: string;
  tab: ReviewTab;
  /** Keep the "กลุ่มที่ฉันดูแล" filter across phase links. */
  mine?: boolean;
}) {
  if (phases.length === 0) return null;
  const activeIndex = Math.max(
    0,
    phases.findIndex((p) => p.id === activePhaseId),
  );
  const fill = phases.length > 1 ? (activeIndex / (phases.length - 1)) * 100 : 100;

  return (
    <nav aria-label="เลือก Phase" className="relative px-[33px] pt-4 lg:px-0 lg:pt-12">
      <div className="relative">
        {phases.length > 1 && (
          <div aria-hidden className="absolute top-[22px] right-[26px] left-[26px] h-[7px] rounded-full bg-cocoon-track">
            <div
              className="h-full rounded-full bg-cocoon-blue"
              style={{ width: `${activeIndex === 0 ? 4 : fill}%` }}
            />
          </div>
        )}
        <ol className="relative flex items-start justify-between gap-2">
          {phases.map((phase, i) => {
            const active = i === activeIndex;
            const pending = pendingByPhase[phase.id] ?? 0;
            return (
              <li key={phase.id} className="flex flex-col items-center">
                <Link
                  href={reviewListHref({ classroom: classroomId, phase: phase.id, tab, mine })}
                  title={phase.name}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'relative flex size-[46px] items-center justify-center rounded-full border text-[22px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:size-[52px] lg:text-[24px]',
                    active
                      ? 'border-cocoon-blue bg-cocoon-blue text-white'
                      : 'border-cocoon-blue bg-white text-cocoon-blue hover:bg-cocoon-blue-soft',
                  )}
                >
                  {i + 1}
                  {pending > 0 && (
                    <span
                      aria-label={`รอตรวจ ${pending} งาน`}
                      className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cocoon-orange px-1 text-[11px] leading-none font-bold text-white"
                    >
                      {pending > 99 ? '99+' : pending}
                    </span>
                  )}
                </Link>
                <span
                  className={cn(
                    'mt-2 text-[12px] leading-normal font-bold lg:text-[13px]',
                    active ? 'text-cocoon-blue' : 'text-cocoon-muted',
                  )}
                >
                  Phase {i + 1}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
