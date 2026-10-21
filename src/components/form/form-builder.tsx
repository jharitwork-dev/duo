'use client';

// Teacher form builder (quick task 261021-r1c): settings card, status bar, ordered question list.
// All writes go through src/server/actions/form.ts; business errors come back as Thai toasts.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlignLeft,
  CheckSquare,
  CircleDot,
  Paperclip,
  Plus,
  Star,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ADD_ROW,
  BTN_APPROVE,
  BTN_DANGER,
  BTN_INFO,
  BTN_PRIMARY,
  CARD,
  CARD_META,
  CARD_TITLE,
  INPUT,
  LABEL,
  TEXTAREA,
} from '@/components/cocoon/ui';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { DeadlineInput } from '@/components/deadline/deadline-input';
import {
  FORM_LIMITS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  type FormQuestionDef,
  type FormStatus,
  type QuestionType,
  type ResponseMode,
} from '@/lib/forms';
import {
  addQuestion,
  deleteForm,
  deleteQuestion,
  moveQuestion,
  setFormStatus,
  updateFormSettings,
} from '@/server/actions/form';
import { QuestionEditor } from './question-editor';

const TYPE_ICON: Record<QuestionType, LucideIcon> = {
  short_text: Type,
  long_text: AlignLeft,
  single_choice: CircleDot,
  multiple_choice: CheckSquare,
  rating: Star,
  file: Paperclip,
};

export interface FormBuilderSettings {
  title: string;
  description: string | null;
  responseMode: ResponseMode;
  closesAt: Date | null;
  audienceGroupIds: string[];
}

type ActionOutcome = { success: true } | { success: false; error: string };

