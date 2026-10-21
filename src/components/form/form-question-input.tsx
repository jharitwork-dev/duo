'use client';

// One question's input for the Typeform-style runner (quick task 261021-r1c). Controlled.
import { useLayoutEffect, useRef, useState } from 'react';
import { Check, FileText, Link2, Loader2, Upload, X } from 'lucide-react';
import { cn } from 'cn';
import { FORM_LIMITS, isSafeHttpUrl, type AnswerValue, type FileAnswer, type FormQuestionDef } from '@/lib/forms';
import { formatFileSize } from '@/lib/format';
import { getMyFormFileUrl } from '@/server/actions/form-response';
import { FORM_FILE_ACCEPT, checkFormFile, uploadFormFile } from './upload-form-file';

export const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRST';

export interface FormQuestionInputProps {
  question: FormQuestionDef;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  disabled?: boolean;
  formId: string;
  /** Called on Enter in text inputs (Shift+Enter = newline in long text). */
  onEnter?: () => void;
  /** Called after a single-choice pick (runner auto-advances). */
  onPicked?: () => void;
  /** Value stored on the server (enables "open file" for a saved upload). */
  savedValue?: AnswerValue;
  /** Teacher preview: uploads are not possible. */
  preview?: boolean;
}

const TEXT_INPUT =
  'w-full border-0 border-b-2 border-cocoon-blue/30 bg-transparent px-0 pb-2 text-[20px] text-cocoon-blue placeholder:text-cocoon-blue/35 outline-none transition-colors focus:border-cocoon-blue disabled:opacity-60 lg:text-[24px]';

export function FormQuestionInput(props: FormQuestionInputProps) {
  const { question } = props;
  switch (question.type) {
    case 'short_text':
      return <ShortText {...props} />;
    case 'long_text':
      return <LongText {...props} />;
    case 'single_choice':
    case 'multiple_choice':
      return <Choices {...props} />;
    case 'rating':
      return <Rating {...props} />;
    case 'file':
      return <FileQuestion {...props} />;
  }
}

function ShortText({ value, onChange, disabled, onEnter }: FormQuestionInputProps) {
  return (
    <input
      type="text"
      data-autofocus
      className={TEXT_INPUT}
      value={typeof value === 'string' ? value : ''}
      maxLength={FORM_LIMITS.shortText}
      placeholder="พิมพ์คำตอบของคุณที่นี่…"
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter?.();
        }
      }}
    />
  );
}

function LongText({ value, onChange, disabled, onEnter }: FormQuestionInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = typeof value === 'string' ? value : '';
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [text]);
  return (
    <textarea
      ref={ref}
      data-autofocus
      rows={1}
      className={cn(TEXT_INPUT, 'resize-none leading-relaxed')}
      value={text}
      maxLength={FORM_LIMITS.longText}
      placeholder="พิมพ์คำตอบของคุณที่นี่…"
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter?.();
        }
      }}
    />
  );
}

