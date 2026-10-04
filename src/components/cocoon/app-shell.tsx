import { DecorBackground } from './decor-background';
import { BottomTabBar } from './bottom-tab-bar';
import { DesktopHeader } from './desktop-header';
import type { NavBadges, NavRole } from './nav-items';

// Role-aware Cocoon shell. Below lg it is the 260928-iwi mobile shell (pages apply their own
// 33px gutter, bottom tab bar). At lg it becomes a 1280 frame with a 64px gutter and a top header.
export function AppShell({
  role,
  badges,
  children,
}: {
  role: NavRole;
  /** Nav count badges (e.g. pending reviews for teachers, 261004-gic). */
  badges?: NavBadges;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-svh w-full font-sans text-cocoon-ink">
      <DecorBackground />
      <main className="mx-auto w-full max-w-[402px] pb-[calc(96px+env(safe-area-inset-bottom))] md:max-w-[680px] md:pb-32 lg:max-w-[1280px] lg:px-16 lg:pb-16">
        <DesktopHeader role={role} badges={badges} />
        {children}
      </main>
      <BottomTabBar role={role} badges={badges} />
    </div>
  );
}
