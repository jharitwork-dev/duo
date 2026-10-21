'use client';

// Typeform-style one-question-per-screen flow in the build.Innovator CI (quick task 261021-r1c).
// mode 'respond' saves via saveFormResponse; mode 'preview' (teacher) never saves.
// CSS transitions only (no motion library); prefers-reduced-motion disables movement.
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Check, ChevronDown, ChevronUp, CornerDownLeft, X } from 'lucide-react';
import { cn } from 'cn';
import {
  formatAnswerText,
  isAnswerEmpty,
  isSafeHttpUrl,
  type AnswerValue,
  type FormAnswers,
  type FormQuestionDef,
  type ResponseMode,
} from '@/lib/forms';
import { saveFormResponse } from '@/server/actions/form-response';
import { FormQuestionInput, OPTION_LETTERS } from './form-question-input';

export interface RunnerInitial {
  answers: FormAnswers;
  updatedAt: string;
  lastEditorName: string;
}

export interface FormRunnerProps {
  mode: 'respond' | 'preview';
  form: { id: string; title: string; description: string | null; responseMode: ResponseMode; closesAt: string | null };
  questions: FormQuestionDef[];
  initial: RunnerInitial | null;
  canRespond: boolean;
  closedReason?: string;
  returnHref: string;
  returnLabel: string;
}

const REQUIRED_ERROR = 'จำเป็นต้องตอบคำถามนี้';
const LINK_ERROR = 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://';
const AUTO_ADVANCE_MS = 400;

const DISPLAY_FONT = { fontFamily: 'var(--font-display), var(--font-thai), sans-serif' } as const;

const closeFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

const OK_BTN =
  'inline-flex h-12 items-center gap-2 rounded-[12px] bg-cocoon-blue px-6 text-[17px] font-bold text-white shadow-sm transition-colors hover:bg-cocoon-blue/90 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';
const GHOST_BTN =
  'inline-flex h-12 items-center gap-2 rounded-[12px] border border-cocoon-line bg-white/85 px-5 text-[16px] font-bold text-cocoon-blue transition-colors hover:bg-cocoon-blue-soft motion-reduce:transition-none';

function isTextTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file'].includes(type);
  }
  return false;
}

function clientError(question: FormQuestionDef, value: AnswerValue | undefined): string | null {
  if (isAnswerEmpty(value)) return question.required ? REQUIRED_ERROR : null;
  if (
    question.type === 'file' &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.kind === 'link' &&
    !isSafeHttpUrl(value.url.trim())
  ) {
    return LINK_ERROR;
  }
  return null;
}

/** Drops empty answers and trims links before sending. */
function cleanAnswers(answers: FormAnswers): FormAnswers {
  const out: FormAnswers = {};
  for (const [id, value] of Object.entries(answers)) {
    if (isAnswerEmpty(value)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'link') {
      out[id] = { kind: 'link', url: value.url.trim() };
    } else {
      out[id] = value;
    }
  }
  return out;
}

/** Remount per screen (key) → fades/slides in, then focuses its input or heading. */
function Screen({ dir, children }: { dir: 'next' | 'prev'; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShown(true);
      const root = ref.current;
      const target =
        root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>('[data-screen-heading]');
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      ref={ref}
      className={cn(
        'w-full transition duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : dir === 'next' ? 'translate-y-6 opacity-0' : '-translate-y-6 opacity-0',
      )}
    >
      {children}
    </div>
  );
}

