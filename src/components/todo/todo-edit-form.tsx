'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateTodo } from '@/server/actions/todo';
import { formatDateShort } from '@/lib/format';
import { cn } from 'cn';
import { BTN_PRIMARY, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';

type Todo = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  submissionMode: 'group' | 'individual';
  deadline: Date | null;
};

export function TodoEditForm({ todo }: { todo: Todo }) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? '');
  const [submissionMode, setSubmissionMode] = useState<'group' | 'individual'>(
    todo.submissionMode,
  );
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

      <div className="space-y-2">
        <Label className={LABEL}>กำหนดส่ง</Label>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className={cn(INPUT, 'w-full justify-start text-left font-normal text-cocoon-ink')}>
                <CalendarIcon className="mr-2 size-4" />
                {deadline ? formatDateShort(deadline) : 'เลือกวันกำหนดส่ง'}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={deadline ?? undefined}
              onSelect={(date) => {
                setDeadline(date ?? null);
                startTransition(async () => {
                  await updateTodo({
                    todoId: todo.id,
                    deadline: date ?? null,
                  });
                  router.refresh();
                });
              }}
            />
            {deadline && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setDeadline(null);
                    startTransition(async () => {
                      await updateTodo({
                        todoId: todo.id,
                        deadline: null,
                      });
                      router.refresh();
                    });
                  }}
                >
                  ล้างกำหนดส่ง
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Attachments section placeholder */}
      <div className="space-y-2 lg:col-span-2">
        <Label className={LABEL}>ไฟล์แนบ</Label>
        <div className="rounded-[12px] border border-dashed border-cocoon-blue/40 bg-cocoon-blue-soft p-4 text-center text-[14px] text-cocoon-blue">
          อัปโหลดไฟล์แนบ (จะเปิดใช้งานเมื่อเชื่อมต่อ R2)
        </div>
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
