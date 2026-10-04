'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from 'cn';
import { applyTemplate, deleteTemplate, updateTemplate } from '@/server/actions/template';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BTN_PRIMARY,
  CARD,
  CARD_TITLE,
  DIALOG_PANEL,
  DIALOG_TITLE,
  INPUT,
  LABEL,
  TEXTAREA,
} from '@/components/cocoon/ui';
import { OverflowMenu } from '@/components/cocoon/overflow-menu';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { GroupChecklist, type GroupOption } from '@/components/todo/assign-todo-dialog';

interface Template {
  id: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
}

interface TemplatePickerProps {
  classroomId: string;
  templates: Template[];
  groups: GroupOption[];
}

/**
 * Applies a template to an EMPTY classroom: creates the classroom phases and, for the
 * checked groups, one copy of each template to-do. Uncheck every group for phases only.
 */
export function TemplatePicker({ classroomId, templates, groups }: TemplatePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [groupIds, setGroupIds] = useState<string[]>(() => groups.map((g) => g.id));

  const builtInTemplates = templates.filter((t) => t.isBuiltIn);
  const customTemplates = templates.filter((t) => !t.isBuiltIn);

  function handleApply(templateId: string) {
    startTransition(async () => {
      try {
        const result = await applyTemplate({ classroomId, templateId, groupIds });
        toast.success(
          result.todoCount > 0
            ? `ใช้ Template สำเร็จ · ${result.phaseCount} Phase · ${result.todoCount} งาน`
            : `ใช้ Template สำเร็จ · ${result.phaseCount} Phase`,
        );
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <h2 className={CARD_TITLE}>เลือก Template เริ่มต้น</h2>

      {groups.length > 0 && (
        <div className="space-y-2">
          <span className={LABEL}>เพิ่มงานจากเทมเพลตให้กลุ่ม</span>
          <GroupChecklist
            groups={groups}
            selected={groupIds}
            onChange={setGroupIds}
            idPrefix="template-groups"
            disabled={isPending}
          />
          {groupIds.length === 0 && (
            <p className="text-[13px] font-medium text-cocoon-muted">ไม่ได้เลือกกลุ่ม — จะสร้างเฉพาะ Phase</p>
          )}
        </div>
      )}

      {builtInTemplates.length > 0 && (
        <TemplateGroup title="Template พื้นฐาน" templates={builtInTemplates} onApply={handleApply} isPending={isPending} />
      )}

      {customTemplates.length > 0 && (
        <TemplateGroup
          title="Template ของคุณ"
          templates={customTemplates}
          onApply={handleApply}
          isPending={isPending}
          editable
        />
      )}

      {templates.length === 0 && (
        <div className={cn(CARD, 'text-center text-[14px] font-medium text-cocoon-muted')}>
          ยังไม่มี Template ให้เลือก
        </div>
      )}
    </div>
  );
}

function TemplateGroup({
  title,
  templates,
  onApply,
  isPending,
  editable = false,
}: {
  title: string;
  templates: Template[];
  onApply: (id: string) => void;
  isPending: boolean;
  editable?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[14px] leading-normal font-bold text-cocoon-muted">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onApply={onApply}
            isPending={isPending}
            editable={editable}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onApply,
  isPending,
  editable,
}: {
  template: Template;
  onApply: (id: string) => void;
  isPending: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className={cn(CARD, 'flex flex-col gap-3')}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[18px] leading-normal font-bold break-words text-cocoon-ink">{template.name}</p>
        {editable && (
          <OverflowMenu
            className="-mt-2 -mr-2"
            label={`ตัวเลือกของ ${template.name}`}
            items={[
              { label: 'แก้ไข', onSelect: () => setEditOpen(true) },
              { label: 'ลบ', destructive: true, onSelect: () => setDeleteOpen(true) },
            ]}
          />
        )}
      </div>
      {template.description && (
        <p className="text-[14px] leading-normal font-medium text-cocoon-muted">{template.description}</p>
      )}
      <Button onClick={() => onApply(template.id)} disabled={isPending} className={cn(BTN_PRIMARY, 'mt-auto w-full')}>
        {isPending ? 'กำลังใช้...' : 'ใช้เทมเพลตนี้'}
      </Button>

      {editable && (
        <>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className={DIALOG_PANEL}>
              {editOpen && <EditTemplateForm template={template} onDone={() => setEditOpen(false)} />}
            </DialogContent>
          </Dialog>
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={`ลบเทมเพลต "${template.name}"?`}
            consequences={['เทมเพลตนี้จะหายจากรายการ', 'ห้องเรียนที่เคยใช้เทมเพลตนี้ไม่ได้รับผลกระทบ']}
            confirmLabel="ลบเทมเพลต"
            onConfirm={async () => {
              try {
                await deleteTemplate({ templateId: template.id });
                toast.success(`ลบเทมเพลต ${template.name} แล้ว`);
                setDeleteOpen(false);
                router.refresh();
              } catch {
                toast.error('ลบเทมเพลตไม่สำเร็จ');
              }
            }}
          />
        </>
      )}
    </div>
  );
}

function EditTemplateForm({ template, onDone }: { template: Template; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      const result = await updateTemplate({ templateId: template.id, name: name.trim(), description });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('บันทึกเทมเพลตแล้ว');
      onDone();
      router.refresh();
    } catch {
      toast.error('บันทึกเทมเพลตไม่สำเร็จ');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle className={DIALOG_TITLE}>แก้ไขเทมเพลต</DialogTitle>
        <DialogDescription className="text-center text-[14px] text-cocoon-muted">
          เปลี่ยนชื่อและคำอธิบาย (โครงสร้าง Phase และงานไม่เปลี่ยน)
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="template-name" className={LABEL}>ชื่อเทมเพลต *</Label>
        <Input id="template-name" className={INPUT} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="template-description" className={LABEL}>คำอธิบาย</Label>
        <Textarea
          id="template-description"
          className={TEXTAREA}
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button type="submit" disabled={pending || !name.trim()} className={cn(BTN_PRIMARY, 'w-full disabled:opacity-50')}>
        {pending ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </form>
  );
}
