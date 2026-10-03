/* eslint-disable @next/next/no-img-element -- static Figma assets */
import { cn } from 'cn';
import { CocoonLogo } from '@/components/cocoon/cocoon-logo';
import { RocketShapes } from '@/components/cocoon/decor-background';

// Shared building blocks for the Cocoon auth screens.
// Mobile (< lg) keeps the 260928-iwi single column (ref 01); lg follows design/mac/login*.png.

export const AUTH_PRIMARY_BUTTON =
  'flex h-[55px] w-full items-center justify-center rounded-[12px] bg-cocoon-orange text-[16px] font-bold text-white transition-opacity disabled:opacity-50 lg:h-[49px]';

export const AUTH_INPUT =
  'mt-0.5 h-[56px] w-full rounded-[8px] border border-cocoon-line bg-white pr-3 pl-[14px] text-[14px] font-medium text-black outline-none placeholder:text-black/25 focus:border-cocoon-blue lg:mt-1lg:h-[49px] lg:rounded-[12px] lg:border-[#f1ece5] lg:pl-[18px] lg:text-[16px] lg:placeholder:text-[#b9bdc9]';

export const AUTH_LABEL = 'text-[14px] leading-normal font-medium text-black lg:text-[16px] lg:font-bold lg:text-cocoon-ink';

export const PENDING_LABEL = 'กำลังดำเนินการ…';

/** Logo + divider (lg only). The mobile screens render their own logo in AuthMobileIntro. */
export function AuthDesktopHeader() {
  return (
    <div className="hidden w-full max-w-[1280px] px-16 lg:block">
      {/* The logo PNG carries its own padding: 176×82 at (0,16) puts the artwork at x84 y25 like the design. */}
      <div className="h-[114px] pt-4">
        <CocoonLogo />
      </div>
      <div aria-hidden className="h-[2px] bg-[#f1ece5]" />
    </div>
  );
}

/** Mobile intro: logo, orange title and the blue highlight bar (ref 01). */
export function AuthMobileIntro({ title, highlight }: { title: string; highlight: string }) {
  return (
    <div className="lg:hidden">
      {/* Figma y − 50 (iOS status bar not rendered) */}
      <div className="pt-[calc(env(safe-area-inset-top)+25px)] pl-[13px]">
        <CocoonLogo />
      </div>
      <h1 className="-mt-4 pl-[30px] text-[36px] leading-normal font-bold text-cocoon-orange">{title}</h1>
      <div className="mt-[2px] pr-[33px] pl-[33px]">
        <p className="inline-block max-w-full bg-cocoon-blue pr-2 pl-[3px] text-[20px] leading-[39px] font-bold break-words text-white">
          {highlight}
        </p>
      </div>
    </div>
  );
}

/** Desktop hero: big title, blue highlight block, rocket / book / lightbulb cluster. */
export function AuthHero({ title = 'เข้าสู่ระบบ' }: { title?: string }) {
  return (
    <div className="hidden pt-[62px] lg:block">
      <p className="text-[64px] leading-[1.2] font-bold text-cocoon-orange">{title}</p>
      <p className="mt-[21px] flex h-[65px] w-[530px] items-center bg-cocoon-blue px-1 text-[36px] leading-none font-bold whitespace-nowrap text-white">
        พร้อมไปต่อกับโปรเจกต์ของคุณ
      </p>
      <div aria-hidden className="relative mt-[15px] h-[180px] w-[530px]">
        {/* Rocket (same composition as the mobile decor, scaled 1.3) */}
        <div className="absolute top-[-405px] left-[66px] h-[874px] w-[402px] origin-top-left scale-[1.3]">
          <RocketShapes />
        </div>
        {/* Book + pencil */}
        <img alt="" src="/figma/cbd85.svg" className="absolute top-[36px] left-[190px] w-[150px] max-w-none rotate-[-12deg]" />
        {/* Lightbulb */}
        <img alt="" src="/figma/ec2ea.svg" className="absolute top-[28px] left-[382px] w-[114px] max-w-none" />
      </div>
    </div>
  );
}

/** Mobile column → lg 2-column grid (hero | 508px card) inside the 1152 frame. */
export function AuthColumns({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-svh w-full max-w-[402px] self-stretch pb-10 lg:mx-0 lg:grid lg:min-h-0 lg:max-w-none lg:flex-1 lg:grid-cols-[530px_508px] lg:content-start lg:gap-[62px] lg:pt-[54px] lg:pr-8 lg:pb-16 lg:pl-5">
      {children}
    </div>
  );
}

export function AuthCard({
  children,
  align = 'top',
}: {
  children: React.ReactNode;
  /** 'center' vertically centres the content in the 565px desktop card (login.png). */
  align?: 'top' | 'center';
}) {
  return (
    <div
      className={cn(
        'mx-[33px] mt-[42px] rounded-[16px] border border-cocoon-line bg-white px-[19px] pt-10 pb-5',
        'lg:mx-0 lg:mt-0 lg:flex lg:min-h-[565px] lg:flex-col lg:border-[#f1ece5] lg:px-10 lg:py-[32px]',
        align === 'center' && 'lg:justify-center lg:pb-[48px]',
      )}
    >
      {children}
    </div>
  );
}

/** Orange card title used on desktop (and inside the mobile card when `mobile`). */
export function AuthCardTitle({
  children,
  latin = false,
  mobile = false,
}: {
  children: React.ReactNode;
  latin?: boolean;
  mobile?: boolean;
}) {
  return (
    <h2
      className={cn(
        'text-[24px] leading-tight font-bold text-cocoon-orange lg:block lg:text-[30px]',
        latin && 'font-latin',
        !mobile && 'hidden',
      )}
    >
      {children}
    </h2>
  );
}

export function GoogleButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[56px] w-full items-center justify-center gap-2 rounded-[8px] border border-cocoon-line bg-white text-[14px] font-bold text-black transition-opacity disabled:opacity-50',
        'lg:h-[52px] lg:rounded-[12px] lg:border-[#f1ece5] lg:text-[16px] lg:text-cocoon-ink',
        className,
      )}
    >
      <img src="/figma/0938b.png" alt="" width={20} height={20} className="size-5" />
      {label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-2.5 flex items-center gap-3 lg:my-[20px] lg:px-[59px]" aria-hidden>
      <span className="h-px flex-1 bg-black/25 lg:bg-[#c9ccd4]" />
      <span className="text-[12px] leading-normal font-medium text-black/25 lg:text-[14px] lg:text-cocoon-muted">
        หรือ
      </span>
      <span className="h-px flex-1 bg-black/25 lg:bg-[#c9ccd4]" />
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-center text-[12px] leading-normal font-medium text-cocoon-orange lg:text-[14px]">
      {children}
    </p>
  );
}
