'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { applyTemplate } from '@/server/actions/template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
}

interface TemplatePickerProps {
  groupId: string;
  templates: Template[];
}

export function TemplatePicker({ groupId, templates }: TemplatePickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const builtInTemplates = templates.filter((t) => t.isBuiltIn);
  const customTemplates = templates.filter((t) => !t.isBuiltIn);

  function handleApply(templateId: string) {
    startTransition(async () => {
      try {
        await applyTemplate({ groupId, templateId });
        toast.success('ใช้ Template สำเร็จ');
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">เลือก Template เริ่มต้น</h2>

      {builtInTemplates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-medium">
            Template พื้นฐาน
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {builtInTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onApply={handleApply}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {builtInTemplates.length > 0 && customTemplates.length > 0 && (
        <Separator />
      )}

      {customTemplates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-medium">
            Template ของคุณ
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onApply={handleApply}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 && (
        <p className="text-muted-foreground text-center text-sm">
          ยังไม่มี Template ให้เลือก
        </p>
      )}
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{template.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {template.description && (
          <p className="text-muted-foreground text-sm">
            {template.description}
          </p>
        )}
        <Button
          size="sm"
          onClick={() => onApply(template.id)}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? 'กำลังใช้...' : 'ใช้ Template'}
        </Button>
      </CardContent>
    </Card>
  );
}
