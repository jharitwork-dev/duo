import { DecorBackground } from './decor-background';
import { BottomTabBar } from './bottom-tab-bar';

// Student-only app shell. Pages apply their own 33px gutter because headers use other x offsets.
export function StudentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh w-full font-sans text-cocoon-ink">
      <DecorBackground />
      <main className="mx-auto w-full max-w-[402px] pb-[calc(96px+env(safe-area-inset-bottom))] md:max-w-[680px] md:pb-32">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
