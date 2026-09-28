'use client';

import { useRef, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from 'cn';
import { AUTH_PRIMARY_BUTTON, AuthError, PENDING_LABEL } from './auth-parts';

interface OtpCodeFormProps {
  channel: 'email' | 'phone';
  code: string;
  onCodeChange: (next: string) => void;
  onSubmit: (e: FormEvent) => void;
  onResend: () => void;
  onBack: () => void;
  busy: boolean;
  verifying: boolean;
  resending: boolean;
  error: ReactNode;
  length?: number;
}

/** Shared code step (design/mac login-2 empty → green resend, login-3 filled → orange ยืนยัน). */
export function OtpCodeForm({
  channel,
  code,
  onCodeChange,
  onSubmit,
  onResend,
  onBack,
  busy,
  verifying,
  resending,
  error,
  length = 6,
}: OtpCodeFormProps) {
  const complete = code.length === length;
  const where = channel === 'email' ? 'อีเมล' : 'เบอร์โทร';

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 className="text-[26px] leading-tight font-bold text-cocoon-orange lg:text-[30px]">
        Verification Code
      </h2>
      <p className="mt-2 text-[14px] leading-normal font-medium text-cocoon-muted lg:mt-[22px] lg:text-[16px]">
        กรอกรหัส OTP ที่ส่งไปยัง{where}ของคุณ
      </p>
      <div className="mt-5 lg:mt-[40px]">
        <OtpBoxes value={code} onChange={onCodeChange} length={length} disabled={verifying} autoFocus />
      </div>

      {complete ? (
        <button type="submit" disabled={busy} className={cn(AUTH_PRIMARY_BUTTON, 'mt-6 lg:mt-[49px]')}>
          {verifying ? PENDING_LABEL : 'ยืนยัน'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onResend}
          disabled={busy}
          className={cn(AUTH_PRIMARY_BUTTON, 'mt-6 bg-cocoon-green lg:mt-[49px]')}
        >
          {resending ? PENDING_LABEL : 'ส่ง OTP อีกครั้ง'}
        </button>
      )}
      <AuthError>{error}</AuthError>

      <div className="mt-4 flex items-center justify-between gap-3 text-[14px] leading-normal font-medium lg:mt-[40px]">
        <button
          type="button"
          onClick={onBack}
          disabled={verifying}
          className="rounded-sm text-cocoon-blue hover:underline disabled:opacity-50"
        >
          ย้อนกลับไปแก้ไข{channel === 'email' ? 'อีเมล' : 'อีเมล/เบอร์โทร'}
        </button>
        {complete && (
          <button
            type="button"
            onClick={onResend}
            disabled={busy}
            className="rounded-sm text-cocoon-muted hover:underline disabled:opacity-50"
          >
            {resending ? PENDING_LABEL : 'ส่ง OTP อีกครั้ง'}
          </button>
        )}
      </div>
    </form>
  );
}

interface OtpBoxesProps {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Digit-per-box OTP input (design/mac login-2/3). `value` is a contiguous digit string. */
export function OtpBoxes({ value, onChange, length = 6, disabled, autoFocus }: OtpBoxesProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number) => {
    const i = Math.max(0, Math.min(length - 1, index));
    const el = refs.current[i];
    if (el) {
      el.focus();
      el.select();
    }
  };

  function setDigits(start: number, digits: string) {
    const clean = digits.replace(/\D/g, '');
    if (!clean) return;
    const next = (value.slice(0, start) + clean).slice(0, length);
    onChange(next);
    focusBox(next.length >= length ? length - 1 : next.length);
  }

  function handleInput(index: number, raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    // Autofill / fast typing can deliver several digits into one box.
    const start = Math.min(index, value.length);
    if (digits.length > 1) {
      setDigits(start, digits);
      return;
    }
    const next = (value.slice(0, start) + digits + value.slice(start + 1)).slice(0, length);
    onChange(next);
    focusBox(start + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (index < value.length) {
        onChange(value.slice(0, index) + value.slice(index + 1));
        focusBox(index);
      } else if (index > 0) {
        onChange(value.slice(0, index - 1));
        focusBox(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(Math.min(index + 1, value.length));
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    setDigits(0, e.clipboardData.getData('text'));
  }

  return (
    <div className="flex gap-[6px] lg:gap-[9px]">
      {Array.from({ length }, (_, i) => {
        const digit = value[i] ?? '';
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`รหัส OTP หลักที่ ${i + 1}`}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            value={digit}
            onFocus={(e) => {
              // Keep the code contiguous: jump to the first empty box.
              if (i > value.length) focusBox(value.length);
              else e.currentTarget.select();
            }}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'h-14 w-full min-w-0 flex-1 rounded-[12px] border bg-[#fffaf3] text-center font-latin text-[26px] font-bold text-cocoon-ink caret-cocoon-blue outline-none transition-colors lg:h-20 lg:text-[28px]',
              'focus:border-cocoon-blue disabled:opacity-60',
              digit ? 'border-cocoon-green/60' : 'border-[#f1ece5]',
            )}
          />
        );
      })}
    </div>
  );
}
