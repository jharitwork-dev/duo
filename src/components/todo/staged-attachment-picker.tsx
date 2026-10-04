'use client';

// Controlled file staging for the create/assign dialog (quick 261004-gid). No network: the files are
// uploaded after createTodo returns the to-do ids, so cancelling never leaves an orphan object.
import { useRef } from 'react';
import { toast } from 'sonner';
import { Paperclip, X } from 'lucide-react';
import { fileTypeTag } from '@/lib/format';
import { ATTACHMENT_ACCEPT } from '@/lib/r2';
import { ATTACHMENT_ERRORS, ATTACHMENT_HINT, MAX_ATTACHMENTS_PER_TODO } from '@/lib/todo-attachments';
import { formatFileSize } from './todo-attachments-list';
import { checkAttachmentFile } from './upload-todo-attachment';

export function StagedAttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = files.length >= MAX_ATTACHMENTS_PER_TODO;

  const pick = (list: FileList | null) => {
    const picked = list ? Array.from(list) : [];
    if (inputRef.current) inputRef.current.value = '';
    const valid: File[] = [];
    for (const file of picked) {
      const error = checkAttachmentFile(file);
      if (error) toast.error(`${file.name}: ${error}`);
      else valid.push(file);
    }
    const room = MAX_ATTACHMENTS_PER_TODO - files.length;
    if (valid.length > room) toast.error(ATTACHMENT_ERRORS.tooMany);
    if (room > 0 && valid.length > 0) onChange([...files, ...valid.slice(0, room)]);
  };

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-[10px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2"
            >
              <span className="w-9 shrink-0 truncate text-[11px] font-bold text-[#f04a24]">
                {fileTypeTag(file.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-cocoon-ink">{file.name}</p>
                <p className="text-[12px] text-cocoon-muted">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                disabled={disabled}
                aria-label={`เอา ${file.name} ออก`}
                className="inline-flex size-11 items-center justify-center rounded-[10px] text-cocoon-muted hover:bg-cocoon-blue-soft disabled:opacity-50"
              >
                <X className="size-4" aria-hidden />
              </button>
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
        onChange={(e) => pick(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || full}
        className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-dashed border-cocoon-blue/40 bg-cocoon-blue-soft px-4 text-[14px] font-bold text-cocoon-blue hover:bg-cocoon-blue-soft/70 disabled:opacity-50"
      >
        <Paperclip className="size-4" aria-hidden />
        เลือกไฟล์
      </button>
      <p className="text-[12px] text-cocoon-muted">{ATTACHMENT_HINT}</p>
    </div>
  );
}
