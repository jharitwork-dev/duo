import Link from 'next/link';
import { cn } from 'cn';
import { isPhaseViewable, pickCurrentPhaseIndex } from '@/lib/node-path';
import { formatDeadlineDate } from '@/lib/deadline';

interface StepperPhase {
  id: string;
  status: 'locked' | 'active' | 'completed';
  isFreeAccess: boolean;
  /** Phase deadline (261004-03i): "ส่ง 18 ต.ค." under the label. */
  deadline?: Date | string | null;
}

// Mobile: ref 02 (selected label only). lg: design/mac home.png (full width, a label under every circle).
export function PhaseStepper({
  phases,
  selectedId,
}: {
  phases: StepperPhase[];
  selectedId: string | null;
}) {
  if (phases.length === 0) return null;

  const currentIndex = pickCurrentPhaseIndex(phases);
  const fill = phases.length > 1 ? (currentIndex / (phases.length - 1)) * 100 : 0;
  // The date line hangs below the absolute labels: reserve room so the heading below is not crowded.
  const hasDeadlines = phases.some((p) => p.deadline);

  return (
    <nav
      aria-label="Phase"
      className={cn(
        'relative mx-[33px] mt-[-15px] h-[69px] lg:mt-[49px] lg:mr-[15px] lg:ml-[6px] lg:h-[80px]',
        hasDeadlines && 'mb-3 lg:mb-5',
      )}
    >
      {/* Track + progress fill, from first circle centre to last circle centre */}
      {phases.length > 1 && (
        <div className="absolute top-[18px] right-[23.5px] left-[23.5px] h-[11px] rounded-[12px] bg-black/5 lg:top-[21.5px] lg:right-[25.5px] lg:left-[25.5px] lg:h-[8px] lg:bg-[#ece8e2]">
          <div className="h-full rounded-[12px] bg-cocoon-blue" style={{ width: `${fill}%` }} />
        </div>
      )}

      <ol className="relative flex justify-between">
        {phases.map((phase, index) => {
          const filled = phase.status === 'completed' || index <= currentIndex;
          const selected = phase.id === selectedId;
          const viewable = isPhaseViewable(phase);
          const circle = cn(
            'flex size-[47px] items-center justify-center rounded-full font-latin text-[24px] leading-none font-bold lg:size-[51px]',
            filled ? 'bg-cocoon-blue text-white' : 'border border-cocoon-blue bg-white text-cocoon-blue',
            selected && 'ring-2 ring-cocoon-orange/40 lg:ring-cocoon-orange/30',
          );
          const n = index + 1;

          return (
            <li key={phase.id} className="relative flex flex-col items-center">
              {viewable ? (
                <Link
                  href={`?phase=${phase.id}`}
                  scroll={false}
                  aria-label={`Phase ${n}`}
                  aria-current={selected ? 'step' : undefined}
                  className={cn(circle, 'outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/50')}
                >
                  <span className="pt-[3px]">{n}</span>
                </Link>
              ) : (
                <span aria-disabled="true" aria-label={`Phase ${n} (ยังไม่ปลดล็อค)`} className={circle}>
                  <span className="pt-[3px]">{n}</span>
                </span>
              )}
              <span
                aria-hidden={!selected}
                className={cn(
                  'absolute top-[51px] text-[12px] leading-normal font-bold whitespace-nowrap lg:top-[62px] lg:text-[13px]',
                  selected ? 'text-cocoon-blue' : 'hidden text-cocoon-muted lg:block',
                )}
              >
                Phase {n}
                {phase.deadline && (
                  <span className="block text-center text-[11px] leading-normal font-medium text-cocoon-muted">
                    ส่ง {formatDeadlineDate(phase.deadline)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