export function FormBuilder({
  formId,
  classroomId,
  status,
  effectiveStatus,
  settings,
  groups,
  questions,
  hasResponses,
  responseCount,
  linkedTaskCount,
}: {
  formId: string;
  classroomId: string;
  status: FormStatus;
  effectiveStatus: FormStatus;
  settings: FormBuilderSettings;
  groups: { id: string; name: string }[];
  questions: FormQuestionDef[];
  hasResponses: boolean;
  responseCount: number;
  linkedTaskCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteFormOpen, setDeleteFormOpen] = useState(false);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);

  /** Runs a server action: toast on business error, refresh on success. */
  const run = (fn: () => Promise<ActionOutcome>, success?: string) => {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        if (success) toast.success(success);
        router.refresh();
      } catch {
        toast.error('ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง');
      }
    });
  };

  const settingsKey = JSON.stringify([
    settings.title,
    settings.description,
    settings.responseMode,
    settings.closesAt ? new Date(settings.closesAt).getTime() : null,
    [...settings.audienceGroupIds].sort(),
  ]);

  const handleAdd = (type: QuestionType) => {
    setPickerOpen(false);
    run(() => addQuestion({ formId, type }));
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <StatusBar
        status={status}
        effectiveStatus={effectiveStatus}
        questionCount={questions.length}
        pending={isPending}
        onOpen={() => run(() => setFormStatus({ formId, status: 'open' }), status === 'draft' ? 'เผยแพร่แล้ว' : 'เปิดรับคำตอบอีกครั้งแล้ว')}
        onClose={() => run(() => setFormStatus({ formId, status: 'closed' }), 'ปิดรับคำตอบแล้ว')}
        onDelete={() => setDeleteFormOpen(true)}
      />

      <SettingsCard
        key={settingsKey}
        formId={formId}
        settings={settings}
        groups={groups}
        modeLocked={hasResponses || linkedTaskCount > 0}
        modeLockReason={
          hasResponses
            ? 'มีคำตอบแล้ว — เปลี่ยนรูปแบบการตอบไม่ได้'
            : linkedTaskCount > 0
              ? 'แบบฟอร์มนี้เป็นงานใน Phase แล้ว — เปลี่ยนรูปแบบการตอบไม่ได้'
              : null
        }
        busy={isPending}
      />

      <section aria-label="คำถาม" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className={CARD_TITLE}>คำถาม ({questions.length})</h2>
        </div>
        {hasResponses && (
          <p
            role="status"
            className="rounded-[12px] border border-[#a86a00]/25 bg-[rgba(250,168,25,.12)] px-4 py-3 text-[14px] leading-normal font-bold text-[#a86a00]"
          >
            มีคำตอบแล้ว — ลบคำถาม เปลี่ยนประเภท หรือลบตัวเลือกไม่ได้ (แก้ข้อความหรือเพิ่มคำถามใหม่ได้)
          </p>
        )}
        {questions.length === 0 && (
          <p className={cn(CARD_META, 'rounded-[12px] bg-white px-4 py-6 text-center')}>
            ยังไม่มีคำถาม — เพิ่มคำถามอย่างน้อย 1 ข้อก่อนเผยแพร่
          </p>
        )}
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <QuestionEditor
              key={`${q.id}:${JSON.stringify([q.type, q.title, q.description, q.required, q.config])}`}
              question={q}
              index={i}
              total={questions.length}
              hasResponses={hasResponses}
              busy={isPending}
              onMove={(direction) => run(() => moveQuestion({ questionId: q.id, direction }))}
              onDelete={() => setDeleteQuestionId(q.id)}
            />
          ))}
        </ol>

        {questions.length < FORM_LIMITS.questions &&
          (pickerOpen ? (
            <div className={cn(CARD, 'space-y-3 p-4 lg:p-5')}>
              <p className={LABEL}>เลือกประเภทคำถาม</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {QUESTION_TYPES.map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleAdd(t)}
                      disabled={isPending}
                      className="flex h-14 items-center gap-2 rounded-[12px] border border-[#f1ece5] bg-[#fffaf3] px-3 text-left text-[14px] font-bold text-cocoon-ink hover:border-cocoon-blue/40 hover:bg-cocoon-blue-soft disabled:opacity-50"
                    >
                      <Icon className="size-5 shrink-0 text-cocoon-blue" aria-hidden />
                      {QUESTION_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="text-[14px] font-bold text-cocoon-blue hover:underline"
                onClick={() => setPickerOpen(false)}
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button type="button" className={ADD_ROW} onClick={() => setPickerOpen(true)} disabled={isPending}>
              <Plus className="size-4" aria-hidden />
              เพิ่มคำถาม
            </button>
          ))}
      </section>

      <ConfirmDialog
        open={deleteQuestionId !== null}
        onOpenChange={(open) => !open && setDeleteQuestionId(null)}
        title="ลบคำถามนี้?"
        consequences={['คำถามจะถูกลบออกจากแบบฟอร์ม']}
        confirmLabel="ลบคำถาม"
        onConfirm={async () => {
          const questionId = deleteQuestionId;
          if (!questionId) return;
          const result = await deleteQuestion({ questionId });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          setDeleteQuestionId(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleteFormOpen}
        onOpenChange={setDeleteFormOpen}
        title="ลบแบบฟอร์มนี้?"
        consequences={[
          'คำถามทั้งหมดจะถูกลบ',
          responseCount > 0 ? `คำตอบ ${responseCount} รายการ และไฟล์ที่แนบจะถูกลบถาวร` : 'ยังไม่มีคำตอบ',
          ...(linkedTaskCount > 0
            ? ['งานใน Phase ที่เชื่อมกับแบบฟอร์มนี้จะยังอยู่ แต่จะไม่มีแบบฟอร์มให้ตอบแล้ว']
            : []),
        ]}
        warning={responseCount > 0 ? 'ลบแล้วกู้คืนไม่ได้' : undefined}
        confirmLabel="ลบแบบฟอร์ม"
        onConfirm={async () => {
          const result = await deleteForm({ formId });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success('ลบแบบฟอร์มแล้ว');
          setDeleteFormOpen(false);
          router.push(`/teacher/classroom/${classroomId}?tab=forms`);
        }}
      />
    </div>
  );
}

function StatusBar({
  status,
  effectiveStatus,
  questionCount,
  pending,
  onOpen,
  onClose,
  onDelete,
}: {
  status: FormStatus;
  effectiveStatus: FormStatus;
  questionCount: number;
  pending: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const hint =
    effectiveStatus === 'draft'
      ? 'ฉบับร่าง — นักเรียนยังมองไม่เห็นแบบฟอร์มนี้'
      : effectiveStatus === 'open'
        ? 'เปิดรับคำตอบอยู่ — นักเรียนตอบได้'
        : status === 'open'
          ? 'เลยเวลาปิดรับแล้ว — กด “เปิดอีกครั้ง” เพื่อรับคำตอบต่อ (จะล้างเวลาปิดรับที่ผ่านมาแล้ว)'
          : 'ปิดรับคำตอบแล้ว';
  return (
    <div className={cn(CARD, 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')}>
      <p className="text-[14px] leading-normal font-medium text-cocoon-muted">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {effectiveStatus === 'draft' && (
          <button
            type="button"
            className={cn(BTN_APPROVE, 'disabled:opacity-50')}
            onClick={onOpen}
            disabled={pending || questionCount === 0}
            title={questionCount === 0 ? 'เพิ่มคำถามอย่างน้อย 1 ข้อก่อน' : undefined}
          >
            เผยแพร่
          </button>
        )}
        {effectiveStatus === 'open' && (
          <button type="button" className={cn(BTN_INFO, 'disabled:opacity-50')} onClick={onClose} disabled={pending}>
            ปิดรับคำตอบ
          </button>
        )}
        {effectiveStatus === 'closed' && (
          <button type="button" className={cn(BTN_APPROVE, 'disabled:opacity-50')} onClick={onOpen} disabled={pending}>
            เปิดอีกครั้ง
          </button>
        )}
        <button type="button" className={cn(BTN_DANGER, 'disabled:opacity-50')} onClick={onDelete} disabled={pending}>
          ลบแบบฟอร์ม
        </button>
      </div>
    </div>
  );
}

function SettingsCard({
  formId,
  settings,
  groups,
  modeLocked,
  modeLockReason,
  busy,
}: {
  formId: string;
  settings: FormBuilderSettings;
  groups: { id: string; name: string }[];
  modeLocked: boolean;
  modeLockReason: string | null;
  busy: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(settings.title);
  const [description, setDescription] = useState(settings.description ?? '');
  const [responseMode, setResponseMode] = useState<ResponseMode>(settings.responseMode);
  const [closesAt, setClosesAt] = useState<Date | null>(settings.closesAt ? new Date(settings.closesAt) : null);
  const validGroupIds = new Set(groups.map((g) => g.id));
  const initialAudience = settings.audienceGroupIds.filter((id) => validGroupIds.has(id));
  const [audienceMode, setAudienceMode] = useState<'all' | 'groups'>(initialAudience.length > 0 ? 'groups' : 'all');
  const [audience, setAudience] = useState<string[]>(initialAudience);
  const disabled = isPending || busy;

  const toggleGroup = (id: string, checked: boolean) =>
    setAudience((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((g) => g !== id)));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('กรุณาใส่ชื่อแบบฟอร์ม');
      return;
    }
    if (audienceMode === 'groups' && audience.length === 0) {
      toast.error('เลือกอย่างน้อย 1 กลุ่ม หรือเลือก “ทั้งห้องเรียน”');
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateFormSettings({
          formId,
          title: title.trim(),
          description: description.trim() ? description : null,
          responseMode,
          closesAt,
          audienceGroupIds: audienceMode === 'groups' ? audience : [],
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('บันทึกการตั้งค่าแล้ว');
        router.refresh();
      } catch {
        toast.error('บันทึกไม่สำเร็จ');
      }
    });
  };

  const radioRow = 'flex items-start gap-2 text-[14px] font-medium text-cocoon-ink';

  return (
    <form onSubmit={save} className={cn(CARD, 'space-y-5')}>
      <h2 className={CARD_TITLE}>ตั้งค่าแบบฟอร์ม</h2>

      <div className="space-y-2">
        <label htmlFor="form-title" className={LABEL}>
          ชื่อแบบฟอร์ม *
        </label>
        <Input
          id="form-title"
          className={INPUT}
          value={title}
          maxLength={FORM_LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="form-description" className={LABEL}>
          คำอธิบาย (ไม่บังคับ)
        </label>
        <Textarea
          id="form-description"
          className={TEXTAREA}
          rows={3}
          value={description}
          maxLength={FORM_LIMITS.description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className={cn(LABEL, 'mb-2')}>ใครเป็นผู้ตอบ</legend>
        <label className={radioRow}>
          <input
            type="radio"
            name="response-mode"
            className="mt-1 size-4 accent-cocoon-blue"
            checked={responseMode === 'individual'}
            onChange={() => setResponseMode('individual')}
            disabled={disabled || modeLocked}
          />
          <span>
            <span className="font-bold">รายบุคคล</span> — ทุกคนตอบเอง
          </span>
        </label>
        <label className={radioRow}>
          <input
            type="radio"
            name="response-mode"
            className="mt-1 size-4 accent-cocoon-blue"
            checked={responseMode === 'group'}
            onChange={() => setResponseMode('group')}
            disabled={disabled || modeLocked}
          />
          <span>
            <span className="font-bold">กลุ่ม</span> — ตอบหนึ่งครั้งต่อกลุ่ม (สมาชิกคนไหนก็ส่ง/แก้ได้)
          </span>
        </label>
        {modeLockReason && <p className="text-[12px] font-medium text-cocoon-muted">{modeLockReason}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={cn(LABEL, 'mb-2')}>ผู้ที่ตอบได้</legend>
        <label className={radioRow}>
          <input
            type="radio"
            name="audience"
            className="mt-1 size-4 accent-cocoon-blue"
            checked={audienceMode === 'all'}
            onChange={() => setAudienceMode('all')}
            disabled={disabled}
          />
          <span>ทั้งห้องเรียน (ทุกกลุ่ม)</span>
        </label>
        <label className={radioRow}>
          <input
            type="radio"
            name="audience"
            className="mt-1 size-4 accent-cocoon-blue"
            checked={audienceMode === 'groups'}
            onChange={() => setAudienceMode('groups')}
            disabled={disabled || groups.length === 0}
          />
          <span>เลือกกลุ่ม{groups.length === 0 ? ' (ห้องนี้ยังไม่มีกลุ่ม)' : ''}</span>
        </label>
        {audienceMode === 'groups' && (
          <div className="ml-6 grid gap-2 rounded-[12px] border border-[#f1ece5] bg-[#fffaf3] p-3 sm:grid-cols-2">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-[14px] font-medium text-cocoon-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-cocoon-blue"
                  checked={audience.includes(g.id)}
                  onChange={(e) => toggleGroup(g.id, e.target.checked)}
                  disabled={disabled}
                />
                <span className="min-w-0 break-words">{g.name}</span>
              </label>
            ))}
          </div>
        )}
        {audienceMode === 'groups' && responseMode === 'individual' && (
          <p className="text-[12px] font-medium text-cocoon-muted">นักเรียนที่ยังไม่มีกลุ่มจะตอบไม่ได้</p>
        )}
      </fieldset>

      <div className="space-y-1">
        <DeadlineInput
          idPrefix="form-closes-at"
          label="ปิดรับคำตอบ (ไม่บังคับ)"
          value={closesAt}
          onChange={setClosesAt}
          disabled={disabled}
        />
        <p className="text-[12px] font-medium text-cocoon-muted">หลังเวลานี้ปิดรับคำตอบอัตโนมัติ (เวลาไทย)</p>
      </div>

      <div className="flex justify-end">
        <button type="submit" className={cn(BTN_PRIMARY, 'disabled:opacity-50')} disabled={disabled}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>
    </form>
  );
}
