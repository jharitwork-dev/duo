'use client';

import { useState, useTransition, useRef } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPhase } from '@/server/actions/phase';
import { ADD_ROW, INPUT } from '@/components/cocoon/ui';

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
      <button
        type="button"
        className={ADD_ROW}
        onClick={() => {
          setIsAdding(true);
          // Focus input after render
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Plus className="size-4" />
        เพิ่ม Phase
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-[12px] border border-[#f1ece5] bg-white p-2">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') handleCancel();
        }}
        placeholder="ชื่อ Phase ใหม่"
        className={INPUT}
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
