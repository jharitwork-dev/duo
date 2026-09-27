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

export function InlineAddTodo({
  phaseId,
  onCreated,
}: {
  phaseId: string;
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
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs text-muted-foreground"
        onClick={() => {
          setIsAdding(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Plus className="mr-1 size-3" />
        +เพิ่มสิ่งที่ต้องทำ
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') handleCancel();
        }}
        placeholder="ชื่อสิ่งที่ต้องทำ"
        disabled={isPending}
        className="text-sm"
        autoFocus
      />
      <Select
        value={submissionMode}
        onValueChange={(v) => setSubmissionMode(v as 'group' | 'individual')}
      >
        <SelectTrigger className="w-28 text-xs">
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
