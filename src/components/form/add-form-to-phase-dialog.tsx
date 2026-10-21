'use client';

// "Form as phase task" picker (quick task 261021-r1c, USER-LOCKED). Two entry points:
//  - pick-phase: from the form builder ("เพิ่มเป็นงานใน Phase")
//  - pick-form:  from a phase menu ("เพิ่มงานจากแบบฟอร์ม")
// Both call addFormToPhase; whole-classroom forms become a classroom task, restricted forms per-group todos.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BTN_PRIMARY, DIALOG_PANEL, DIALOG_TITLE } from '@/components/cocoon/ui';
import { FORM_STATUS_LABEL, type FormStatus, type ResponseMode } from '@/lib/forms';
import { addFormToPhase } from '@/server/actions/form';
import { RESPONSE_MODE_LABEL } from './form-pills';

export interface PickPhaseOption {
  id: string;
  name: string;
  alreadyLinked: boolean;
}

export interface PickFormOption {
  id: string;
  title: string;
  status: FormStatus;
  responseMode: ResponseMode;
  /** Audience restricted to specific groups. */
  restricted: boolean;
  audienceGroupCount?: number;
}

type ModeProps =
  | { mode: 'pick-phase'; formId: string; formStatus: FormStatus; restrictedGroupCount: number; phases: PickPhaseOption[] }
  | { mode: 'pick-form'; phaseId: string; phaseName: string; forms: PickFormOption[] };

export type AddFormToPhaseDialogProps = ModeProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddFormToPhaseDialog(props: AddFormToPhaseDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={DIALOG_PANEL}>{props.open && <PickerBody {...props} />}</DialogContent>
    </Dialog>
  );
}

/** Builder header button + its dialog. */
export function AddFormToPhaseButton(props: Extract<ModeProps, { mode: 'pick-phase' }> & { className?: string }) {
  const [open, setOpen] = useState(false);
  const { className, ...rest } = props;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        เพิ่มเป็นงานใน Phase
      </button>
      <AddFormToPhaseDialog {...rest} open={open} onOpenChange={setOpen} />
    </>
  );
}

const ROW =
  'flex cursor-pointer items-start gap-3 rounded-[12px] border border-[#f1ece5] bg-[#fffaf3] px-4 py-3 text-[14px] has-[:checked]:border-cocoon-blue has-[:checked]:bg-cocoon-blue-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50';

function PickerBody(props: AddFormToPhaseDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);

  const isPickPhase = props.mode === 'pick-phase';
  const selectedForm = props.mode === 'pick-form' ? props.forms.find((f) => f.id === selected) : undefined;
  const restricted = isPickPhase ? props.restrictedGroupCount > 0 : Boolean(selectedForm?.restricted);
  const groupCount = isPickPhase ? props.restrictedGroupCount : (selectedForm?.audienceGroupCount ?? 0);
  const isDraft = isPickPhase ? props.formStatus === 'draft' : selectedForm?.status === 'draft';
  const showResult = isPickPhase || selectedForm !== undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const input =
      props.mode === 'pick-phase' ? { formId: props.formId, phaseId: selected } : { formId: selected, phaseId: props.phaseId };
    startTransition(async () => {
      try {
        const result = await addFormToPhase(input);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(
          result.kind === 'classroom_task'
            ? 'เพิ่มเป็นงานของห้องเรียนแล้ว'
            : `เพิ่มงานให้ ${result.count} กลุ่มแล้ว`,
        );
        props.onOpenChange(false);
        router.refresh();
      } catch {
        toast.error('เพิ่มงานไม่สำเร็จ');
      }
    });
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle className={DIALOG_TITLE}>{isPickPhase ? 'เพิ่มเป็นงานใน Phase' : 'เพิ่มงานจากแบบฟอร์ม'}</DialogTitle>
        <DialogDescription className="text-center text-[14px] text-cocoon-muted">
          {isPickPhase ? 'เลือก Phase ที่จะเพิ่มแบบฟอร์มนี้เป็นงาน' : `${props.phaseName} · เลือกแบบฟอร์มของห้องเรียน`}
        </DialogDescription>
      </DialogHeader>

      <fieldset className="max-h-[320px] space-y-2 overflow-y-auto py-4" disabled={isPending}>
        <legend className="sr-only">{isPickPhase ? 'Phase' : 'แบบฟอร์ม'}</legend>
        {props.mode === 'pick-phase' ? (
          props.phases.length === 0 ? (
            <p className="text-center text-[14px] text-cocoon-muted">ห้องเรียนนี้ยังไม่มี Phase</p>
          ) : (
            props.phases.map((p) => (
              <label key={p.id} className={ROW}>
                <input
                  type="radio"
                  name="phase"
                  className="mt-0.5 size-4 accent-cocoon-blue"
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                  disabled={p.alreadyLinked}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold break-words text-cocoon-ink">{p.name}</span>
                  {p.alreadyLinked && <span className="block text-[12px] text-cocoon-muted">มีแบบฟอร์มนี้อยู่แล้ว</span>}
                </span>
              </label>
            ))
          )
        ) : props.forms.length === 0 ? (
          <p className="text-center text-[14px] text-cocoon-muted">ยังไม่มีแบบฟอร์มในห้องเรียนนี้</p>
        ) : (
          props.forms.map((f) => (
            <label key={f.id} className={ROW}>
              <input
                type="radio"
                name="form"
                className="mt-0.5 size-4 accent-cocoon-blue"
                checked={selected === f.id}
                onChange={() => setSelected(f.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-bold break-words text-cocoon-ink">{f.title}</span>
                <span className="block text-[12px] text-cocoon-muted">
                  {FORM_STATUS_LABEL[f.status]} · {RESPONSE_MODE_LABEL[f.responseMode]} ·{' '}
                  {f.restricted ? `${f.audienceGroupCount ?? 0} กลุ่ม` : 'ทั้งห้อง'}
                </span>
              </span>
            </label>
          ))
        )}
      </fieldset>

      {showResult && (
        <div className="space-y-2 rounded-[12px] bg-cocoon-blue-soft px-4 py-3 text-[13px] leading-normal font-medium text-cocoon-blue">
          <p className="font-bold">
            {restricted ? `สร้างงานให้ ${groupCount} กลุ่มที่เลือกในแบบฟอร์ม` : 'สร้างเป็นงานของห้องเรียน (ทุกกลุ่ม)'}
          </p>
          <p>นักเรียนส่งแบบฟอร์มแล้วงานจะเข้าสถานะรอตรวจ</p>
          {isDraft && <p className="text-[#a86a00]">แบบฟอร์มยังเป็นฉบับร่าง — นักเรียนจะตอบได้เมื่อเผยแพร่</p>}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button type="submit" className={cn(BTN_PRIMARY, 'w-full disabled:opacity-50')} disabled={!selected || isPending}>
          {isPending ? 'กำลังเพิ่ม...' : 'เพิ่มงาน'}
        </button>
        <button
          type="button"
          onClick={() => props.onOpenChange(false)}
          className="h-10 text-[16px] font-bold text-cocoon-blue hover:underline"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
