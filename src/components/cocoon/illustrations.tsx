import { cn } from 'cn';

// Inline Cocoon illustrations that are not available as isolated Figma exports.

// Palm with the thumb pointing left and four fingers fanning from up to right (design/mac home-6).
const FINGERS = (
  <>
    <path d="M44 56 L42 14" />
    <path d="M52 54 L64 22" />
    <path d="M58 60 L84 42" />
    <path d="M60 68 L88 68" />
  </>
);
const THUMB = <path d="M44 70 L12 62" />;

/** Yellow "raised hand" (ต้องแก้ไข). `outlined` adds the white sticker edge used by the decor. */
export function HandIllustration({ className, outlined = false }: { className?: string; outlined?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn('block', className)}>
      {outlined && (
        <g stroke="#fff" strokeWidth={24} strokeLinecap="round" fill="#fff">
          {FINGERS}
          {THUMB}
          <circle cx={52} cy={70} r={20} />
        </g>
      )}
      <g stroke="#faa819" strokeWidth={13} strokeLinecap="round" fill="none">
        {FINGERS}
      </g>
      <circle cx={52} cy={70} r={17} fill="#faa819" />
      {/* White seam between thumb and palm */}
      <path d="M44 70 L12 62" stroke="#fff" strokeWidth={17} strokeLinecap="round" />
      <path d="M44 70 L12 62" stroke="#faa819" strokeWidth={13} strokeLinecap="round" />
    </svg>
  );
}

/** Green/blue/red target with an orange arrow (ผ่านแล้ว). */
export function TargetIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn('block', className)}>
      <circle cx={46} cy={54} r={40} fill="#00a86b" />
      <circle cx={46} cy={54} r={30} fill="#fff" />
      <circle cx={46} cy={54} r={24} fill="#0069a6" />
      <circle cx={46} cy={54} r={16} fill="#fff" />
      <circle cx={46} cy={54} r={11} fill="#ef4924" />
      <path d="M48 52 L80 20" stroke="#1d2531" strokeWidth={4} strokeLinecap="round" />
      <path d="M74 10 L78 22 L90 26 L96 14 L84 10 L80 2 Z" fill="#faa819" />
    </svg>
  );
}
