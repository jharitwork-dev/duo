'use client';

// One question card in the teacher form builder (quick task 261021-r1c).
// Keeps a local draft; "บันทึกคำถาม" appears when dirty and calls updateQuestion.
// Server-side edit guards (type change / option removal / scale change after responses) come back as toasts.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BTN_PRIMARY, BTN_TERTIARY, CARD, INPUT, LABEL, SELECT, TEXTAREA } from '@/components/cocoon/ui';
import { createId } from '@/lib/ids';
import {
  FORM_LIMITS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  defaultQuestionConfig,
  type ChoiceOption,
  type FormQuestionDef,
  type QuestionConfig,
  type QuestionType,
} from '@/lib/forms';
import { updateQuestion } from '@/server/actions/form';

const ICON_BTN =
  'flex size-9 items-center justify-center rounded-full text-cocoon-muted outline-none hover:bg-cocoon-blue-soft hover:text-cocoon-blue focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:pointer-events-none disabled:opacity-30';

const isChoice = (t: QuestionType) => t === 'single_choice' || t === 'multiple_choice';

function configForType(prev: { type: QuestionType; config: QuestionConfig }, next: QuestionType): QuestionConfig {
  if (isChoice(prev.type) && isChoice(next)) return { options: prev.config.options ?? [] };
  return defaultQuestionConfig(next, createId);
}

function snapshot(d: { type: QuestionType; title: string; description: string; required: boolean; config: QuestionConfig }) {
  return JSON.stringify([d.type, d.title, d.description, d.required, d.config]);
}

