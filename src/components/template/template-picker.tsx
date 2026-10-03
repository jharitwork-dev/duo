'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from 'cn';
import { applyTemplate } from '@/server/actions/template';
import { Button } from '@/components/ui/button';
import { BTN_PRIMARY, CARD, CARD_TITLE, LABEL } from '@/components/cocoon/ui';
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
        <TemplateGroup title="Template ของคุณ" templates={customTemplates} onApply={handleApply} isPending={isPending} />
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
}: {
  title: string;
  templates: Template[];
  onApply: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[14px] leading-normal font-bold text-cocoon-muted">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} onApply={onApply} isPending={isPending} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onApply,
  isPending,
}: {
  template: Template;
  onApply: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div className={cn(CARD, 'flex flex-col gap-3')}>
      <p className="text-[18px] leading-normal font-bold text-cocoon-ink">{template.name}</p>
      {template.description && (
        <p className="text-[14px] leading-normal font-medium text-cocoon-muted">{template.description}</p>
      )}
      <Button onClick={() => onApply(template.id)} disabled={isPending} className={cn(BTN_PRIMARY, 'mt-auto w-full')}>
        {isPending ? 'กำลังใช้...' : 'ใช้เทมเพลตนี้'}
      </Button>
    </div>
  );
}
