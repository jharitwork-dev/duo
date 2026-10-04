'use client';
/* eslint-disable @next/next/no-img-element -- static Figma asset */

import { useState, useTransition, type ChangeEvent, type DragEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { SUBMISSION_ACCEPT, validateSubmissionFile } from '@/lib/r2';
import { FILE_REQUIREMENT_LABEL, type FileRequirement } from '@/lib/work-page';
import {
  attachWorkPageFile,
  createWorkPageUploadUrl,
  getWorkPageFileUrl,
  removeWorkPageFile,
  type WorkPageFileDTO,
} from '@/server/actions/work-page';
import { SubmissionFileRow } from '@/components/student/submission-file-row';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';

export const MAX_WORK_PAGE_FILES = 10;
export const STORAGE_NOT_READY = 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์';

// Some OS/browser combos report an empty File.type (notably .doc/.docx) — infer from extension.
export const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  zip: 'application/zip',
  mp4: 'video/mp4',
};

export function contentTypeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? '';
}

const BADGE: Record<FileRequirement, string> = {
  none: 'bg-[rgba(15,23,42,.05)] text-cocoon-subtle',
  optional: 'bg-cocoon-blue-soft text-cocoon-blue',
  required: 'bg-[rgb(239_73_36/.12)] text-cocoon-orange',
};

export function FileRequirementBadge({ requirement, className }: { requirement: FileRequirement; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] shrink-0 items-center rounded-full px-3 text-[12px] font-bold whitespace-nowrap',
        BADGE[requirement],
        className,
      )}
    >
      {FILE_REQUIREMENT_LABEL[requirement]}
    </span>
  );
}

/** Opens a blank tab synchronously (popup blockers), then points it at the presigned URL. */
function useOpenWorkPageFile() {
  const [isPending, startTransition] = useTransition();
  function open(fileId: string) {
    const win = window.open('', '_blank');
    startTransition(async () => {
      const result = await getWorkPageFileUrl({ fileId }).catch(() => null);
      if (!result || !result.success) {
        win?.close();
        toast.error(result && !result.success ? result.error : 'ไม่สามารถเปิดไฟล์ได้');
        return;
      }
      if (win) {
        win.opener = null;
        win.location.href = result.url;
      } else {
        window.open(result.url, '_blank', 'noopener');
      }
    });
  }
  return { open, isPending };
}

/** Read-only list of work page files (teacher view / read-only states). */
export function WorkPageFileList({ files }: { files: WorkPageFileDTO[] }) {
  const { open, isPending } = useOpenWorkPageFile();
  if (files.length === 0) return null;
  return (
    <div className="space-y-[7px] lg:space-y-3">
      {files.map((f) => (
        <SubmissionFileRow
          key={f.id}
          fileName={f.fileName}
          fileSize={f.fileSize}
          action={{ kind: 'open', onOpen: () => open(f.id) }}
          disabled={isPending}
        />
      ))}
    </div>
  );
}

interface WorkPageFilesProps {
  todoId: string;
  files: WorkPageFileDTO[];
  requirement: FileRequirement;
  storageReady: boolean;
  editable: boolean;
  onChange: (files: WorkPageFileDTO[]) => void;
}

