'use client';

import { useState, useTransition, useRef } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPhase } from '@/server/actions/phase';

export function InlineAddPhase({
  groupId,
  onCreated,
}: {
  groupId: string;
  onCreated: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!name.trim()) return;

    startTransition(async () => {
      await createPhase({ groupId, name: name.trim() });
      setName('');
      setIsAdding(false);
      onCreated();
    });
  };

  const handleCancel = () => {
    setName('');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start text-muted-foreground"
        onClick={() => {
          setIsAdding(true);
          // Focus input after render
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Plus className="mr-2 size-4" />
        +เพิ่ม Phase
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') handleCancel();
        }}
        placeholder="ชื่อ Phase ใหม่"
        disabled={isPending}
        autoFocus
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={handleSubmit}
        disabled={isPending || !name.trim()}
      >
        <Check className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCancel}
        disabled={isPending}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
