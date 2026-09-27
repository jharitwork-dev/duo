'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { regenerateInviteCode } from '@/server/actions/classroom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">รหัสเชิญ</CardTitle>
        <CardDescription>
          แชร์รหัสนี้ให้นักเรียนเพื่อเข้าร่วมห้องเรียน
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center rounded-lg bg-muted p-4">
          <span className="font-mono text-3xl font-bold tracking-widest">
            {inviteCode}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyCode}>
            <Copy className="mr-2 size-4" />
            คัดลอกรหัส
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <LinkIcon className="mr-2 size-4" />
            คัดลอกลิงก์
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRegenerating}
              >
                <RefreshCw className="mr-2 size-4" />
                สร้างรหัสใหม่
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>สร้างรหัสเชิญใหม่?</AlertDialogTitle>
                <AlertDialogDescription>
                  รหัสเชิญเดิมจะใช้ไม่ได้อีก
                  นักเรียนที่ยังไม่ได้เข้าร่วมจะต้องใช้รหัสใหม่
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={handleRegenerate}>
                  สร้างรหัสใหม่
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
