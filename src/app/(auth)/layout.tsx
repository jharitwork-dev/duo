import { DecorBackground } from '@/components/cocoon/decor-background';
import { AuthDesktopHeader } from '@/components/auth/auth-parts';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center">
      <DecorBackground />
      <AuthDesktopHeader />
      {/* Mobile: centred column. lg: 1152 frame under the header (children pick their own grid). */}
      <div className="flex w-full flex-1 flex-col items-center justify-center lg:max-w-[1280px] lg:px-16">
        {children}
      </div>
    </div>
  );
}
