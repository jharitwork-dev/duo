'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { joinGroup } from '@/server/actions/group';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface GroupOption {
  id: string;
  name: string;
  memberCount: number;
}

interface StudentGroupPickerProps {
  groups: GroupOption[];
  maxGroupSize: number | null;
  classroomId: string;
}

export function StudentGroupPicker({
  groups,
  maxGroupSize,
  classroomId,
}: StudentGroupPickerProps) {
  const router = useRouter();
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  async function handleJoin(groupId: string) {
    setJoiningGroupId(groupId);
    try {
      const result = await joinGroup({ groupId });
      if (result.success) {
        toast.success('เข้าร่วมกลุ่มสำเร็จ');
        router.push(`/student/classroom/${classroomId}`);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถเข้าร่วมกลุ่มได้';
      toast.error(message);
    } finally {
      setJoiningGroupId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">เลือกกลุ่ม</h2>
      <p className="text-sm text-muted-foreground">
        เลือกกลุ่มที่ต้องการเข้าร่วม
      </p>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            ยังไม่มีกลุ่มในห้องเรียนนี้ กรุณารอให้คุณครูสร้างกลุ่ม
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => {
            const isFull =
              maxGroupSize !== null && group.memberCount >= maxGroupSize;
            const spotsRemaining = maxGroupSize
              ? maxGroupSize - group.memberCount
              : null;

            return (
              <Card
                key={group.id}
                className={isFull ? 'opacity-60' : undefined}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{group.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Users className="size-3" />
                      {group.memberCount} คน
                    </Badge>
                    {spotsRemaining !== null && (
                      <span className="text-xs text-muted-foreground">
                        {isFull
                          ? 'เต็มแล้ว'
                          : `เหลือ ${spotsRemaining} ที่`}
                      </span>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    disabled={isFull || joiningGroupId === group.id}
                    onClick={() => handleJoin(group.id)}
                  >
                    {joiningGroupId === group.id
                      ? 'กำลังเข้าร่วม...'
                      : 'เข้าร่วม'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
