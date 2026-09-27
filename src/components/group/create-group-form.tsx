'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createGroup } from '@/server/actions/group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

interface CreateGroupFormProps {
  classroomId: string;
}

export function CreateGroupForm({ classroomId }: CreateGroupFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createGroup({ classroomId, name: name.trim() });
      if (result.success) {
        toast.success('สร้างกลุ่มสำเร็จ');
        setName('');
        setOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error('ไม่สามารถสร้างกลุ่มได้');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 size-4" />
          สร้างกลุ่ม
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>สร้างกลุ่มใหม่</DialogTitle>
            <DialogDescription>
              ตั้งชื่อกลุ่มสำหรับนักเรียนในห้องเรียนนี้
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">ชื่อกลุ่ม *</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น กลุ่ม A"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'กำลังสร้าง...' : 'สร้างกลุ่ม'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