export function QuestionEditor({
  question,
  index,
  total,
  hasResponses,
  busy,
  onMove,
  onDelete,
}: {
  question: FormQuestionDef;
  index: number;
  total: number;
  hasResponses: boolean;
  /** A builder-level action (move / delete / add) is running. */
  busy: boolean;
  onMove: (direction: 'up' | 'down') => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<QuestionType>(question.type);
  const [title, setTitle] = useState(question.title);
  const [description, setDescription] = useState(question.description ?? '');
  const [required, setRequired] = useState(question.required);
  const [config, setConfig] = useState<QuestionConfig>(question.config);
  const idBase = `q-${question.id}`;

  const persistedOptionIds = new Set((question.config.options ?? []).map((o) => o.id));
  const initial = snapshot({
    type: question.type,
    title: question.title,
    description: question.description ?? '',
    required: question.required,
    config: question.config,
  });
  const dirty = snapshot({ type, title, description, required, config }) !== initial;
  const disabled = isPending || busy;

  const changeType = (next: QuestionType) => {
    setConfig(configForType({ type, config }, next));
    setType(next);
  };

  const options = config.options ?? [];
  const setOptions = (next: ChoiceOption[]) => setConfig({ ...config, options: next });

  const reset = () => {
    setType(question.type);
    setTitle(question.title);
    setDescription(question.description ?? '');
    setRequired(question.required);
    setConfig(question.config);
  };

  const save = () => {
    if (!title.trim()) {
      toast.error('กรุณาใส่คำถาม');
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateQuestion({
          questionId: question.id,
          type,
          title: title.trim(),
          description: description.trim() ? description : null,
          required,
          config,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('บันทึกคำถามแล้ว');
        router.refresh();
      } catch {
        toast.error('บันทึกคำถามไม่สำเร็จ');
      }
    });
  };

  return (
    <li className={cn(CARD, 'space-y-4 p-4 lg:p-6')}>
      <div className="flex items-center gap-2">
        <span className="font-latin flex size-8 shrink-0 items-center justify-center rounded-full bg-cocoon-blue text-[14px] font-bold text-white">
          {index + 1}
        </span>
        <select
          aria-label="ประเภทคำถาม"
          className={cn(SELECT, 'min-w-0 flex-1')}
          value={type}
          onChange={(e) => changeType(e.target.value as QuestionType)}
          disabled={disabled || hasResponses}
          title={hasResponses ? 'มีคำตอบแล้ว — เปลี่ยนประเภทไม่ได้' : undefined}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button type="button" className={ICON_BTN} aria-label="เลื่อนขึ้น" onClick={() => onMove('up')} disabled={disabled || index === 0}>
          <ArrowUp className="size-4" />
        </button>
        <button
          type="button"
          className={ICON_BTN}
          aria-label="เลื่อนลง"
          onClick={() => onMove('down')}
          disabled={disabled || index === total - 1}
        >
          <ArrowDown className="size-4" />
        </button>
        <button
          type="button"
          className={cn(ICON_BTN, 'hover:bg-[#fff1e8] hover:text-[#e8590c]')}
          aria-label="ลบคำถาม"
          onClick={onDelete}
          disabled={disabled || hasResponses}
          title={hasResponses ? 'มีคำตอบแล้ว — ลบคำถามไม่ได้' : undefined}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor={`${idBase}-title`} className={LABEL}>
          คำถาม *
        </label>
        <Input
          id={`${idBase}-title`}
          className={INPUT}
          value={title}
          maxLength={FORM_LIMITS.questionTitle}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={`${idBase}-desc`} className={LABEL}>
          คำอธิบาย (ไม่บังคับ)
        </label>
        <Textarea
          id={`${idBase}-desc`}
          className={TEXTAREA}
          rows={2}
          value={description}
          maxLength={FORM_LIMITS.questionDescription}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
        />
      </div>

      {isChoice(type) && (
        <div className="space-y-2">
          <span className={LABEL}>ตัวเลือก</span>
          <ul className="space-y-2">
            {options.map((option, i) => {
              const locked = hasResponses && persistedOptionIds.has(option.id);
              return (
                <li key={option.id} className="flex items-center gap-2">
                  <span className="font-latin w-6 shrink-0 text-center text-[14px] font-bold text-cocoon-blue">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <Input
                    aria-label={`ตัวเลือก ${i + 1}`}
                    className={cn(INPUT, 'h-10')}
                    value={option.label}
                    maxLength={FORM_LIMITS.optionLabel}
                    onChange={(e) =>
                      setOptions(options.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)))
                    }
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label={`ลบตัวเลือก ${i + 1}`}
                    onClick={() => setOptions(options.filter((o) => o.id !== option.id))}
                    disabled={disabled || locked || options.length <= FORM_LIMITS.minOptions}
                    title={locked ? 'มีคำตอบแล้ว — ลบตัวเลือกเดิมไม่ได้' : undefined}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {options.length < FORM_LIMITS.maxOptions && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[14px] font-bold text-cocoon-blue hover:underline disabled:opacity-50"
              onClick={() => setOptions([...options, { id: createId(), label: `ตัวเลือก ${options.length + 1}` }])}
              disabled={disabled}
            >
              <Plus className="size-4" aria-hidden />
              เพิ่มตัวเลือก
            </button>
          )}
        </div>
      )}

      {type === 'rating' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor={`${idBase}-scale`} className={LABEL}>
              ช่วงคะแนน
            </label>
            <select
              id={`${idBase}-scale`}
              className={cn(SELECT, 'h-10 w-full')}
              value={config.scaleMax ?? 5}
              onChange={(e) => setConfig({ ...config, scaleMax: Number(e.target.value) === 10 ? 10 : 5 })}
              disabled={disabled || hasResponses}
            >
              <option value={5}>1–5</option>
              <option value={10}>1–10</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor={`${idBase}-min`} className={LABEL}>
              ป้ายคะแนนต่ำสุด
            </label>
            <Input
              id={`${idBase}-min`}
              className={cn(INPUT, 'h-10')}
              placeholder="เช่น ไม่เห็นด้วย"
              value={config.minLabel ?? ''}
              maxLength={FORM_LIMITS.scaleLabel}
              onChange={(e) => setConfig({ ...config, minLabel: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${idBase}-max`} className={LABEL}>
              ป้ายคะแนนสูงสุด
            </label>
            <Input
              id={`${idBase}-max`}
              className={cn(INPUT, 'h-10')}
              placeholder="เช่น เห็นด้วยมาก"
              value={config.maxLabel ?? ''}
              maxLength={FORM_LIMITS.scaleLabel}
              onChange={(e) => setConfig({ ...config, maxLabel: e.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {type === 'file' && (
        <label className="flex items-center gap-2 text-[14px] font-medium text-cocoon-ink">
          <input
            type="checkbox"
            className="size-4 accent-cocoon-blue"
            checked={config.allowLink !== false}
            onChange={(e) => setConfig({ ...config, allowLink: e.target.checked })}
            disabled={disabled}
          />
          อนุญาตให้วางลิงก์แทนไฟล์
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f1ece5] pt-3">
        <label className="flex items-center gap-2 text-[14px] font-bold text-cocoon-ink">
          <input
            type="checkbox"
            className="size-4 accent-cocoon-blue"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            disabled={disabled}
          />
          จำเป็นต้องตอบ
        </label>
        {dirty && (
          <div className="flex gap-2">
            <button type="button" className={cn(BTN_TERTIARY, 'h-10 text-[14px]')} onClick={reset} disabled={disabled}>
              ยกเลิก
            </button>
            <button type="button" className={cn(BTN_PRIMARY, 'h-10 text-[14px] disabled:opacity-50')} onClick={save} disabled={disabled}>
              {isPending ? 'กำลังบันทึก...' : 'บันทึกคำถาม'}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
