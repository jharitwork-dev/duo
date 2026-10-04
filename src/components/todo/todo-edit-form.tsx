'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateTodo } from '@/server/actions/todo';
import { DeadlineInput } from '@/components/deadline/deadline-input';
import { cn } from 'cn';
import { BTN_PRIMARY, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';
import type { FileRequirement } from '@/lib/work-page';
import { FileRequirementSelect } from './file-requirement-select';
import { TodoAttachmentManager, type ManagedAttachment } from './todo-attachment-manager';

type Todo = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  submissionMode: 'group' | 'individual';
  fileRequirement: FileRequirement;
  deadline: Date | null;
  attachments?: ManagedAttachment[];
};

export function TodoEditForm({
  todo,
  phaseDeadline = null,
}: {
  todo: Todo;
  /** Inherited phase deadline, hinted when the to-do has none. */
  phaseDeadline?: Date | string | null;
}) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? '');
  const [submissionMode, setSubmissionMode] = useState<'group' | 'individual'>(
    todo.submissionMode,
  );
  const [fileRequirement, setFileRequirement] = useState<FileRequirement>(todo.fileRequirement);
  const [deadline, setDeadline] = useState<Date | null>(
    todo.deadline ? new Date(todo.deadline) : null,
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    startTransition(async () => {
      await updateTodo({
        todoId: todo.id,
        title,
        notes: notes || undefined,
        submissionMode,
        fileRequirement,
        deadline: deadline ?? null,
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-4 lg:space-y-0">
      <div className="space-y-2 lg:col-span-2">
        <Label htmlFor={`todo-title-${todo.id}`} className={LABEL}>ชื่อ</Label>
        <Input
          id={`todo-title-${todo.id}`}
          className={INPUT}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          placeholder="ชื่อสิ่งที่ต้องทำ"
        />
      </div>

      <div className="space-y-2 lg:col-span-2">
        <Label htmlFor={`todo-notes-${todo.id}`} className={LABEL}>
          บันทึก / คำแนะนำ
        </Label>
        <p className="text-[12px] text-cocoon-muted">
          ขึ้นบรรทัดด้วย “- ” เพื่อเพิ่มรายการใน “สิ่งที่ต้องส่ง” ของนักเรียน
        </p>
        <Textarea
          id={`todo-notes-${todo.id}`}
          className={TEXTAREA}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSave}
          placeholder="คำแนะนำหรือบันทึกสำหรับนักเรียน (ข้อความธรรมดา)"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL}>รูปแบบการส่งงาน</Label>
        <Select
          value={submissionMode}
          onValueChange={(value) => {
            const mode = value as 'group' | 'individual';
            setSubmissionMode(mode);
            startTransition(async () => {
              await updateTodo({
                todoId: todo.id,
                submissionMode: mode,
              });
              router.refresh();
            });
          }}
        >
          <SelectTrigger className="h-12 w-full rounded-[12px] border-[#f1ece5] bg-[#fffaf3] px-4 text-[16px] data-[size=default]:h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="group">กลุ่ม</SelectItem>
            <SelectItem value="individual">รายบุคคล</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FileRequirementSelect
        id={`todo-file-requirement-${todo.id}`}
        label="ไฟล์แนบตอนส่งงาน"
        value={fileRequirement}
        disabled={isPending}
        onChange={(value) => {
          setFileRequirement(value);
          startTransition(async () => {
            await updateTodo({ todoId: todo.id, fileRequirement: value });
            router.refresh();
          });
        }}
      />

      <DeadlineInput
        idPrefix={`todo-deadline-${todo.id}`}
        value={deadline}
        inheritedDeadline={phaseDeadline}
        disabled={isPending}
        onChange={(next) => {
          setDeadline(next);
          startTransition(async () => {
            await updateTodo({ todoId: todo.id, deadline: next });
            router.refresh();
          });
        }}
      />

      {/* Teacher attachments (261004-gid) */}
      <div className="lg:col-span-2">
        <TodoAttachmentManager todoId={todo.id} attachments={todo.attachments ?? []} />
      </div>

      <Button
        onClick={handleSave}
        disabled={isPending}
        className={cn(BTN_PRIMARY, 'h-10 text-[14px] lg:col-span-2 lg:w-fit')}
      >
        {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>
    </div>
  );
}