/** Files attached to the work page (hidden when the teacher set "none"). */
export function WorkPageFiles({ todoId, files, requirement, storageReady, editable, onChange }: WorkPageFilesProps) {
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WorkPageFileDTO | null>(null);
  const { open, isPending } = useOpenWorkPageFile();

  if (requirement === 'none') return null;

  const canAdd = editable && storageReady && files.length + uploading.length < MAX_WORK_PAGE_FILES;
  const busy = uploading.length > 0;

  async function uploadOne(file: File): Promise<WorkPageFileDTO | null> {
    const contentType = contentTypeOf(file);
    const presign = await createWorkPageUploadUrl({ todoId, fileName: file.name, contentType, size: file.size });
    if (!presign.success) {
      toast.error(presign.error);
      return null;
    }
    const res = await fetch(presign.url, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: file,
    }).catch(() => null);
    if (!res || !res.ok) {
      toast.error(`อัปโหลดไม่สำเร็จ: ${file.name}`);
      return null;
    }
    const attached = await attachWorkPageFile({
      todoId,
      key: presign.key,
      fileName: file.name,
      contentType,
      size: file.size,
    });
    if (!attached.success) {
      toast.error(attached.error);
      return null;
    }
    return attached.file;
  }

  async function addFiles(list: FileList | File[]) {
    if (!canAdd) return;
    const incoming = Array.from(list);
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!validateSubmissionFile(contentTypeOf(file), file.size)) {
        rejected.push(file.name);
        continue;
      }
      if (files.length + accepted.length >= MAX_WORK_PAGE_FILES) {
        toast.error(`แนบไฟล์ได้สูงสุด ${MAX_WORK_PAGE_FILES} ไฟล์`);
        break;
      }
      accepted.push(file);
    }
    if (rejected.length > 0) toast.error(`ไฟล์ไม่รองรับหรือใหญ่เกิน 10 MB: ${rejected.join(', ')}`);
    if (accepted.length === 0) return;

    setUploading(accepted.map((f) => f.name));
    let next = files;
    try {
      for (const file of accepted) {
        // Sequential uploads: the head of `uploading` is always the current file.
        const added = await uploadOne(file).catch(() => {
          toast.error(`อัปโหลดไม่สำเร็จ: ${file.name}`);
          return null;
        });
        if (added) {
          next = [...next, added];
          onChange(next);
        }
        setUploading((prev) => prev.slice(1));
      }
    } finally {
      setUploading([]);
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void addFiles(e.target.files);
    e.target.value = '';
  }

  function onDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (canAdd) setDragging(true);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const result = await removeWorkPageFile({ fileId: removeTarget.id }).catch(() => null);
    if (!result || !result.success) {
      toast.error(result && !result.success ? result.error : 'ลบไฟล์ไม่สำเร็จ');
      return;
    }
    onChange(files.filter((f) => f.id !== removeTarget.id));
    setRemoveTarget(null);
  }

  return (
    <section className="rounded-[16px] border border-[#f1ece5] bg-white p-5 lg:p-7" aria-label="ไฟล์แนบ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]">
          ไฟล์แนบ{files.length > 0 && ` (${files.length})`}
        </h2>
        <FileRequirementBadge requirement={requirement} />
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-[7px] lg:space-y-3">
          {files.map((f) => (
            <SubmissionFileRow
              key={f.id}
              fileName={f.fileName}
              fileSize={f.fileSize}
              disabled={isPending || busy}
              action={
                editable
                  ? { kind: 'local', onOpen: () => open(f.id), onRemove: () => setRemoveTarget(f) }
                  : { kind: 'open', onOpen: () => open(f.id) }
              }
            />
          ))}
        </div>
      )}

      {uploading.length > 0 && (
        <ul className="mt-3 space-y-[7px]" aria-live="polite">
          {uploading.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="flex h-[49px] items-center gap-3 rounded-[8px] border border-dashed border-cocoon-blue/40 bg-cocoon-blue-soft px-3 text-[13px] font-medium text-cocoon-blue"
            >
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              <span className="min-w-0 flex-1 truncate">กำลังอัปโหลด {name}</span>
            </li>
          ))}
        </ul>
      )}

      {editable && !storageReady && (
        <div className="mt-3 rounded-[12px] border border-dashed border-cocoon-line bg-[rgba(15,23,42,.03)] px-4 py-4 text-center">
          <p className="text-[14px] leading-normal font-bold text-cocoon-subtle">{STORAGE_NOT_READY}</p>
          <p className="mt-1 text-[12px] leading-normal font-medium text-cocoon-muted">
            {requirement === 'required'
              ? 'งานนี้ต้องแนบไฟล์ — จะส่งได้เมื่อครูตั้งค่าที่เก็บไฟล์เรียบร้อย'
              : 'ยังแนบไฟล์ไม่ได้ในตอนนี้ แต่ส่งงานเป็นข้อความได้ตามปกติ'}
          </p>
        </div>
      )}

      {editable && storageReady && (
        <label
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDragging(false);
          }}
          onDrop={onDrop}
          className={cn(
            'mt-3 flex min-h-[96px] cursor-pointer flex-col items-center justify-center rounded-[12px] border border-dashed border-cocoon-blue px-4 py-4 text-center transition-colors focus-within:ring-2 focus-within:ring-cocoon-blue/40',
            dragging ? 'bg-[rgba(73,188,255,.1)]' : 'bg-cocoon-blue-soft',
            !canAdd && 'pointer-events-none opacity-60',
          )}
        >
          <input
            type="file"
            multiple
            accept={SUBMISSION_ACCEPT}
            onChange={onInputChange}
            disabled={!canAdd}
            className="sr-only"
          />
          <img src="/figma/7b064.svg" alt="" width={36} height={36} className="size-9" />
          <span className="text-[16px] leading-normal font-bold text-cocoon-blue">เพิ่มไฟล์</span>
          <span className="text-[12px] leading-normal font-medium text-[rgba(0,105,166,.6)]">
            ลากไฟล์มาวาง หรือกดเลือกไฟล์ · PDF, DOC, รูปภาพ ไม่เกิน 10 MB ต่อไฟล์
          </span>
        </label>
      )}

      {!editable && files.length === 0 && (
        <p className="mt-2 text-[14px] leading-normal text-cocoon-muted">ไม่มีไฟล์แนบ</p>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="ลบไฟล์นี้?"
        description={removeTarget?.fileName}
        consequences={['ไฟล์จะถูกนำออกจากหน้างานนี้', 'งานที่ส่งไปแล้วจะยังเก็บไฟล์เดิมไว้']}
        confirmLabel="ลบไฟล์"
        onConfirm={confirmRemove}
      />
    </section>
  );
}
