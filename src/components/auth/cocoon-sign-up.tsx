'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { useSignUp } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { z } from 'zod';
import { cn } from 'cn';
import {
  AUTH_INPUT,
  AUTH_LABEL,
  AUTH_PRIMARY_BUTTON,
  AuthCard,
  AuthCardTitle,
  AuthColumns,
  AuthError,
  AuthHero,
  AuthMobileIntro,
  GoogleButton,
  OrDivider,
  PENDING_LABEL,
} from './auth-parts';
import { OtpCodeForm } from './otp-boxes';

const detailsSchema = z.object({
  displayName: z.string().trim().min(1, 'กรุณากรอกชื่อที่แสดง').max(50, 'ชื่อที่แสดงยาวได้ไม่เกิน 50 ตัวอักษร'),
  email: z.email('รูปแบบอีเมลไม่ถูกต้อง'),
});

function describeError(err: unknown): ReactNode {
  if (isClerkAPIResponseError(err)) {
    const first = err.errors[0];
    switch (first?.code) {
      case 'form_identifier_exists':
        return (
          <>
            อีเมลนี้มีบัญชีแล้ว —{' '}
            <Link href="/sign-in" className="underline">
              เข้าสู่ระบบ
            </Link>
          </>
        );
      case 'form_code_incorrect':
        return 'รหัสไม่ถูกต้อง';
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

/** Clerk instances without the name attribute reject `first_name` on create. */
function isUnknownFirstName(err: unknown): boolean {
  if (!isClerkAPIResponseError(err)) return false;
  return err.errors.some(
    (e) =>
      e.meta?.paramName === 'first_name' &&
      (e.code === 'form_param_unknown' || e.code === 'form_param_not_allowed'),
  );
}

function isSessionExists(err: unknown): boolean {
  return isClerkAPIResponseError(err) && err.errors[0]?.code === 'session_exists';
}

export function CocoonSignUp() {
  const router = useRouter();
  const clerk = useClerk();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [step, setStep] = useState<'details' | 'code'>('details');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [nameDeferred, setNameDeferred] = useState(false);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<null | 'google' | 'otp' | 'verify' | 'resend'>(null);
  const [error, setError] = useState<ReactNode>(null);

  const busy = pending !== null || !isLoaded;

  async function handleGoogle() {
    if (!isLoaded || !signUp) return;
    setError(null);
    setPending('google');
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sign-in/sso-callback',
        redirectUrlComplete: '/onboarding',
      });
    } catch (err) {
      if (isSessionExists(err)) return router.push('/');
      setError(describeError(err));
      setPending(null);
    }
  }

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    const parsed = detailsSchema.safeParse({ displayName, email: email.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล');
      return;
    }
    const { displayName: name, email: emailAddress } = parsed.data;
    setError(null);
    setPending('otp');
    try {
      let deferred = false;
      try {
        await signUp.create({ emailAddress, firstName: name });
      } catch (err) {
        if (!isUnknownFirstName(err)) throw err;
        await signUp.create({ emailAddress });
        deferred = true;
      }
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setNameDeferred(deferred);
      setDisplayName(name);
      setEmail(emailAddress);
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
    if (!signUp) return;
    setError(null);
    setPending('resend');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    if (code.length !== 6) {
      setError('กรุณากรอกรหัส 6 หลัก');
      return;
    }
    setError(null);
    setPending('verify');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        if (nameDeferred) {
          try {
            await clerk.user?.update({ firstName: displayName });
          } catch {
            // Name is cosmetic; the account is created either way.
          }
        }
        router.push('/onboarding');
        return;
      }
      if (result.status === 'missing_requirements') {
        setError(`ต้องกรอกข้อมูลเพิ่มเติม: ${result.missingFields.join(', ')}`);
      } else {
        setError('ยืนยันไม่สำเร็จ ลองอีกครั้ง');
      }
      setPending(null);
    } catch (err) {
      setError(describeError(err));
      setPending(null);
    }
  }

  return (
    <AuthColumns>
      <AuthMobileIntro
        title={step === 'details' ? 'สมัครสมาชิก' : 'ยืนยันรหัส OTP'}
        highlight={step === 'details' ? 'พร้อมไปต่อกับโปรเจกต์ของคุณ' : `เราส่งรหัสยืนยันไปที่ ${email}`}
      />
      <AuthHero />

      <AuthCard>
        {step === 'details' ? (
          <>
            <AuthCardTitle>สมัครสมาชิก</AuthCardTitle>
            <GoogleButton
              label={pending === 'google' ? PENDING_LABEL : 'สมัครด้วย Google'}
              onClick={handleGoogle}
              disabled={busy}
              className="lg:mt-[22px]"
            />
            <OrDivider />
            <form onSubmit={handleRequestOtp} noValidate>
              <label htmlFor="cocoon-display-name" className={AUTH_LABEL}>
                ชื่อที่แสดง
              </label>
              <input
                id="cocoon-display-name"
                type="text"
                autoComplete="nickname"
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ชื่อที่ต้องการแสดง"
                className={AUTH_INPUT}
              />
              <label htmlFor="cocoon-email" className={cn(AUTH_LABEL, 'mt-3 block lg:mt-[26px]')}>
                อีเมล
              </label>
              <input
                id="cocoon-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอกอีเมลของคุณ"
                className={AUTH_INPUT}
              />
              <button type="submit" disabled={busy} className={cn(AUTH_PRIMARY_BUTTON, 'mt-4 lg:mt-[25px]')}>
                {pending === 'otp' ? PENDING_LABEL : 'รับรหัส OTP'}
              </button>
              <AuthError>{error}</AuthError>
              {/* Clerk bot protection mounts here for custom sign-up flows. */}
              <div id="clerk-captcha" className="mt-2 empty:hidden" />
            </form>
            <p className="mt-3 text-center text-[14px] leading-normal font-medium text-black/30 lg:mt-[36px] lg:text-cocoon-blue">
              มีบัญชีอยู่แล้ว?{' '}
              <Link href="/sign-in" className="text-cocoon-blue underline lg:no-underline lg:hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </>
        ) : (
          <OtpCodeForm
            channel="email"
            code={code}
            onCodeChange={(next) => {
              setCode(next);
              if (error) setError(null);
            }}
            onSubmit={handleVerify}
            onResend={handleResend}
            onBack={() => {
              setStep('details');
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
