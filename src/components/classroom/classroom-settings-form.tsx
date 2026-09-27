'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { updateClassroomSettings, removeStudent } from '@/server/actions/classroom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Trash2 } from 'lucide-react';

const settingsSchema = z.object({
  name: z.string().min(1, 'กรุณาใส่ชื่อห้องเรียน').max(100),
  description: z.string().max(500).optional(),
  maxGroupSize: z.coerce.number().int().min(1).max(50).optional().or(z.literal('')),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface ClassroomMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date | null;
}

interface ClassroomSettingsFormProps {
  classroomId: string;
  name: string;
  description: string;
  maxGroupSize: number | null;
  members: ClassroomMember[];
}

export function ClassroomSettingsForm({
  classroomId,
  name,
  description,
  maxGroupSize,
  members,
}: ClassroomSettingsFormProps) {
  const router = useRouter();
  const studentMembers = members.filter((m) => m.role === 'student');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema) as never,
    defaultValues: {
      name,
      description: description ?? '',
      maxGroupSize: maxGroupSize ?? undefined,
    },
  });

  async function onSubmit(data: SettingsFormData) {
    try {
      await updateClassroomSettings({
        classroomId,
        name: data.name,
        description: data.description || undefined,
        maxGroupSize:
          data.maxGroupSize && data.maxGroupSize !== ('' as never)
            ? Number(data.maxGroupSize)
            : null,
      });
      toast.success('บันทึกการตั้งค่าแล้ว');
      router.refresh();
    } catch (error) {
      toast.error('ไม่สามารถบันทึกการตั้งค่าได้');
    }
  }

  async function handleRemoveStudent(studentUserId: string) {
    try {
      await removeStudent({ classroomId, userId: studentUserId });
      toast.success('ลบนักเรียนออกจากห้องเรียนแล้ว');
      router.refresh();
    } catch (error) {
      toast.error('ไม่สามารถลบนักเรียนได้');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ตั้งค่าห้องเรียน</CardTitle>
          <CardDescription>แก้ไขข้อมูลห้องเรียน</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">ชื่อห้องเรียน *</Label>
              <Input id="settings-name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-description">คำอธิบาย</Label>
              <Textarea
                id="settings-description"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-maxGroupSize">
                จำนวนสมาชิกสูงสุดต่อกลุ่ม
              </Label>
              <Input
                id="settings-maxGroupSize"
                type="number"
                min={1}
                max={50}
                placeholder="ไม่จำกัด"
                {...register('maxGroupSize')}
              />
              {errors.maxGroupSize && (
                <p className="text-sm text-destructive">
                  {errors.maxGroupSize.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            นักเรียน ({studentMembers.length})
          </CardTitle>
          <CardDescription>
            รายชื่อนักเรียนในห้องเรียนนี้
          </CardDescription>
        </CardHeader>
        <CardContent>
          {studentMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีนักเรียนในห้องเรียนนี้
            </p>
          ) : (
            <div className="space-y-2">
              {studentMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm">{member.userId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStudent(member.userId)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
