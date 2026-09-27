'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { joinByCode } from '@/server/actions/classroom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function JoinCodeInput() {
  const [code, setCode] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length === 0) return;

    startTransition(async () => {
      try {
        await joinByCode({ code: code.trim().toUpperCase() });
        toast.success('เข้าร่วมห้องเรียนสำเร็จ');
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="ใส่รหัสเข้าร่วม"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={6}
        className="flex-1 text-center font-mono text-lg uppercase tracking-widest"
        disabled={isPending}
      />
      <Button type="submit" disabled={isPending || code.trim().length === 0}>
        {isPending ? 'กำลังเข้าร่วม...' : 'เข้าร่วม'}
      </Button>
    </form>
  );
}