function Choices({ question, value, onChange, disabled, onPicked }: FormQuestionInputProps) {
  const multiple = question.type === 'multiple_choice';
  const options = question.config.options ?? [];
  const selected = new Set(multiple ? (Array.isArray(value) ? value : []) : typeof value === 'string' ? [value] : []);

  const pick = (optionId: string) => {
    if (disabled) return;
    if (multiple) {
      const next = selected.has(optionId) ? [...selected].filter((id) => id !== optionId) : [...selected, optionId];
      onChange(next.length > 0 ? next : undefined);
    } else {
      onChange(optionId);
      onPicked?.();
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {multiple && <p className="text-[14px] font-medium text-cocoon-blue/70">เลือกได้หลายข้อ</p>}
      <div role={multiple ? 'group' : 'radiogroup'} className="flex flex-col gap-2.5">
        {options.map((option, i) => {
          const isSelected = selected.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              data-form-option
              disabled={disabled}
              onClick={() => pick(option.id)}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border-2 px-3 py-2.5 text-left text-[17px] font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60',
                isSelected
                  ? 'border-cocoon-blue bg-cocoon-blue text-white'
                  : 'border-cocoon-blue/25 bg-white/80 text-cocoon-blue hover:border-cocoon-blue/60 hover:bg-cocoon-blue-soft',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] border text-[13px] font-bold',
                  isSelected ? 'border-white/70 bg-white text-cocoon-blue' : 'border-cocoon-blue/40 bg-white text-cocoon-blue',
                )}
              >
                {OPTION_LETTERS[i] ?? ''}
              </span>
              <span className="min-w-0 flex-1 break-words">{option.label}</span>
              {isSelected && <Check aria-hidden className="size-5 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Rating({ question, value, onChange, disabled, onPicked }: FormQuestionInputProps) {
  const max = question.config.scaleMax ?? 5;
  const current = typeof value === 'number' ? value : null;
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`${n} คะแนน`}
            data-form-option
            disabled={disabled}
            onClick={() => {
              onChange(n);
              onPicked?.();
            }}
            className={cn(
              'flex size-12 items-center justify-center rounded-[10px] border-2 text-[18px] font-bold transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 lg:size-14',
              current === n
                ? 'border-cocoon-blue bg-cocoon-blue text-white'
                : 'border-cocoon-blue/25 bg-white/80 text-cocoon-blue hover:border-cocoon-blue/60 hover:bg-cocoon-blue-soft',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(question.config.minLabel || question.config.maxLabel) && (
        <div className="flex justify-between gap-4 text-[13px] font-medium text-cocoon-blue/70">
          <span>{question.config.minLabel ? `1 = ${question.config.minLabel}` : ''}</span>
          <span className="text-right">{question.config.maxLabel ? `${max} = ${question.config.maxLabel}` : ''}</span>
        </div>
      )}
    </div>
  );
}

function FileQuestion({ question, value, onChange, disabled, formId, savedValue, preview, onEnter }: FormQuestionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const allowLink = question.config.allowLink !== false;
  const answer = value && typeof value === 'object' && !Array.isArray(value) ? (value as FileAnswer) : null;
  const file = answer?.kind === 'file' ? answer : null;
  const linkText = answer?.kind === 'link' ? answer.url : '';
  const savedKey =
    savedValue && typeof savedValue === 'object' && !Array.isArray(savedValue) && savedValue.kind === 'file'
      ? savedValue.key
      : null;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    const pre = checkFormFile(f);
    if (pre) {
      setError(pre);
      return;
    }
    setUploading(true);
    const res = await uploadFormFile(formId, question.id, f);
    setUploading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    onChange(res.answer);
  };

  const openSaved = async () => {
    setOpening(true);
    const res = await getMyFormFileUrl({ formId, questionId: question.id }).catch(() => null);
    setOpening(false);
    if (res?.success) window.open(res.url, '_blank', 'noopener,noreferrer');
    else setError(res && !res.success ? res.error : 'เปิดไฟล์ไม่สำเร็จ');
  };

  const linkInvalid = linkText.trim().length > 0 && !isSafeHttpUrl(linkText.trim());

  return (
    <div className="flex flex-col gap-4">
      {file ? (
        <div className="flex items-center gap-3 rounded-[12px] border-2 border-cocoon-blue/25 bg-white/85 px-3 py-3">
          <FileText aria-hidden className="size-6 shrink-0 text-cocoon-blue" />
          <div className="min-w-0 flex-1">
            {savedKey === file.key ? (
              <button
                type="button"
                onClick={openSaved}
                disabled={opening}
                className="block max-w-full truncate text-left text-[15px] font-bold text-cocoon-blue underline-offset-2 hover:underline"
              >
                {file.name}
              </button>
            ) : (
              <p className="truncate text-[15px] font-bold text-cocoon-blue">{file.name}</p>
            )}
            <p className="text-[13px] text-cocoon-muted">{formatFileSize(file.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              aria-label="ลบไฟล์"
              onClick={() => onChange(undefined)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-cocoon-muted hover:bg-cocoon-blue-soft hover:text-cocoon-blue"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={disabled || uploading || preview}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[96px] w-full flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed border-cocoon-blue/40 bg-white/70 px-4 py-4 text-cocoon-blue transition-colors hover:bg-cocoon-blue-soft disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            {uploading ? <Loader2 aria-hidden className="size-6 animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden className="size-6" />}
            <span className="text-[16px] font-bold">{uploading ? 'กำลังอัปโหลด…' : 'เลือกไฟล์เพื่ออัปโหลด'}</span>
            <span className="text-[13px] font-medium text-cocoon-blue/70">
              {preview ? 'โหมดตัวอย่าง — อัปโหลดไฟล์ไม่ได้' : 'PDF, Word, รูปภาพ, วิดีโอ ฯลฯ · ไม่เกิน 10 MB'}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            accept={FORM_FILE_ACCEPT}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onFile(f);
            }}
          />
        </>
      )}

      {allowLink && !file && (
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[14px] font-bold text-cocoon-blue/80">
            <Link2 aria-hidden className="size-4" /> หรือวางลิงก์
          </span>
          <input
            type="url"
            inputMode="url"
            className={cn(TEXT_INPUT, 'text-[17px] lg:text-[18px]')}
            placeholder="https://"
            value={linkText}
            maxLength={FORM_LIMITS.url}
            disabled={disabled || uploading}
            onChange={(e) => {
              const url = e.target.value;
              onChange(url.trim().length > 0 ? { kind: 'link', url } : undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onEnter?.();
              }
            }}
          />
          {linkInvalid && (
            <span className="text-[13px] font-medium text-cocoon-orange">ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://</span>
          )}
        </label>
      )}

      {error && (
        <p role="alert" className="text-[14px] font-medium text-cocoon-orange">
          {error}
        </p>
      )}
    </div>
  );
}
