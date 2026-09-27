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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    resolver: zodResolver(formSchema),
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
          data.maxGroupSize && data.maxGroupSize !== ''
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
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>สร้างห้องเรียนใหม่</CardTitle>
        <CardDescription>
          กรอกข้อมูลเพื่อสร้างห้องเรียน นักเรียนจะสามารถเข้าร่วมด้วยรหัสเชิญ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อห้องเรียน *</Label>
            <Input
              id="name"
              placeholder="เช่น Innovator's Academy 2024"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">คำอธิบาย</Label>
            <Textarea
              id="description"
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
            <Label htmlFor="maxGroupSize">
              จำนวนสมาชิกสูงสุดต่อกลุ่ม
            </Label>
            <Input
              id="maxGroupSize"
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'กำลังสร้าง...' : 'สร้างห้องเรียน'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
