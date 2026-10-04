'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LABEL } from '@/components/cocoon/ui';
import { FILE_REQUIREMENTS, FILE_REQUIREMENT_LABEL, type FileRequirement } from '@/lib/work-page';

const ITEMS = FILE_REQUIREMENTS.map((value) => ({ value, label: FILE_REQUIREMENT_LABEL[value] }));

/** Teacher control for todos.file_requirement (none / optional / required). */
export function FileRequirementSelect({
  id,
  value,
  onChange,
  disabled,
  label = 'ไฟล์แนบ',
}: {
  id: string;
  label?: string;
  value: FileRequirement;
  onChange: (value: FileRequirement) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={LABEL}>
        {label}
      </Label>
      <Select
        items={ITEMS}
        value={value}
        onValueChange={(v) => v && onChange(v as FileRequirement)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-12 min-h-11 w-full rounded-[12px] border-[#f1ece5] bg-[#fffaf3] text-[16px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
