'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { updateClassroomSettings } from '@/server/actions/classroom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from 'cn';
import { BTN_PRIMARY, BTN_TERTIARY, CARD, CARD_META, CARD_TITLE, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';
import { MemberAvatar, type MemberDisplay } from '@/components/cocoon/member-identity';
import { GROUP_MODES, GROUP_MODE_DESCRIPTIONS, GROUP_MODE_LABELS, type GroupMode } from '@/lib/group-rules';

const settingsSchema = z.object({
  name: z.string().min(1, 'กรุณาใส่ชื่อห้องเรียน').max(100),
  description: z.string().max(500).optional(),
  maxGroupSize: z.coerce.number().int().min(1).max(50).optional().or(z.literal('')),
  groupMode: z.enum(GROUP_MODES),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface ClassroomMember extends MemberDisplay {
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
  groupMode: GroupMode;
  members: ClassroomMember[];
}

export function ClassroomSettingsForm({
  classroomId,
  name,
  description,
  maxGroupSize,
  groupMode,
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
      groupMode,
    },
  });

  async function onSubmit(data: SettingsFormData) {
    try {
      const result = await updateClassroomSettings({
        classroomId,
        name: data.name,
        description: data.description || undefined,
        maxGroupSize:
          data.maxGroupSize && data.maxGroupSize !== ('' as never)
            ? Number(data.maxGroupSize)
            : null,
        groupMode: data.groupMode,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('บันทึกการตั้งค่าแล้ว');
      router.refresh();
    } catch {
      toast.error('ไม่สามารถบันทึกการตั้งค่าได้');
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

            <fieldset className="space-y-2">
              <legend className={LABEL}>การจัดกลุ่ม</legend>
              <div className="grid gap-2 pt-2">
                {GROUP_MODES.map((mode) => (
                  <label
                    key={mode}
                    className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-[#f1ece5] bg-white px-4 py-3 has-checked:border-cocoon-blue has-checked:bg-cocoon-blue-soft"
                  >
                    <input
                      type="radio"
                      value={mode}
                      className="mt-1 size-4 shrink-0 accent-cocoon-blue"
                      {...register('groupMode')}
                    />
                    <span className="min-w-0">
                      <span className="block text-[15px] leading-normal font-bold text-cocoon-ink">
                        {GROUP_MODE_LABELS[mode]}
                      </span>
                      <span className="block text-[13px] leading-normal font-medium text-cocoon-muted">
                        {GROUP_MODE_DESCRIPTIONS[mode]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" disabled={isSubmitting} className={cn(BTN_PRIMARY, 'w-full lg:w-auto')}>
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </Button>
          </form>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={CARD_TITLE}>นักเรียน ({studentMembers.length})</h2>
        <p className={CARD_META}>จัดกลุ่ม ย้ายกลุ่ม และนำนักเรียนออก ได้ที่แท็บ นักเรียน</p>
        {studentMembers.length > 0 && (
          <div className="mt-4 flex -space-x-2">
            {studentMembers.slice(0, 8).map((m) => (
              <MemberAvatar key={m.id} name={m.name} imageUrl={m.imageUrl} className="ring-2 ring-white" />
            ))}
            {studentMembers.length > 8 && (
              <span className="flex size-9 items-center justify-center rounded-full bg-cocoon-cream text-[12px] font-bold text-cocoon-blue ring-2 ring-white">
                +{studentMembers.length - 8}
              </span>
            )}
          </div>
        )}
        <Link
          href={`/teacher/classroom/${classroomId}?tab=students`}
          className={cn(BTN_TERTIARY, 'mt-4 inline-flex h-10 items-center text-[14px]')}
        >
          จัดการนักเรียน
        </Link>
      </section>
    </div>
  );
}
