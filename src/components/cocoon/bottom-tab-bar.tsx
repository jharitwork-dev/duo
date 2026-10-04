'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'cn';
import { badgeText, navItemsFor, type NavBadges, type NavRole } from './nav-items';

// Mobile/tablet navigation (< lg). At lg the destinations move into DesktopHeader.
export function BottomTabBar({ role, badges }: { role: NavRole; badges?: NavBadges }) {
  const pathname = usePathname() ?? '';
  const items = navItemsFor(role);

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex border-t border-cocoon-line bg-white px-6 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:rounded-full md:border md:px-10 md:pb-3 md:shadow-lg lg:hidden',
        items.length < 4 ? 'justify-around' : 'justify-between',
      )}
    >
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        const badge = item.badge ? badgeText(badges?.[item.badge]) : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-14 flex-col items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 rounded-md',
              active ? 'text-cocoon-orange' : 'text-cocoon-muted',
            )}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              {badge && (
                <span
                  aria-label={`รอตรวจ ${badges?.[item.badge!]} งาน`}
                  className="absolute -top-1.5 left-[14px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cocoon-orange px-1 text-[11px] leading-none font-bold text-white"
                >
                  {badge}
                </span>
              )}
            </span>
            <span className="text-[11px] leading-normal font-bold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
