'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { cn } from 'cn';
import {
  AUTH_INPUT,
  AUTH_LABEL,
  AUTH_PRIMARY_BUTTON,
  AuthCard,
  AuthColumns,
  AuthError,
  AuthHero,
  AuthMobileIntro,
  GoogleButton,
  OrDivider,
  PENDING_LABEL,
} from './auth-parts';
import { OtpCodeForm } from './otp-boxes';

type OtpFactor =
  | { strategy: 'email_code'; emailAddressId: string }
  | { strategy: 'phone_code'; phoneNumberId: string };

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
        return 'รหัสหมดอายุ กด “ส่ง OTP อีกครั้ง”';
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

  return (
    <AuthColumns>
      <AuthMobileIntro
        title={step === 'identifier' ? 'เข้าสู่ระบบ' : 'ยืนยันรหัส OTP'}
        highlight={step === 'identifier' ? 'พร้อมไปต่อกับโปรเจกต์ของคุณ' : `เราส่งรหัสยืนยันไปที่ ${identifier}`}
      />
      <AuthHero />

      <AuthCard align={step === 'identifier' ? 'center' : 'top'}>
        {step === 'identifier' ? (
          <>
            <GoogleButton
              label={pending === 'google' ? PENDING_LABEL : 'เข้าสู่ระบบด้วย Google'}
              onClick={handleGoogle}
              disabled={busy}
            />
            <OrDivider />
            <form onSubmit={handleRequestOtp} noValidate className="lg:mt-[16px]">
              <label htmlFor="cocoon-identifier" className={AUTH_LABEL}>
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
                className={AUTH_INPUT}
              />
              <p className="mt-1.5 text-[12px] leading-normal font-medium text-black/25 lg:hidden">
                รับรหัส OTP เพื่อเข้าสู่ระบบ
              </p>
              <button type="submit" disabled={busy} className={cn(AUTH_PRIMARY_BUTTON, 'mt-2 lg:mt-[44px]')}>
                {pending === 'otp' ? PENDING_LABEL : 'รับรหัส OTP'}
              </button>
              <AuthError>{error}</AuthError>
            </form>
            <p className="mt-3 text-center text-[14px] leading-normal font-medium text-black/30 lg:mt-[45px] lg:text-cocoon-blue">
              ยังไม่มีบัญชี<span className="lg:hidden"> </span>?{' '}
              <Link href="/sign-up" className="text-cocoon-blue underline lg:no-underline lg:hover:underline">
                สมัครสมาชิก
              </Link>
            </p>
          </>
        ) : (
          <OtpCodeForm
            channel={factor?.strategy === 'phone_code' ? 'phone' : 'email'}
            code={code}
            onCodeChange={(next) => {
              setCode(next);
              if (error) setError(null);
            }}
            onSubmit={handleVerify}
            onResend={handleResend}
            onBack={() => {
              setStep('identifier');
              setFactor(null);
              setCode('');
              setError(null);
            }}
            busy={busy}
            verifying={pending === 'verify'}
            resending={pending === 'resend'}
            error={error}
          />
        )}
      </AuthCard>
    </AuthColumns>
  );
}
