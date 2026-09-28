/* eslint-disable @next/next/no-img-element -- static Figma assets */
import Link from 'next/link';
import { CocoonLogo } from './cocoon-logo';

type CocoonHeaderProps =
  | { variant: 'home'; backHref?: never }
  | { variant: 'back'; backHref: string };

// Figma logo sits at y=73 on a 874px frame that includes a ~50px iOS status bar we don't render.
export function CocoonHeader({ variant, backHref }: CocoonHeaderProps) {
  if (variant === 'back') {
    return (
      <header className="relative flex items-center justify-center pt-[calc(env(safe-area-inset-top)+23px)] lg:hidden">
        <Link
          href={backHref}
          aria-label="ย้อนกลับ"
          className="absolute left-[23px] flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/50"
        >
          <img src="/figma/be57a.svg" alt="" width={20} height={20} className="size-5" />
        </Link>
        <CocoonLogo />
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)+23px)] pr-[33px] pl-[14px] lg:hidden">
      <CocoonLogo />
      <img src="/figma/2bba0.svg" alt="การแจ้งเตือน" width={26} height={30} className="h-[30px] w-[26px]" />
    </header>
  );
}
