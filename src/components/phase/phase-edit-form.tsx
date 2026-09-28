'use client';

import { cn } from 'cn';
import { BTN_PRIMARY, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { updatePhase } from '@/server/actions/phase';
import { formatDateShort } from '@/lib/format';

type Phase = {
  id: string;
  name: string;
  description: string | null;
  isFreeAccess: boolean;
  deadline: Date | null;
};

export function PhaseEditForm({ phase }: { phase: Phase }) {
  const [name, setName] = useState(phase.name);
  const [description, setDescription] = useState(phase.description ?? '');
  const [isFreeAccess, setIsFreeAccess] = useState(phase.isFreeAccess);
  const [deadline, setDeadline] = useState<Date | null>(
    phase.deadline ? new Date(phase.deadline) : null,
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    startTransition(async () => {
      await updatePhase({
        phaseId: phase.id,
        name,
        description: description || undefined,
        isFreeAccess,
        deadline: deadline ?? null,
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 rounded-[12px] bg-cocoon-cream/60 p-4 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-4 lg:space-y-0">
      <div className="space-y-2">
        <Label htmlFor={`phase-name-${phase.id}`} className={LABEL}>ชื่อ Phase</Label>
        <Input
          id={`phase-name-${phase.id}`}
          className={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          placeholder="ชื่อ Phase"
        />
      </div>

      <div className="space-y-2 lg:col-span-2 lg:row-start-2">
        <Label htmlFor={`phase-desc-${phase.id}`} className={LABEL}>รายละเอียด</Label>
        <Textarea
          id={`phase-desc-${phase.id}`}
          className={TEXTAREA}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleSave}
          placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label className={LABEL}>กำหนดส่ง</Label>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className={cn(INPUT, 'w-full justify-start text-left font-normal text-cocoon-ink')}>
                <CalendarIcon className="mr-2 size-4" />
                {deadline ? formatDateShort(deadline) : 'เลือกวันกำหนดส่ง'}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={deadline ?? undefined}
              onSelect={(date) => {
                setDeadline(date ?? null);
                // Auto-save after date selection
                startTransition(async () => {
                  await updatePhase({
                    phaseId: phase.id,
                    deadline: date ?? null,
                  });
                  router.refresh();
                });
              }}
            />
            {deadline && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setDeadline(null);
                    startTransition(async () => {
                      await updatePhase({
                        phaseId: phase.id,
                        deadline: null,
                      });
                      router.refresh();
                    });
                  }}
                >
                  ล้างกำหนดส่ง
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-3 lg:col-span-2">
        <Switch
          checked={isFreeAccess}
          onCheckedChange={(checked) => {
            setIsFreeAccess(checked);
            startTransition(async () => {
              await updatePhase({
                phaseId: phase.id,
                isFreeAccess: checked,
              });
              router.refresh();
            });
          }}
        />
        <Label className="text-[14px] font-medium text-cocoon-ink">เข้าถึงอิสระ (ไม่ต้องรออนุมัติ)</Label>
      </div>

      <Button
        onClick={handleSave}
        disabled={isPending}
        className={cn(BTN_PRIMARY, 'h-10 text-[14px] lg:col-span-2 lg:w-fit')}
      >
        {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
      </Button>
    </div>
  );
}
