'use client';
/* eslint-disable @next/next/no-img-element -- static Figma assets */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'cn';
import { CocoonLogo } from './cocoon-logo';
import { badgeText, navItemsFor, type NavBadges, type NavRole } from './nav-items';

// Desktop (lg+) header from design/mac: logo left, nav links + bell right, 2px divider at y≈115.
export function DesktopHeader({ role, badges }: { role: NavRole; badges?: NavBadges }) {
  const pathname = usePathname() ?? '';
  const items = navItemsFor(role);

  return (
    <header className="hidden lg:block">
      {/* The logo PNG carries its own padding: 176×82 at (0,16) puts the artwork at x84 y25 like the design. */}
      <div className="flex h-[114px] items-start justify-between pt-4 pr-8">
        <Link
          href={items[0]?.href ?? '/'}
          aria-label="หน้าแรก"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
        >
          <CocoonLogo />
        </Link>
        <div className="flex items-center gap-10 pt-[24px]">
          <nav aria-label="เมนูหลัก" className="flex items-center gap-8">
            {items.map((item) => {
              const active = item.match(pathname);
              const badge = item.badge ? badgeText(badges?.[item.badge]) : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md text-[14px] leading-normal outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40',
                    active ? 'font-bold text-cocoon-orange' : 'font-medium text-cocoon-muted hover:text-cocoon-blue',
                  )}
                >
                  {item.desktopLabel ?? item.label}
                  {badge && (
                    <span
                      aria-label={`รอตรวจ ${badges?.[item.badge!]} งาน`}
                      className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cocoon-orange px-1 text-[11px] leading-none font-bold text-white"
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <img
            src="/figma/2bba0.svg"
            alt="การแจ้งเตือน"
            width={34}
            height={40}
            className="h-[40px] w-[34px] opacity-90"
          />
        </div>
      </div>
      <div aria-hidden className="h-[2px] bg-[#f1ece5]" />
    </header>
  );
}
