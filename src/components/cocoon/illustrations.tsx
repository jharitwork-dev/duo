import { cn } from 'cn';

// Inline Cocoon illustrations that are not available as isolated Figma exports.

/** Yellow "raised hand" (ต้องแก้ไข) — the official CI sticker (white edge included). */
export function HandIllustration({ className }: { className?: string; outlined?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element -- static CI SVG
  return <img alt="" aria-hidden src="/ci/hand.svg" className={cn('block object-contain', className)} />;
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
