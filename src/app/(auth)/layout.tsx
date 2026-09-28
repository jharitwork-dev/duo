import { DecorBackground } from '@/components/cocoon/decor-background';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center">
      <DecorBackground />
      {children}
    </div>
  );
}
