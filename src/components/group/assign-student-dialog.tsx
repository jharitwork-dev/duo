'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { assignStudent } from '@/server/actions/group';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';

interface ClassroomMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date | null;
}

interface AssignStudentDialogProps {
  groupId: string;
  classroomMembers: ClassroomMember[];
}

export function AssignStudentDialog({
  groupId,
  classroomMembers,
}: AssignStudentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  // Filter to only students (not teachers)
  const unassignedStudents = classroomMembers.filter(
    (m) => m.role === 'student'
  );

  async function handleAssign(userId: string) {
    setAssigningUserId(userId);
    try {
      const result = await assignStudent({ groupId, userId });
      if (result.success) {
        toast.success('เพิ่มนักเรียนเข้ากลุ่มแล้ว');
        router.refresh();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ไม่สามารถเพิ่มนักเรียนได้';
      toast.error(message);
    } finally {
      setAssigningUserId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" nativeButton={false} />}>
          <UserPlus className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มนักเรียนเข้ากลุ่ม</DialogTitle>
          <DialogDescription>
            เลือกนักเรียนที่ต้องการเพิ่มเข้ากลุ่ม
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[300px] space-y-2 overflow-y-auto">
          {unassignedStudents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              ไม่มีนักเรียนที่พร้อมเพิ่มเข้ากลุ่ม
            </p>
          ) : (
            unassignedStudents.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm">{member.userId}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAssign(member.userId)}
                  disabled={assigningUserId === member.userId}
                >
                  {assigningUserId === member.userId
                    ? 'กำลังเพิ่ม...'
                    : 'เพิ่ม'}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
