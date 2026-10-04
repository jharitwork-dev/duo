'use client';

import { useState, useTransition } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { updateMyName } from '@/server/actions/profile';

// Display name with an inline editor (pencil → input → save / cancel).
export function ProfileName({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [current, setCurrent] = useState(name);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateMyName(value);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCurrent(result.name);
      setEditing(false);
      toast.success('เปลี่ยนชื่อแล้ว');
    });

  if (!editing) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2">
        <p className="text-[20px] leading-normal font-bold text-cocoon-ink">{current}</p>
        <button
          type="button"
          aria-label="แก้ไขชื่อ"
          onClick={() => {
            setValue(current);
            setEditing(true);
          }}
          className="flex size-8 items-center justify-center rounded-full text-cocoon-muted transition-colors hover:bg-cocoon-blue-soft hover:text-cocoon-blue"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-3 flex w-full max-w-[320px] items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        autoFocus
        value={value}
        maxLength={60}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        aria-label="ชื่อ"
        className="h-10 min-w-0 flex-1 rounded-[10px] border border-cocoon-line bg-white px-3 text-center text-[16px] font-bold text-cocoon-ink outline-none focus:border-cocoon-blue disabled:opacity-60"
      />
      <button
        type="submit"
        aria-label="บันทึกชื่อ"
        disabled={pending || !value.trim()}
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-cocoon-blue text-white disabled:opacity-50"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        aria-label="ยกเลิก"
        disabled={pending}
        onClick={() => setEditing(false)}
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-cocoon-line text-cocoon-muted"
      >
        <X className="size-4" />
      </button>
    </form>
  );
}
