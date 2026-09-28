/* eslint-disable @next/next/no-img-element -- static Figma assets */
import { cn } from 'cn';
import { HandIllustration, TargetIllustration } from '@/components/cocoon/illustrations';
import type { SubmissionStatus } from '@/lib/node-path';

type IconSize = 'sm' | 'lg';

/** Status-specific node icon (design/mac home / home-5 / home-6 / home-10). */
export function NodeIcon({
  status,
  locked,
  size = 'sm',
}: {
  status: SubmissionStatus;
  locked: boolean;
  size?: IconSize;
}) {
  const lg = size === 'lg';

  if (locked) {
    return (
      <img
        src="/figma/8f1f5.svg"
        alt=""
        width={32}
        height={41}
        className={lg ? 'h-[60px] w-[46px]' : 'h-[41px] w-[32px]'}
      />
    );
  }

  switch (status) {
    case 'pending':
      return (
        <span aria-hidden className={cn('relative block', lg ? 'size-[72px]' : 'size-[45px]')}>
          <img src="/figma/ff79c.svg" alt="" className={cn('absolute top-0 left-0 max-w-none', lg ? 'size-[62px]' : 'size-[39px]')} />
          <img
            src="/figma/c536c.svg"
            alt=""
            className={cn('absolute right-0 bottom-0 max-w-none', lg ? 'size-[26px]' : 'size-[16px]')}
          />
        </span>
      );
    case 'rejected':
      return <HandIllustration className={lg ? 'size-[88px]' : 'size-[52px]'} />;
    case 'approved':
      return <TargetIllustration className={lg ? 'size-[74px]' : 'size-[48px]'} />;
    default:
      return (
        <img
          src="/figma/c64bc.svg"
          alt=""
          width={50}
          height={45}
          className={lg ? 'h-[52px] w-[58px]' : 'h-[45px] w-[50px]'}
        />
      );
  }
}

const RING_COLOR: Record<SubmissionStatus, string> = {
  none: '#ef4924',
  pending: '#0069a6',
  rejected: '#faa819',
  approved: '#00a86b',
};

// Arc sweep from 12 o'clock, clockwise (orange/blue ≈ to 3–4 o'clock, yellow to 6, green full).
const RING_SWEEP: Record<SubmissionStatus, number> = {
  none: 105,
  pending: 105,
  rejected: 180,
  approved: 360,
};

/** Progress ring overlay for a node. Rendered over the node's outer edge. */
export function NodeRing({
  status,
  diameter,
  stroke,
  className,
}: {
  status: SubmissionStatus;
  diameter: number;
  stroke: number;
  className?: string;
}) {
  const r = (diameter - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sweep = RING_SWEEP[status];
  const full = sweep >= 360;
  return (
    <svg
      aria-hidden
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
      className={cn('pointer-events-none absolute', className)}
    >
      <circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={r}
        fill="none"
        stroke={RING_COLOR[status]}
        strokeWidth={stroke}
        strokeLinecap={full ? 'butt' : 'round'}
        strokeDasharray={full ? undefined : `${(c * sweep) / 360} ${c}`}
        transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
      />
    </svg>
  );
}

/** Which ring (if any) a node shows. Locked nodes never get a ring. */
export function ringStatusFor(
  status: SubmissionStatus,
  locked: boolean,
  isCurrent: boolean,
): SubmissionStatus | null {
  if (locked) return null;
  if (status === 'none') return isCurrent ? 'none' : null;
  return status;
}
