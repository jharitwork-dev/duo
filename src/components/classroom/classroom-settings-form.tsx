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
import { cn } from 'cn';
import { BTN_PRIMARY, CARD, CARD_META, CARD_TITLE, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';
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
    // `contents`: both cards join the parent grid (settings tab is 2 columns at lg).
    <div className="contents">
      <section className={CARD}>
        <h2 className={CARD_TITLE}>ตั้งค่าห้องเรียน</h2>
        <p className={CARD_META}>แก้ไขข้อมูลห้องเรียน</p>
        <div className="mt-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="settings-name" className={LABEL}>ชื่อห้องเรียน *</Label>
              <Input id="settings-name" className={INPUT} {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-description" className={LABEL}>คำอธิบาย</Label>
              <Textarea
                id="settings-description"
                className={TEXTAREA}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-maxGroupSize" className={LABEL}>
                จำนวนสมาชิกสูงสุดต่อกลุ่ม
              </Label>
              <Input
                id="settings-maxGroupSize"
                className={INPUT}
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

            <Button type="submit" disabled={isSubmitting} className={cn(BTN_PRIMARY, 'w-full lg:w-auto')}>
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </Button>
          </form>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={CARD_TITLE}>นักเรียน ({studentMembers.length})</h2>
        <p className={CARD_META}>รายชื่อนักเรียนในห้องเรียนนี้</p>
        <div className="mt-4">
          {studentMembers.length === 0 ? (
            <p className="text-[14px] text-cocoon-muted">
              ยังไม่มีนักเรียนในห้องเรียนนี้
            </p>
          ) : (
            <div className="space-y-2">
              {studentMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-[12px] border border-[#e4e8ee] bg-[#fafbfc] px-4 py-3"
                >
                  <span className="truncate text-[14px] font-medium text-cocoon-ink">{member.userId}</span>
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
        </div>
      </section>
    </div>
  );
}
