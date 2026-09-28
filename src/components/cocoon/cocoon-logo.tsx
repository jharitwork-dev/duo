/* eslint-disable @next/next/no-img-element -- static Figma asset */
import { cn } from 'cn';

export function CocoonLogo({ className }: { className?: string }) {
  return (
    <img
      src="/figma/3a22e.png"
      alt="innovator's Cocoon"
      width={176}
      height={82}
      className={cn('block h-[82px] w-[176px] max-w-none', className)}
    />
  );
}
