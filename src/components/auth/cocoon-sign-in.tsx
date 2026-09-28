'use client';
/* eslint-disable @next/next/no-img-element -- static Figma assets */

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { CocoonLogo } from '@/components/cocoon/cocoon-logo';

type OtpFactor =
  | { strategy: 'email_code'; emailAddressId: string }
  | { strategy: 'phone_code'; phoneNumberId: string };

const PRIMARY_BUTTON =
  'h-[55px] w-full rounded-[12px] bg-cocoon-orange text-[16px] font-bold text-white transition-opacity disabled:opacity-50';
const PENDING_LABEL = 'กำลังดำเนินการ…';

/** Thai mobile numbers (08x…) → E.164; other digit strings → phone; everything else as typed. */
export function normaliseIdentifier(raw: string): string {
  const value = raw.trim();
  const compact = value.replace(/[\s-]/g, '');
  if (/^0\d{8,9}$/.test(compact)) return `+66${compact.slice(1)}`;
  if (/^\+?\d{8,15}$/.test(compact)) return compact.startsWith('+') ? compact : `+${compact}`;
  return value;
}

function describeError(err: unknown): ReactNode {
  if (isClerkAPIResponseError(err)) {
    const first = err.errors[0];
    switch (first?.code) {
      case 'form_identifier_not_found':
        return (
          <>
            ไม่พบบัญชีนี้ —{' '}
            <Link href="/sign-up" className="underline">
              สมัครสมาชิก
            </Link>
          </>
        );
      case 'form_code_incorrect':
        return 'รหัสไม่ถูกต้อง ลองอีกครั้ง';
      case 'verification_expired':
        return 'รหัสหมดอายุ กด “ส่งรหัสอีกครั้ง”';
      case 'too_many_requests':
        return 'ลองหลายครั้งเกินไป กรุณารอสักครู่';
      default:
        return first?.longMessage ?? first?.message ?? 'เกิดข้อผิดพลาด ลองอีกครั้ง';
    }
  }
  return 'เกิดข้อผิดพลาด ลองอีกครั้ง';
}

function isSessionExists(err: unknown): boolean {
  return isClerkAPIResponseError(err) && err.errors[0]?.code === 'session_exists';
}

