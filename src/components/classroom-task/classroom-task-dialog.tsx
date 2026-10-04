'use client';

// Create / edit a classroom-level task ("งานของห้องเรียน", 261004-j6h). Same field set as
// AssignTodoDialog minus the group checklist: every group (incl. future ones) gets a copy.
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BTN_PRIMARY, DIALOG_PANEL, DIALOG_TITLE, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';
import { FileRequirementSelect } from '@/components/todo/file-requirement-select';
import { StagedAttachmentPicker } from '@/components/todo/staged-attachment-picker';
import { DeadlineInput } from '@/components/deadline/deadline-input';
import type { FileRequirement } from '@/lib/work-page';
import type { ClassroomTaskView } from '@/server/queries/classroom-task';
import { createClassroomTask, updateClassroomTask } from '@/server/actions/classroom-task';
import { ClassroomTaskFileManager } from './classroom-task-file-manager';
import { uploadClassroomTaskFile } from './upload-classroom-task-file';

type SubmissionMode = 'group' | 'individual';
const MODE_ITEMS: { value: SubmissionMode; label: string }[] = [
  { value: 'group', label: 'กลุ่ม' },
  { value: 'individual', label: 'รายบุคคล' },
];

export function ClassroomTaskDialog({
  phaseId,
  phaseName,
  phaseDeadline = null,
  task,
  open,
  onOpenChange,
  onSaved,
}: {
  phaseId: string;
  phaseName: string;
  phaseDeadline?: Date | string | null;
  /** Edit mode when set; create mode otherwise. */
  task?: ClassroomTaskView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_PANEL}>
        {/* Remount the form on every open so fields reset to the current task. */}
        {open && (
          <ClassroomTaskForm
            phaseId={phaseId}
            phaseName={phaseName}
            phaseDeadline={phaseDeadline}
            task={task ?? null}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClassroomTaskForm({
  phaseId,
  phaseName,
  phaseDeadline,
  task,
  onClose,
  onSaved,
}: {
  phaseId: string;
  phaseName: string;
  phaseDeadline: Date | string | null;
  task: ClassroomTaskView | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const isEdit = task !== null;
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(task?.submissionMode ?? 'group');
  const [fileRequirement, setFileRequirement] = useState<FileRequirement>(task?.fileRequirement ?? 'optional');
  const [deadline, setDeadline] = useState<Date | null>(task?.deadline ? new Date(task.deadline) : null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const idBase = `classroom-task-${task?.id ?? phaseId}`;

  const canSubmit = title.trim().length > 0 && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const fields = {
          title: title.trim(),
          notes,
          submissionMode,
          fileRequirement,
          deadline,
        };
        if (isEdit) {
          const result = await updateClassroomTask({ classroomTaskId: task.id, ...fields });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success('บันทึกแล้ว — อัปเดตทุกกลุ่ม');
        } else {
          const result = await createClassroomTask({ phaseId, ...fields });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          let failedUploads = 0;
          for (const file of stagedFiles) {
            const uploaded = await uploadClassroomTaskFile(file, result.classroomTaskId);
            if (!uploaded.success) failedUploads++;
          }
          toast.success('เพิ่มงานของห้องเรียนแล้ว');
          if (failedUploads > 0) toast.error(`สร้างงานแล้ว แต่แนบไฟล์ไม่สำเร็จ ${failedUploads} ไฟล์`);
        }
        onClose();
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className={DIALOG_TITLE}>{isEdit ? 'แก้ไขงานของห้องเรียน' : 'เพิ่มงานของห้องเรียน'}</DialogTitle>
        <DialogDescription className="text-center text-[14px] text-cocoon-muted">
          {phaseName} · ทุกกลุ่มได้งานนี้ (รวมกลุ่มที่สร้างภายหลัง)
        </DialogDescription>
      </DialogHeader>

      {isEdit && (
        <p className="mt-3 rounded-[12px] bg-cocoon-blue-soft px-3 py-2 text-[12px] leading-normal font-medium text-cocoon-blue">
          ชื่องาน กำหนดส่ง และรูปแบบการส่งจะอัปเดตทุกกลุ่ม · รายละเอียด ไฟล์ และการแนบไฟล์จะอัปเดตเฉพาะกลุ่มที่ยังไม่ได้แก้เอง
        </p>
      )}

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-title`} className={LABEL}>
            ชื่องาน *
          </Label>
          <Input
            id={`${idBase}-title`}
            className={INPUT}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่องาน"
            disabled={isPending}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idBase}-notes`} className={LABEL}>
            รายละเอียด / สิ่งที่ต้องส่ง
          </Label>
          <p className="text-[12px] text-cocoon-muted">ขึ้นบรรทัดด้วย “- ” เพื่อเพิ่มรายการใน “สิ่งที่ต้องส่ง” ของนักเรียน</p>
          <Textarea
            id={`${idBase}-notes`}
            className={TEXTAREA}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="คำแนะนำหรือบันทึกสำหรับนักเรียน (ข้อความธรรมดา)"
            rows={4}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label className={LABEL}>รูปแบบการส่ง</Label>
          <Select
            items={MODE_ITEMS}
            value={submissionMode}
            onValueChange={(v) => v && setSubmissionMode(v as SubmissionMode)}
          >
            <SelectTrigger className="h-12 w-full rounded-[12px] border-[#f1ece5] bg-[#fffaf3] text-[16px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_ITEMS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <FileRequirementSelect
          id={`${idBase}-file-requirement`}
          value={fileRequirement}
          onChange={setFileRequirement}
          disabled={isPending}
        />

        <DeadlineInput
          idPrefix={`${idBase}-deadline`}
          label="กำหนดส่ง (ไม่บังคับ)"
          value={deadline}
          inheritedDeadline={phaseDeadline}
          onChange={setDeadline}
          disabled={isPending}
        />

        {isEdit ? (
          <ClassroomTaskFileManager classroomTaskId={task.id} files={task.files} />
        ) : (
          <div className="space-y-2">
            <span className={LABEL}>ไฟล์แนบจากครู (ไม่บังคับ)</span>
            <StagedAttachmentPicker files={stagedFiles} onChange={setStagedFiles} disabled={isPending} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!canSubmit} className={cn(BTN_PRIMARY, 'w-full')}>
          {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มงานของห้องเรียน'}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 text-[16px] font-bold text-cocoon-blue hover:underline"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
