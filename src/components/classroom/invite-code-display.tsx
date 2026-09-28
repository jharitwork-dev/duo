'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { regenerateInviteCode } from '@/server/actions/classroom';
import { Button } from '@/components/ui/button';
import { cn } from 'cn';
import { BTN_PRIMARY, BTN_TERTIARY, CARD, CARD_META, CARD_TITLE, DIALOG_PANEL } from '@/components/cocoon/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Copy, Link as LinkIcon, RefreshCw } from 'lucide-react';

interface InviteCodeDisplayProps {
  classroomId: string;
  inviteCode: string;
}

export function InviteCodeDisplay({
  classroomId,
  inviteCode: initialCode,
}: InviteCodeDisplayProps) {
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? '';

  const inviteLink = `${appUrl}/join/${inviteCode}`;

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode);
    toast.success('คัดลอกรหัสเชิญแล้ว');
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    toast.success('คัดลอกลิงก์เชิญแล้ว');
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const result = await regenerateInviteCode({ classroomId });
      if (result.success && result.inviteCode) {
        setInviteCode(result.inviteCode);
        toast.success('สร้างรหัสเชิญใหม่แล้ว');
      }
    } catch (error) {
      toast.error('ไม่สามารถสร้างรหัสใหม่ได้');
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <section className={CARD}>
      <h2 className={CARD_TITLE}>รหัสเชิญ</h2>
      <p className={CARD_META}>แชร์รหัสนี้ให้นักเรียนเพื่อเข้าร่วมห้องเรียน</p>
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-center rounded-[12px] bg-cocoon-blue-soft p-5">
          <span className="font-latin text-[32px] leading-none font-bold tracking-[0.2em] text-cocoon-blue">
            {inviteCode}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyCode} className={cn(BTN_TERTIARY, 'h-10 text-[14px]')}>
            <Copy className="mr-2 size-4" />
            คัดลอกรหัส
          </Button>
          <Button variant="outline" onClick={copyLink} className={cn(BTN_TERTIARY, 'h-10 text-[14px]')}>
            <LinkIcon className="mr-2 size-4" />
            คัดลอกลิงก์
          </Button>

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  className={cn(BTN_TERTIARY, 'h-10 text-[14px]')}
                  disabled={isRegenerating}
                />
              }
            >
                <RefreshCw className="mr-2 size-4" />
                สร้างรหัสใหม่
            </AlertDialogTrigger>
            <AlertDialogContent className={DIALOG_PANEL}>
              <AlertDialogHeader>
                <AlertDialogTitle>สร้างรหัสเชิญใหม่?</AlertDialogTitle>
                <AlertDialogDescription>
                  รหัสเชิญเดิมจะใช้ไม่ได้อีก
                  นักเรียนที่ยังไม่ได้เข้าร่วมจะต้องใช้รหัสใหม่
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={handleRegenerate} className={BTN_PRIMARY}>
                  สร้างรหัสใหม่
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </section>
  );
}
