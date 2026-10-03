'use client';

import { useState, useTransition, useRef } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTodo } from '@/server/actions/todo';
import { cn } from 'cn';
import { ADD_ROW, INPUT } from '@/components/cocoon/ui';

export function InlineAddTodo({
  phaseId,
  groupId,
  onCreated,
}: {
  phaseId: string;
  groupId: string;
  onCreated: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [submissionMode, setSubmissionMode] = useState<'group' | 'individual'>('group');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!title.trim()) return;

    startTransition(async () => {
      await createTodo({
        phaseId,
        groupIds: [groupId],
        title: title.trim(),
        submissionMode,
      });
      setTitle('');
      setSubmissionMode('group');
      setIsAdding(false);
      onCreated();
    });
  };

  const handleCancel = () => {
    setTitle('');
    setSubmissionMode('group');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        className={cn(ADD_ROW, 'h-11 text-[14px]')}
        onClick={() => {
          setIsAdding(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Plus className="size-4" />
        เพิ่มงาน
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#e4e8ee] bg-white p-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') handleCancel();
        }}
        placeholder="ชื่องาน"
        disabled={isPending}
        className={cn(INPUT, 'h-10 min-w-0 flex-1 text-[14px] md:text-[14px]')}
        autoFocus
      />
      <Select
        value={submissionMode}
        onValueChange={(v) => setSubmissionMode(v as 'group' | 'individual')}
      >
        <SelectTrigger className="h-10 w-28 rounded-[12px] border-[#f1ece5] bg-[#fffaf3] text-[14px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="group">กลุ่ม</SelectItem>
          <SelectItem value="individual">รายบุคคล</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleSubmit}
        disabled={isPending || !title.trim()}
        className="size-7"
      >
        <Check className="size-3" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCancel}
        disabled={isPending}
        className="size-7"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
