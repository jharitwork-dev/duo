'use client';

// Create / edit a learning material ("สื่อการเรียน", 261113-lz7): title, where it shows (whole
// classroom or one phase), plain-text description, optional http(s) link and files. No submission.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BTN_PRIMARY, DIALOG_PANEL, DIALOG_TITLE, INPUT, LABEL, TEXTAREA } from '@/components/cocoon/ui';
import { StagedAttachmentPicker } from '@/components/todo/staged-attachment-picker';
import { MATERIAL_ERRORS, normalizeMaterialLinkUrl } from '@/lib/material-files';
import type { MaterialItem } from '@/server/queries/material';
import { createMaterial, updateMaterial } from '@/server/actions/material';
import { MaterialFileManager } from './material-file-manager';
import { uploadMaterialFile } from './upload-material-file';

const CLASSROOM_VALUE = '__classroom__';

export interface MaterialPhaseOption {
  id: string;
  name: string;
}

export function MaterialDialog({
  classroomId,
  phases,
  material,
  open,
  onOpenChange,
}: {
  classroomId: string;
  /** Active (non-archived) phases in order. */
  phases: MaterialPhaseOption[];
  /** Edit mode when set; create mode otherwise. */
  material?: MaterialItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_PANEL, 'max-h-[90vh] overflow-y-auto')}>
        {/* Remount the form on every open so fields reset to the current material. */}
        {open && (
          <MaterialForm
            classroomId={classroomId}
            phases={phases}
            material={material ?? null}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MaterialForm({
  classroomId,
  phases,
  material,
  onClose,
}: {
  classroomId: string;
  phases: MaterialPhaseOption[];
  material: MaterialItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = material !== null;
  const [title, setTitle] = useState(material?.title ?? '');
  const [description, setDescription] = useState(material?.description ?? '');
  const [linkUrl, setLinkUrl] = useState(material?.linkUrl ?? '');
  const [target, setTarget] = useState<string>(material?.phaseId ?? CLASSROOM_VALUE);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const idBase = `material-${material?.id ?? classroomId}`;

  // Keep an archived current phase selectable in edit mode so saving does not silently move it.
  const targetItems = [
    { value: CLASSROOM_VALUE, label: 'ทั้งห้องเรียน' },
    ...phases.map((p) => ({ value: p.id, label: p.name })),
    ...(material?.phaseId && !phases.some((p) => p.id === material.phaseId)
      ? [{ value: material.phaseId, label: `${material.phaseName ?? 'Phase'} (เก็บถาวร)` }]
      : []),
  ];

  const canSubmit = title.trim().length > 0 && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const link = normalizeMaterialLinkUrl(linkUrl);
    if (!link.ok) {
      setLinkError(MATERIAL_ERRORS.badLink);
      return;
    }
    setLinkError(null);
    startTransition(async () => {
      try {
        const fields = {
          title: title.trim(),
          description,
          linkUrl: link.url,
          phaseId: target === CLASSROOM_VALUE ? null : target,
        };
        if (isEdit) {
          const result = await updateMaterial({ materialId: material.id, ...fields });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success('บันทึกสื่อการเรียนแล้ว');
        } else {
          const result = await createMaterial({ classroomId, ...fields });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          let failedUploads = 0;
          for (const file of stagedFiles) {
            const uploaded = await uploadMaterialFile(file, result.materialId);
            if (!uploaded.success) {
              failedUploads++;
              toast.error(`${file.name}: ${uploaded.error}`);
            }
          }
          toast.success('เพิ่มสื่อการเรียนแล้ว');
          if (failedUploads > 0) toast.error(`สร้างสื่อการเรียนแล้ว แต่แนบไฟล์ไม่สำเร็จ ${failedUploads} ไฟล์`);
        }
        onClose();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className={DIALOG_TITLE}>{isEdit ? 'แก้ไขสื่อการเรียน' : 'เพิ่มสื่อการเรียน'}</DialogTitle>
        <DialogDescription className="text-center text-[14px] text-cocoon-muted">
          นักเรียนทุกกลุ่มเห็นสื่อนี้ · ไม่ต้องส่งงาน และไม่นับในความคืบหน้า
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-title`} className={LABEL}>
            ชื่อ *
          </Label>
          <Input
            id={`${idBase}-title`}
            className={INPUT}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น สไลด์บทที่ 1"
            maxLength={200}
            disabled={isPending}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label className={LABEL}>แสดงใน</Label>
          <Select items={targetItems} value={target} onValueChange={(v) => v && setTarget(v as string)}>
            <SelectTrigger className="h-12 w-full rounded-[12px] border-[#f1ece5] bg-[#fffaf3] text-[16px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idBase}-description`} className={LABEL}>
            รายละเอียด
          </Label>
          <Textarea
            id={`${idBase}-description`}
            className={TEXTAREA}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="คำอธิบายสำหรับนักเรียน (ข้อความธรรมดา)"
            rows={4}
            maxLength={5000}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idBase}-link`} className={LABEL}>
            ลิงก์
          </Label>
          <Input
            id={`${idBase}-link`}
            className={INPUT}
            type="url"
            inputMode="url"
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              if (linkError) setLinkError(null);
            }}
            placeholder="https://..."
            disabled={isPending}
            aria-invalid={linkError ? true : undefined}
          />
          {linkError && <p className="text-[12px] font-bold text-[#e8590c]">{linkError}</p>}
        </div>

        {isEdit ? (
          <MaterialFileManager materialId={material.id} files={material.files} />
        ) : (
          <div className="space-y-2">
            <span className={LABEL}>ไฟล์ (ไม่บังคับ)</span>
            <StagedAttachmentPicker files={stagedFiles} onChange={setStagedFiles} disabled={isPending} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!canSubmit} className={cn(BTN_PRIMARY, 'w-full')}>
          {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มสื่อการเรียน'}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 text-[16px] font-bold text-cocoon-blue hover:underline"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
