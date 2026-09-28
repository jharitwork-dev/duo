'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { createClassroom } from '@/server/actions/classroom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from 'cn';
import { BTN_PRIMARY, CARD, CARD_META, CARD_TITLE, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';

const formSchema = z.object({
  name: z.string().min(1, 'กรุณาใส่ชื่อห้องเรียน').max(100),
  description: z.string().max(500).optional(),
  maxGroupSize: z.coerce.number().int().min(1).max(50).optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

export function CreateClassroomForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      name: '',
      description: '',
    },
  });

  async function onSubmit(data: FormData) {
    try {
      const result = await createClassroom({
        name: data.name,
        description: data.description || undefined,
        maxGroupSize:
          data.maxGroupSize && data.maxGroupSize !== ('' as never)
            ? Number(data.maxGroupSize)
            : undefined,
      });

      if (result.success) {
        toast.success('สร้างห้องเรียนสำเร็จ');
        router.push(`/teacher/classroom/${result.classroomId}`);
      }
    } catch (error) {
      toast.error('ไม่สามารถสร้างห้องเรียนได้');
    }
  }

  return (
    <section className={CARD}>
      <h2 className={CARD_TITLE}>ข้อมูลห้องเรียน</h2>
      <p className={CARD_META}>กรอกข้อมูลเพื่อสร้างห้องเรียน นักเรียนจะสามารถเข้าร่วมด้วยรหัสเชิญ</p>
      <div className="mt-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className={LABEL}>ชื่อห้องเรียน *</Label>
            <Input
              id="name"
              className={INPUT}
              placeholder="เช่น Innovator's Academy 2024"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className={LABEL}>คำอธิบาย</Label>
            <Textarea
              id="description"
              className={TEXTAREA}
              placeholder="รายละเอียดเกี่ยวกับห้องเรียนนี้ (ไม่บังคับ)"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxGroupSize" className={LABEL}>
              จำนวนสมาชิกสูงสุดต่อกลุ่ม
            </Label>
            <Input
              id="maxGroupSize"
              className={INPUT}
              type="number"
              min={1}
              max={50}
              placeholder="ไม่จำกัด (ค่าเริ่มต้น)"
              {...register('maxGroupSize')}
            />
            {errors.maxGroupSize && (
              <p className="text-sm text-destructive">
                {errors.maxGroupSize.message}
              </p>
            )}
          </div>

          <Button type="submit" className={cn(BTN_PRIMARY, 'w-full')} disabled={isSubmitting}>
            {isSubmitting ? 'กำลังสร้าง...' : 'สร้างห้องเรียน'}
          </Button>
        </form>
      </div>
    </section>
  );
}
