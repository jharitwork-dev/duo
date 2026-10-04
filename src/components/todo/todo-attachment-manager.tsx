'use client';

// Teacher list + upload + open + delete for one to-do's attachments (quick 261004-gid).
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Paperclip } from 'lucide-react';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { LABEL } from '@/components/cocoon/ui';
import { fileTypeTag } from '@/lib/format';
import { ATTACHMENT_ACCEPT } from '@/lib/r2';
import { ATTACHMENT_ERRORS, ATTACHMENT_HINT, MAX_ATTACHMENTS_PER_TODO } from '@/lib/todo-attachments';
import { getAttachmentDownloadUrl } from '@/server/actions/todo';
import { removeTodoAttachment } from '@/server/actions/todo-attachment';
import { formatFileSize } from './todo-attachments-list';
import { uploadTodoAttachment } from './upload-todo-attachment';

export interface ManagedAttachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

const ROW = 'flex items-center gap-3 rounded-[10px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2 lg:px-4';
const ROW_BTN =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] px-2 text-[14px] font-bold hover:bg-cocoon-blue-soft disabled:opacity-50';

function AttachmentRow({
  attachment,
  onDelete,
}: {
  attachment: ManagedAttachment;
  onDelete: (a: ManagedAttachment) => void;
}) {
  const [opening, startOpen] = useTransition();

  const open = () => {
    startOpen(async () => {
      try {
        const result = await getAttachmentDownloadUrl({ attachmentId: attachment.id });
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
        {fileTypeTag(attachment.fileName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-cocoon-ink">{attachment.fileName}</p>
        <p className="text-[12px] text-cocoon-muted">{formatFileSize(attachment.fileSize)}</p>
      </div>
      <button
        type="button"
        onClick={open}
        disabled={opening}
        aria-label={`เปิด ${attachment.fileName}`}
        className={cn(ROW_BTN, 'text-cocoon-blue')}
      >
        เปิด
      </button>
      <button
        type="button"
        onClick={() => onDelete(attachment)}
        aria-label={`ลบ ${attachment.fileName}`}
        className={cn(ROW_BTN, 'text-[#e8590c] hover:bg-[#fff1e8]')}
      >
        ลบ
      </button>
    </li>
  );
}

export function TodoAttachmentManager({
  todoId,
  attachments,
  title = 'ไฟล์แนบจากครู',
  titleClassName = LABEL,
}: {
  todoId: string;
  attachments: ManagedAttachment[];
  title?: string;
  titleClassName?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<ManagedAttachment | null>(null);

  const total = attachments.length;
  const busy = uploading.length > 0;
  const full = total >= MAX_ATTACHMENTS_PER_TODO;

  const handleFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    const room = MAX_ATTACHMENTS_PER_TODO - total;
    const accepted = files.slice(0, Math.max(room, 0));
    if (accepted.length < files.length) toast.error(ATTACHMENT_ERRORS.tooMany);
    if (accepted.length === 0) return;

    setUploading(accepted.map((f) => f.name));
    let uploaded = 0;
    // Sequential: keeps the per-to-do limit check meaningful and the progress list readable.
    for (const file of accepted) {
      const result = await uploadTodoAttachment(file, [todoId]);
      if (result.success) uploaded++;
      else toast.error(`${file.name}: ${result.error}`);
      setUploading((prev) => prev.slice(1));
    }
    setUploading([]);
    if (uploaded > 0) toast.success(`แนบไฟล์แล้ว ${uploaded} ไฟล์`);
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const result = await removeTodoAttachment({ attachmentId: toDelete.id });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('ลบไฟล์แนบแล้ว');
    setToDelete(null);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={titleClassName}>{title}</span>
        <span className="text-[12px] font-bold text-cocoon-muted">
          {total}/{MAX_ATTACHMENTS_PER_TODO}
        </span>
      </div>

      {total === 0 && !busy ? (
        <p className="text-[14px] text-cocoon-muted">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} attachment={a} onDelete={setToDelete} />
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
          toDelete ? `“${toDelete.fileName}” จะถูกลบออกจากงานนี้เท่านั้น งานของกลุ่มอื่นที่แนบไฟล์เดียวกันจะยังเปิดได้` : undefined
        }
        consequences={[]}
        confirmLabel="ลบ"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
