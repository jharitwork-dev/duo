import Image from 'next/image';
import RegisterForm from '@/register/components/RegisterForm';
import { CiBackdrop } from '@/components/cocoon/ci-backdrop';

export const metadata = {
  title: 'อัพเดทข้อมูลทีม | Innovator\'s',
  description: 'อัพเดทข้อมูลทีม Innovator\'s Cocoon',
};

export default function RegisterPage() {
  return (
    <main
      className="relative isolate mx-auto flex min-h-dvh w-full max-w-[480px] flex-col overflow-hidden px-6 pb-12 pt-8"
      style={{ fontFamily: 'var(--font-thai), sans-serif' }}
    >
      {/* ── Backdrop ── */}
      <CiBackdrop />

      {/* ── Logo + Header ── */}
      <div className="relative mb-6 flex flex-col items-start">
        <div
          aria-hidden
          className="absolute -inset-x-4 -inset-y-3 -z-10 rounded-[2rem] bg-white/55 blur-2xl"
        />

        {/* Cocoon logo lockup */}
        <Image
          src="/logos/cocoon-lockup-color.webp"
          alt="Innovator's Cocoon"
          width={200}
          height={80}
          className="mb-4"
          priority
        />

        <h1
          className="text-4xl font-bold leading-[1.25]"
          style={{
            fontFamily: 'var(--font-display), var(--font-thai), sans-serif',
            color: '#0269A7',
          }}
        >
          อัพเดทข้อมูลทีม
        </h1>
        <p
          className="mb-8 text-lg"
          style={{
            fontFamily: 'var(--font-heading), sans-serif',
            color: 'rgba(2,105,167,0.7)',
          }}
        >
          Update Team Info
        </p>
      </div>

      <RegisterForm />
    </main>
  );
}