export function CocoonSignIn() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [step, setStep] = useState<'identifier' | 'code'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [factor, setFactor] = useState<OtpFactor | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<null | 'google' | 'otp' | 'verify' | 'resend'>(null);
  const [error, setError] = useState<ReactNode>(null);

  const busy = pending !== null || !isLoaded;

  async function handleGoogle() {
    if (!isLoaded || !signIn) return;
    setError(null);
    setPending('google');
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sign-in/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err) {
      if (isSessionExists(err)) return router.push('/');
      setError(describeError(err));
      setPending(null);
    }
  }

  async function prepare(f: OtpFactor) {
    if (!signIn) return;
    if (f.strategy === 'email_code') {
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: f.emailAddressId });
    } else {
      await signIn.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: f.phoneNumberId });
    }
  }

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    const value = normaliseIdentifier(identifier);
    if (!value) {
      setError('กรุณากรอกอีเมลหรือเบอร์โทร');
      return;
    }
    setError(null);
    setPending('otp');
    try {
      const attempt = await signIn.create({ identifier: value });
      const factors = attempt.supportedFirstFactors ?? [];
      let next: OtpFactor | null = null;
      for (const f of factors) {
        if (f.strategy === 'email_code') {
          next = { strategy: 'email_code', emailAddressId: f.emailAddressId };
          break;
        }
        if (f.strategy === 'phone_code') {
          next = { strategy: 'phone_code', phoneNumberId: f.phoneNumberId };
          break;
        }
      }
      if (!next) {
        setError('บัญชีนี้ยังไม่รองรับการเข้าสู่ระบบด้วย OTP');
        return;
      }
      await prepare(next);
      setFactor(next);
      setIdentifier(value);
      setCode('');
      setStep('code');
    } catch (err) {
      if (isSessionExists(err)) return router.push('/');
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  async function handleResend() {
    if (!factor) return;
    setError(null);
    setPending('resend');
    try {
      await prepare(factor);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || !factor) return;
    if (code.length !== 6) {
      setError('กรุณากรอกรหัส 6 หลัก');
      return;
    }
    setError(null);
    setPending('verify');
    try {
      const result = await signIn.attemptFirstFactor({ strategy: factor.strategy, code });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.push('/');
        return;
      }
      setError('ต้องยืนยันตัวตนเพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ');
      setPending(null);
    } catch (err) {
      setError(describeError(err));
      setPending(null);
    }
  }

  const errorLine = error ? (
    <p role="alert" className="mt-2 text-center text-[12px] leading-normal font-medium text-cocoon-orange">
      {error}
    </p>
  ) : null;

  return (
    <div className="mx-auto min-h-svh w-full max-w-[402px] self-stretch pb-10">
      {/* Figma y − 50 (iOS status bar not rendered) */}
      <div className="pt-[calc(env(safe-area-inset-top)+25px)] pl-[13px]">
        <CocoonLogo />
      </div>

      <h1 className="-mt-4 pl-[30px] text-[36px] leading-normal font-bold text-cocoon-orange">
        {step === 'identifier' ? 'เข้าสู่ระบบ' : 'ยืนยันรหัส OTP'}
      </h1>
      <div className="mt-[2px] pl-[33px] pr-[33px]">
        <p className="inline-block max-w-full bg-cocoon-blue pr-2 pl-[3px] text-[20px] leading-[39px] font-bold break-words text-white">
          {step === 'identifier' ? 'พร้อมไปต่อกับโปรเจกต์ของคุณ' : `เราส่งรหัสยืนยันไปที่ ${identifier}`}
        </p>
      </div>

      <div className="mx-[33px] mt-[42px] rounded-[16px] border border-cocoon-line bg-white px-[19px] pt-10 pb-5">
        {step === 'identifier' ? (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[8px] border border-cocoon-line bg-white text-[14px] font-bold text-black transition-opacity disabled:opacity-50"
            >
              <img src="/figma/0938b.png" alt="" width={20} height={20} className="size-5" />
              {pending === 'google' ? PENDING_LABEL : 'เข้าสู่ระบบด้วย Google'}
            </button>

            <div className="my-2.5 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-black/25" />
              <span className="text-[12px] leading-normal font-medium text-black/25">หรือ</span>
              <span className="h-px flex-1 bg-black/25" />
            </div>

            <form onSubmit={handleRequestOtp} noValidate>
              <label htmlFor="cocoon-identifier" className="text-[14px] leading-normal font-medium text-black">
                อีเมลหรือเบอร์โทร
              </label>
              <input
                id="cocoon-identifier"
                type="text"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="กรอกอีเมลหรือเบอร์โทร"
                className="mt-0.5 h-[56px] w-full rounded-[8px] border border-cocoon-line bg-white pr-3 pl-[14px] text-[14px] font-medium text-black outline-none placeholder:text-black/25 focus:border-cocoon-blue"
              />
              <p className="mt-1.5 text-[12px] leading-normal font-medium text-black/25">
                รับรหัส OTP เพื่อเข้าสู่ระบบ
              </p>
              <button type="submit" disabled={busy} className={`mt-2 ${PRIMARY_BUTTON}`}>
                {pending === 'otp' ? PENDING_LABEL : 'รับรหัส OTP'}
              </button>
              {errorLine}
            </form>
          </>
        ) : (
          <form onSubmit={handleVerify} noValidate>
            <label htmlFor="cocoon-otp" className="text-[14px] leading-normal font-medium text-black">
              รหัส OTP 6 หลัก
            </label>
            <input
              id="cocoon-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-0.5 h-[56px] w-full rounded-[8px] border border-cocoon-line bg-white text-center font-latin text-[24px] font-bold tracking-[0.5em] text-black outline-none focus:border-cocoon-blue"
            />
            <button type="submit" disabled={busy || code.length !== 6} className={`mt-4 ${PRIMARY_BUTTON}`}>
              {pending === 'verify' ? PENDING_LABEL : 'ยืนยัน'}
            </button>
            {errorLine}
            <div className="mt-3 flex items-center justify-between text-[14px] leading-normal font-medium">
              <button
                type="button"
                onClick={handleResend}
                disabled={busy}
                className="text-cocoon-blue underline disabled:opacity-50"
              >
                {pending === 'resend' ? PENDING_LABEL : 'ส่งรหัสอีกครั้ง'}
              </button>
              <button
                type="button"
                disabled={pending === 'verify'}
                onClick={() => {
                  setStep('identifier');
                  setFactor(null);
                  setCode('');
                  setError(null);
                }}
                className="text-cocoon-blue underline disabled:opacity-50"
              >
                เปลี่ยนอีเมล/เบอร์
              </button>
            </div>
          </form>
        )}

        <p className="mt-3 text-center text-[14px] leading-normal font-medium text-black/30">
          ยังไม่มีบัญชี ?{' '}
          <Link href="/sign-up" className="text-cocoon-blue underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}
