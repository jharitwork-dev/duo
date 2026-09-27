import Image from 'next/image';
import RegisterForm from '@/register/components/RegisterForm';

export const metadata = {
  title: 'ลงทะเบียนล่วงหน้า | Innovator\'s',
  description: 'ลงทะเบียนล่วงหน้าเข้าร่วมโครงการ Innovator\'s Academy',
};

export default function RegisterPage() {
  return (
    <main
      className="relative isolate mx-auto flex min-h-dvh w-full max-w-[480px] flex-col overflow-hidden px-6 pb-12 pt-8"
      style={{ fontFamily: 'var(--font-thai), sans-serif' }}
    >
      {/* ── Backdrop ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        style={{ background: '#FFFAF3' }}
      >
        {/* Top-right peach/orange watercolor wash */}
        <div
          className="absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle, rgba(240,74,36,0.20), rgba(251,169,25,0.16) 42%, rgba(255,250,243,0) 70%)',
          }}
        />
        {/* Bottom-left blue watercolor wash */}
        <div
          className="absolute -bottom-28 -left-28 h-[26rem] w-[26rem] rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle, rgba(2,105,167,0.20), rgba(8,168,107,0.12) 42%, rgba(255,250,243,0) 70%)',
          }}
        />

        {/* Yellow Cocoon sparkle — left edge, partly off-canvas */}
        <Image
          src="/logos/shapes-11.webp"
          alt=""
          width={240}
          height={240}
          className="absolute -left-12 top-32 h-auto w-44"
        />

        {/* Blue squiggle — right edge, partly off-canvas */}
        <Image
          src="/logos/shapes-10.webp"
          alt=""
          width={240}
          height={240}
          className="absolute -right-16 top-1/2 h-auto w-44 -translate-y-1/2"
        />
      </div>

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
          ลงทะเบียนล่วงหน้า
        </h1>
        <p
          className="mb-8 text-lg"
          style={{
            fontFamily: 'var(--font-heading), sans-serif',
            color: 'rgba(2,105,167,0.7)',
          }}
        >
          Pre-Registration
        </p>
      </div>

      <RegisterForm />
    </main>
  );
}
