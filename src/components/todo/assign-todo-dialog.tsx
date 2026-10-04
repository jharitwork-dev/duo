'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTodo } from '@/server/actions/todo';
import type { FileRequirement } from '@/lib/work-page';
import { FileRequirementSelect } from './file-requirement-select';
import { DeadlineInput } from '@/components/deadline/deadline-input';
import { BTN_PRIMARY, DIALOG_PANEL, DIALOG_TITLE, INPUT, LABEL } from '@/components/cocoon/ui';

export type GroupOption = { id: string; name: string };

type SubmissionMode = 'group' | 'individual';
const MODE_ITEMS: { value: SubmissionMode; label: string }[] = [
  { value: 'group', label: 'กลุ่ม' },
  { value: 'individual', label: 'รายบุคคล' },
];

/** Native checkbox list with a top "ทุกกลุ่ม" toggle. */
export function GroupChecklist({
  groups,
  selected,
  onChange,
  idPrefix,
  disabled,
}: {
  groups: GroupOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const allChecked = groups.length > 0 && groups.every((g) => selected.includes(g.id));

  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selected.filter((s) => s !== id), id] : selected.filter((s) => s !== id));
  };

  if (groups.length === 0) {
    return <p className="text-[14px] font-medium text-cocoon-muted">ห้องเรียนนี้ยังไม่มีกลุ่ม</p>;
  }

  return (
    <div className="space-y-2 rounded-[12px] border border-[#f1ece5] bg-[#fffaf3] p-3">
      <label
        htmlFor={`${idPrefix}-all`}
        className="flex cursor-pointer items-center gap-3 border-b border-[#f1ece5] pb-2 text-[15px] font-bold text-cocoon-ink"
      >
        <input
          id={`${idPrefix}-all`}
          type="checkbox"
          className="size-4 accent-cocoon-blue"
          checked={allChecked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? groups.map((g) => g.id) : [])}
        />
        ทุกกลุ่ม
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => (
          <label
            key={g.id}
            htmlFor={`${idPrefix}-${g.id}`}
            className="flex cursor-pointer items-center gap-3 text-[15px] font-medium text-cocoon-ink"
          >
            <input
              id={`${idPrefix}-${g.id}`}
              type="checkbox"
              className="size-4 accent-cocoon-blue"
              checked={selected.includes(g.id)}
              disabled={disabled}
              onChange={(e) => toggle(g.id, e.target.checked)}
            />
            <span className="truncate">{g.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * D-2: create one to-do for several groups at once. Each checked group gets its own
 * independent copy (shared assignment_id on the server, no sync afterwards).
 */
export function AssignTodoDialog({
  phaseId,
  phaseName,
  phaseDeadline = null,
  groups,
  defaultGroupIds,
  trigger,
  triggerClassName,
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: {
  phaseId: string;
  phaseName: string;
  /** Inherited phase deadline, hinted when no to-do deadline is set. */
  phaseDeadline?: Date | string | null;
  groups: GroupOption[];
  defaultGroupIds: string[];
  /** Content of the trigger button (omit when controlled via open/onOpenChange). */
  trigger?: ReactNode;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const [title, setTitle] = useState('');
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('group');
  const [fileRequirement, setFileRequirement] = useState<FileRequirement>('optional');
  const [groupIds, setGroupIds] = useState<string[]>(defaultGroupIds);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setTitle('');
    setSubmissionMode('group');
    setFileRequirement('optional');
    setGroupIds(defaultGroupIds);
    setDeadline(null);
  };

  const setOpen = (next: boolean) => {
    if (!next) reset();
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const canSubmit = title.trim().length > 0 && groupIds.length > 0 && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const result = await createTodo({
          phaseId,
          groupIds,
          title: title.trim(),
          submissionMode,
          fileRequirement,
          deadline,
        });
        toast.success(`เพิ่มงานให้ ${result.todoIds.length} กลุ่มแล้ว`);
        setOpen(false);
        onCreated?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'เพิ่มงานไม่สำเร็จ');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger render={<button type="button" className={triggerClassName} />}>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className={DIALOG_PANEL}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className={DIALOG_TITLE}>เพิ่มงาน</DialogTitle>
            <DialogDescription className="text-center text-[14px] text-cocoon-muted">
              {phaseName} · แต่ละกลุ่มได้งานแยกของตัวเอง
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`assign-title-${phaseId}`} className={LABEL}>ชื่องาน *</Label>
              <Input
                id={`assign-title-${phaseId}`}
                className={INPUT}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ชื่องาน"
                disabled={isPending}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className={LABEL}>การส่งงาน</Label>
              <Select
                items={MODE_ITEMS}
                value={submissionMode}
                onValueChange={(v) => v && setSubmissionMode(v as SubmissionMode)}
              >
                <SelectTrigger className="h-12 w-full rounded-[12px] border-[#f1ece5] bg-[#fffaf3] text-[16px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_ITEMS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FileRequirementSelect
              id={`assign-file-requirement-${phaseId}`}
              value={fileRequirement}
              onChange={setFileRequirement}
              disabled={isPending}
            />

            <DeadlineInput
              idPrefix={`assign-deadline-${phaseId}`}
              label="กำหนดส่ง (ไม่บังคับ)"
              value={deadline}
              inheritedDeadline={phaseDeadline}
              onChange={setDeadline}
              disabled={isPending}
            />

            <div className="space-y-2">
              <span className={LABEL}>มอบหมายให้กลุ่ม *</span>
              <GroupChecklist
                groups={groups}
                selected={groupIds}
                onChange={setGroupIds}
                idPrefix={`assign-${phaseId}`}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={!canSubmit} className={cn(BTN_PRIMARY, 'w-full')}>
              {isPending ? 'กำลังเพิ่ม...' : 'เพิ่มงาน'}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 text-[16px] font-bold text-cocoon-blue hover:underline"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
