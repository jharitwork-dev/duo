'use client';

// Teacher list + upload + open + delete for a classroom-level task's files (261004-j6h).
// Modeled on TodoAttachmentManager; changes reach every group copy that has not edited its files.
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Paperclip } from 'lucide-react';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { LABEL } from '@/components/cocoon/ui';
import { fileTypeTag, formatFileSize } from '@/lib/format';
import { ATTACHMENT_ACCEPT } from '@/lib/r2';
import { ATTACHMENT_ERRORS, ATTACHMENT_HINT, MAX_ATTACHMENTS_PER_TODO } from '@/lib/todo-attachments';
import { getClassroomTaskFileUrl, removeClassroomTaskFile } from '@/server/actions/classroom-task';
import { uploadClassroomTaskFile } from './upload-classroom-task-file';

export interface ClassroomTaskFile {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

const ROW = 'flex items-center gap-3 rounded-[10px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2 lg:px-4';
const ROW_BTN =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] px-2 text-[14px] font-bold hover:bg-cocoon-blue-soft disabled:opacity-50';

function FileRow({ file, onDelete }: { file: ClassroomTaskFile; onDelete: (f: ClassroomTaskFile) => void }) {
  const [opening, startOpen] = useTransition();

  const open = () => {
    startOpen(async () => {
      try {
        const result = await getClassroomTaskFileUrl({ fileId: file.id });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        window.open(result.url, '_blank');
      } catch {
        toast.error('ไม่สามารถเปิดไฟล์ได้');
      }
    });
  };

  return (
    <li className={ROW}>
      <span className="w-9 shrink-0 truncate text-[11px] leading-normal font-bold text-[#f04a24] lg:text-[12px]">
        {fileTypeTag(file.fileName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-cocoon-ink">{file.fileName}</p>
        <p className="text-[12px] text-cocoon-muted">{formatFileSize(file.fileSize)}</p>
      </div>
      <button
        type="button"
        onClick={open}
        disabled={opening}
        aria-label={`เปิด ${file.fileName}`}
        className={cn(ROW_BTN, 'text-cocoon-blue')}
      >
        เปิด
      </button>
      <button
        type="button"
        onClick={() => onDelete(file)}
        aria-label={`ลบ ${file.fileName}`}
        className={cn(ROW_BTN, 'text-[#e8590c] hover:bg-[#fff1e8]')}
      >
        ลบ
      </button>
    </li>
  );
}

export function ClassroomTaskFileManager({
  classroomTaskId,
  files,
  onChanged,
}: {
  classroomTaskId: string;
  files: ClassroomTaskFile[];
  /** Called after an upload / delete so the parent can refresh its file list. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<ClassroomTaskFile | null>(null);

  const total = files.length;
  const busy = uploading.length > 0;
  const full = total >= MAX_ATTACHMENTS_PER_TODO;

  const refresh = () => {
    onChanged?.();
    router.refresh();
  };

  const handleFiles = async (list: FileList | null) => {
    const picked = list ? Array.from(list) : [];
    if (inputRef.current) inputRef.current.value = '';
    if (picked.length === 0) return;

    const room = MAX_ATTACHMENTS_PER_TODO - total;
    const accepted = picked.slice(0, Math.max(room, 0));
    if (accepted.length < picked.length) toast.error(ATTACHMENT_ERRORS.tooMany);
    if (accepted.length === 0) return;

    setUploading(accepted.map((f) => f.name));
    let uploaded = 0;
    for (const file of accepted) {
      const result = await uploadClassroomTaskFile(file, classroomTaskId);
      if (result.success) uploaded++;
      else toast.error(`${file.name}: ${result.error}`);
      setUploading((prev) => prev.slice(1));
    }
    setUploading([]);
    if (uploaded > 0) toast.success(`แนบไฟล์แล้ว ${uploaded} ไฟล์`);
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const result = await removeClassroomTaskFile({ fileId: toDelete.id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('ลบไฟล์แนบแล้ว');
    setToDelete(null);
    refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={LABEL}>ไฟล์แนบจากครู</span>
        <span className="text-[12px] font-bold text-cocoon-muted">
          {total}/{MAX_ATTACHMENTS_PER_TODO}
        </span>
      </div>

      {total === 0 && !busy ? (
        <p className="text-[14px] text-cocoon-muted">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <FileRow key={f.id} file={f} onDelete={setToDelete} />
          ))}
          {uploading.map((name, i) => (
            <li key={`${name}-${i}`} className={cn(ROW, 'text-cocoon-muted')} aria-live="polite">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{name}</span>
              <span className="text-[12px]">กำลังอัปโหลด…</span>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || full}
        className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-dashed border-cocoon-blue/40 bg-cocoon-blue-soft px-4 text-[14px] font-bold text-cocoon-blue hover:bg-cocoon-blue-soft/70 disabled:opacity-50"
      >
        <Paperclip className="size-4" aria-hidden />
        {busy ? 'กำลังอัปโหลด…' : 'แนบไฟล์'}
      </button>
      <p className="text-[12px] text-cocoon-muted">{ATTACHMENT_HINT}</p>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
        title="ลบไฟล์แนบนี้?"
        description={
          toDelete
            ? `“${toDelete.fileName}” จะถูกลบออกจากงานของห้องเรียน และจากทุกกลุ่มที่ยังไม่ได้แก้ไฟล์เอง`
            : undefined
        }
        consequences={[]}
        confirmLabel="ลบ"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