function AnswerReview({ questions, answers }: { questions: FormQuestionDef[]; answers: FormAnswers }) {
  return (
    <ol className="flex flex-col gap-3">
      {questions.map((q, i) => {
        const text = formatAnswerText(q, answers[q.id]);
        return (
          <li key={q.id} className="rounded-[12px] border border-cocoon-line bg-white/85 px-4 py-3">
            <p className="text-[14px] font-bold text-cocoon-blue">
              {i + 1}. {q.title}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-cocoon-ink">{text.trim() ? text : '—'}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function FormRunner({
  mode,
  form,
  questions,
  initial,
  canRespond,
  closedReason,
  returnHref,
  returnLabel,
}: FormRunnerProps) {
  const router = useRouter();
  const total = questions.length;
  const preview = mode === 'preview';
  const [step, setStep] = useState(-1); // -1 welcome, 0..total-1 questions, total = thank-you
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [answers, setAnswers] = useState<FormAnswers>(() => ({ ...(initial?.answers ?? {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [linkedCount, setLinkedCount] = useState(0);
  const [hasSaved, setHasSaved] = useState(initial !== null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = step >= 0 && step < total ? questions[step] : null;
  const answeredCount = questions.filter((q) => !isAnswerEmpty(answers[q.id])).length;

  const clearTimer = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  };

  const go = useCallback((next: number, direction: 'next' | 'prev') => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setDir(direction);
    setStep(next);
  }, []);

  const setAnswer = (questionId: string, value: AnswerValue | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[questionId];
      else next[questionId] = value;
      return next;
    });
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const submit = async () => {
    if (preview) {
      go(total, 'next');
      return;
    }
    // Client-side pass over every question first (server re-validates everything).
    const localErrors: Record<string, string> = {};
    for (const q of questions) {
      const err = clientError(q, answers[q.id]);
      if (err) localErrors[q.id] = err;
    }
    const firstLocal = questions.findIndex((q) => localErrors[q.id]);
    if (firstLocal >= 0) {
      setErrors(localErrors);
      go(firstLocal, firstLocal < step ? 'prev' : 'next');
      return;
    }
    setSubmitting(true);
    try {
      const res = await saveFormResponse({ formId: form.id, answers: cleanAnswers(answers) });
      if (!res.success) {
        const fieldErrors = res.fieldErrors ?? {};
        const first = questions.findIndex((q) => fieldErrors[q.id]);
        if (first >= 0) {
          setErrors(fieldErrors);
          go(first, first < step ? 'prev' : 'next');
        }
        toast.error(res.error);
        return;
      }
      setLinkedCount(res.linkedTodoIds.length);
      setHasSaved(true);
      go(total, 'next');
      router.refresh();
    } catch {
      toast.error('ส่งคำตอบไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const ok = () => {
    if (!question || submitting) return;
    const err = clientError(question, answers[question.id]);
    if (err) {
      setErrors((prev) => ({ ...prev, [question.id]: err }));
      return;
    }
    if (step === total - 1) void submit();
    else go(step + 1, 'next');
  };

  const back = () => {
    if (step > 0) go(step - 1, 'prev');
    else if (step === 0) go(-1, 'prev');
  };

  const start = () => {
    if (!canRespond || total === 0) return;
    setErrors({});
    go(0, 'next');
  };

  // Latest handlers for timers / the window listener without re-subscribing on every render.
  const okRef = useRef(ok);
  const startRef = useRef(start);
  useEffect(() => {
    okRef.current = ok;
    startRef.current = start;
  });

  const scheduleAdvance = () => {
    clearTimer();
    if (step >= total - 1) return; // never auto-submit from the last question
    advanceTimer.current = setTimeout(() => okRef.current(), AUTO_ADVANCE_MS);
  };
  const scheduleRef = useRef(scheduleAdvance);
  const setAnswerRef = useRef(setAnswer);
  useEffect(() => {
    scheduleRef.current = scheduleAdvance;
    setAnswerRef.current = setAnswer;
  });

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  // Keyboard: Enter = OK / start; A–T pick choices; digits pick ratings (0 = 10).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (isTextTarget(target)) return; // text inputs handle their own Enter
      const onOption = !!target?.closest?.('[data-form-option]');
      const onOtherControl = !onOption && !!target?.closest?.('button, a, input, select, textarea');

      if (e.key === 'Enter') {
        if (onOtherControl) return; // native activation of that control
        if (step === -1) {
          e.preventDefault();
          startRef.current();
        } else if (question) {
          e.preventDefault();
          okRef.current();
        }
        return;
      }
      if (!question || e.shiftKey || e.key.length !== 1) return;

      if (question.type === 'single_choice' || question.type === 'multiple_choice') {
        const idx = OPTION_LETTERS.indexOf(e.key.toUpperCase());
        const option = idx >= 0 ? question.config.options?.[idx] : undefined;
        if (!option) return;
        e.preventDefault();
        if (question.type === 'single_choice') {
          setAnswerRef.current(question.id, option.id);
          scheduleRef.current();
        } else {
          const current = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
          const next = current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id];
          setAnswerRef.current(question.id, next.length > 0 ? next : undefined);
        }
        return;
      }
      if (question.type === 'rating' && /^[0-9]$/.test(e.key)) {
        const max = question.config.scaleMax ?? 5;
        const n = e.key === '0' ? 10 : Number(e.key);
        if (n < 1 || n > max) return;
        e.preventDefault();
        setAnswerRef.current(question.id, n);
        scheduleRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, question, answers]);

  const closesLabel = form.closesAt ? closeFormatter.format(new Date(form.closesAt)) : null;
  const modeLabel = form.responseMode === 'group' ? 'ตอบในนามกลุ่ม' : 'รายบุคคล';
  const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      {(preview || question) && (
        <div className="sticky top-0 z-30">
          {preview && (
            <div className="bg-cocoon-yellow px-4 py-1.5 text-center text-[13px] font-bold text-cocoon-ink">
              โหมดตัวอย่าง (ครู)
            </div>
          )}
          {/* Thin progress bar */}
          {question && (
            <div
              className="h-1 bg-cocoon-orange/15"
              role="progressbar"
              aria-label="ความคืบหน้า"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={answeredCount}
            >
              <div
                className="h-full bg-cocoon-orange transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      <header className="mx-auto flex w-full max-w-[640px] items-center justify-between px-6 pt-5">
        <Image src="/logos/cocoon-lockup-color.webp" alt="Innovator's Cocoon" width={120} height={48} priority />
        <Link
          href={returnHref}
          aria-label={returnLabel}
          className="inline-flex size-10 items-center justify-center rounded-full text-cocoon-blue hover:bg-white/70"
        >
          <X className="size-5" />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center px-6 pb-28 pt-6">
        {step === -1 && (
          <Screen key="welcome" dir={dir}>
            <div className="flex flex-col gap-5">
              <h1
                data-screen-heading
                tabIndex={-1}
                className="text-[32px] leading-[1.2] font-bold text-cocoon-blue outline-none lg:text-[42px]"
                style={DISPLAY_FONT}
              >
                {form.title}
              </h1>
              {form.description && (
                <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-cocoon-ink/80">{form.description}</p>
              )}
              <p className="text-[14px] font-medium text-cocoon-blue/75">
                {total} คำถาม{closesLabel ? ` · ปิดรับ ${closesLabel}` : ''} · {modeLabel}
              </p>
              {form.responseMode === 'group' && initial && (
                <p className="rounded-[12px] bg-cocoon-green/10 px-4 py-2.5 text-[14px] font-bold text-cocoon-green">
                  กลุ่มของคุณตอบแล้ว · แก้ไขล่าสุดโดย {initial.lastEditorName}
                </p>
              )}

              {canRespond ? (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button type="button" onClick={start} disabled={total === 0} className={OK_BTN}>
                    {initial ? 'แก้ไขคำตอบ' : 'เริ่ม'} <ArrowRight aria-hidden className="size-5" />
                  </button>
                  {total > 0 && (
                    <span className="hidden items-center gap-1 text-[13px] text-cocoon-blue/70 sm:inline-flex">
                      กด Enter <CornerDownLeft aria-hidden className="size-3.5" />
                    </span>
                  )}
                  {total === 0 && <p className="text-[14px] text-cocoon-muted">แบบฟอร์มนี้ยังไม่มีคำถาม</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-4 pt-2">
                  <p className="rounded-[12px] bg-cocoon-orange/10 px-4 py-3 text-[15px] font-bold text-cocoon-orange">
                    {closedReason ?? 'ตอบแบบฟอร์มนี้ไม่ได้'}
                  </p>
                  {initial && (
                    <>
                      <p className="text-[15px] font-bold text-cocoon-blue">คำตอบของ{form.responseMode === 'group' ? 'กลุ่ม' : 'คุณ'}</p>
                      <AnswerReview questions={questions} answers={initial.answers} />
                    </>
                  )}
                  <Link href={returnHref} className={cn(GHOST_BTN, 'self-start')}>
                    {returnLabel}
                  </Link>
                </div>
              )}
            </div>
          </Screen>
        )}

        {question && (
          <Screen key={`q-${step}`} dir={dir}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2
                  data-screen-heading
                  tabIndex={-1}
                  className="flex gap-2 text-[26px] leading-[1.25] font-bold text-cocoon-blue outline-none lg:text-[34px]"
                  style={DISPLAY_FONT}
                >
                  <span className="inline-flex shrink-0 items-center gap-1 text-cocoon-orange">
                    {step + 1}
                    <ArrowRight aria-hidden className="size-5 lg:size-6" />
                  </span>
                  <span className="min-w-0 break-words">
                    {question.title}
                    {question.required && (
                      <span className="text-cocoon-orange" aria-label="จำเป็น">
                        {' '}*
                      </span>
                    )}
                  </span>
                </h2>
                {question.description && (
                  <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-cocoon-ink/75">
                    {question.description}
                  </p>
                )}
              </div>

              <FormQuestionInput
                question={question}
                value={answers[question.id]}
                onChange={(v) => setAnswer(question.id, v)}
                disabled={submitting}
                formId={form.id}
                onEnter={ok}
                onPicked={scheduleAdvance}
                savedValue={initial?.answers[question.id]}
                preview={preview}
              />

              {errors[question.id] && (
                <p role="alert" className="text-[14px] font-bold text-cocoon-orange">
                  {errors[question.id]}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={ok} disabled={submitting} className={OK_BTN}>
                  {step === total - 1 ? (submitting ? 'กำลังส่ง…' : 'ส่งคำตอบ') : 'OK'}
                  <Check aria-hidden className="size-5" />
                </button>
                <span className="hidden items-center gap-1 text-[13px] text-cocoon-blue/70 sm:inline-flex">
                  {question.type === 'long_text' ? (
                    <>
                      กด Enter <CornerDownLeft aria-hidden className="size-3.5" /> · Shift+Enter ขึ้นบรรทัดใหม่
                    </>
                  ) : (
                    <>
                      กด Enter <CornerDownLeft aria-hidden className="size-3.5" />
                    </>
                  )}
                </span>
              </div>
            </div>
          </Screen>
        )}

        {step === total && step >= 0 && (
          <Screen key="done" dir={dir}>
            <div className="flex flex-col items-start gap-5">
              <span className="inline-flex size-14 items-center justify-center rounded-full bg-cocoon-green text-white">
                <Check aria-hidden className="size-8" />
              </span>
              <h2
                data-screen-heading
                tabIndex={-1}
                className="text-[30px] leading-[1.2] font-bold text-cocoon-blue outline-none lg:text-[40px]"
                style={DISPLAY_FONT}
              >
                {preview ? 'จบแบบฟอร์ม' : 'ส่งคำตอบแล้ว'}
              </h2>
              {preview ? (
                <p className="text-[16px] font-medium text-cocoon-ink/80">โหมดตัวอย่าง — ไม่ได้บันทึกคำตอบ</p>
              ) : (
                <p className="text-[16px] text-cocoon-ink/80">
                  ขอบคุณ! {hasSaved ? 'แก้ไขคำตอบได้จนกว่าแบบฟอร์มจะปิดรับ' : ''}
                  {linkedCount > 0 ? ' · ส่งเป็นงานแล้ว รอครูตรวจ' : ''}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={returnHref} className={OK_BTN}>
                  {returnLabel}
                </Link>
                {canRespond && (
                  <button type="button" onClick={() => go(0, 'prev')} className={GHOST_BTN}>
                    แก้ไขคำตอบ
                  </button>
                )}
              </div>
            </div>
          </Screen>
        )}
      </main>

      {/* Back / next arrows */}
      {question && (
        <nav className="fixed bottom-5 right-5 z-20 flex overflow-hidden rounded-[10px] bg-cocoon-blue shadow-md">
          <button
            type="button"
            aria-label="ก่อนหน้า"
            onClick={back}
            disabled={submitting}
            className="inline-flex size-11 items-center justify-center text-white hover:bg-white/15 disabled:opacity-50"
          >
            <ChevronUp className="size-5" />
          </button>
          <span aria-hidden className="w-px bg-white/30" />
          <button
            type="button"
            aria-label="ถัดไป"
            onClick={ok}
            disabled={submitting}
            className="inline-flex size-11 items-center justify-center text-white hover:bg-white/15 disabled:opacity-50"
          >
            <ChevronDown className="size-5" />
          </button>
        </nav>
      )}
    </div>
  );
}
