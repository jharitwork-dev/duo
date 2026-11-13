'use client';

// Read-only file list of a learning material (261113-lz7): one download button per file, used by the
// teacher tab and the student section. Downloads go through getMaterialFileUrl (member-authorized).
import { useState, useTransition } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { cn } from 'cn';
import { fileTypeTag, formatFileSize } from '@/lib/format';
import { getMaterialFileUrl } from '@/server/actions/material';
import type { MaterialFileItem } from '@/server/queries/material';

function FileButton({ file, onError }: { file: MaterialFileItem; onError: (message: string | null) => void }) {
  const [pending, startTransition] = useTransition();

  const open = () => {
    onError(null);
    startTransition(async () => {
      try {
        const result = await getMaterialFileUrl({ fileId: file.id });
        if (!result.success) {
          onError(result.error);
          return;
        }
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } catch {
        onError('ไม่สามารถเปิดไฟล์ได้');
      }
    });
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        aria-label={`ดาวน์โหลด ${file.fileName}`}
        className="flex min-h-11 w-full items-center gap-3 rounded-[10px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2 text-left hover:bg-cocoon-blue-soft disabled:opacity-60 lg:px-4"
      >
        <span className="w-9 shrink-0 truncate text-[11px] leading-normal font-bold text-[#f04a24] lg:text-[12px]">
          {fileTypeTag(file.fileName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-cocoon-ink">{file.fileName}</span>
          <span className="block text-[12px] text-cocoon-muted">{formatFileSize(file.fileSize)}</span>
        </span>
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-cocoon-blue" aria-hidden />
        ) : (
          <Download className="size-4 shrink-0 text-cocoon-blue" aria-hidden />
        )}
      </button>
    </li>
  );
}

export function MaterialFileButtons({ files, className }: { files: MaterialFileItem[]; className?: string }) {
  const [error, setError] = useState<string | null>(null);
  if (files.length === 0) return null;
  return (
    <div className={cn('space-y-2', className)}>
      <ul className="space-y-2">
        {files.map((f) => (
          <FileButton key={f.id} file={f} onError={setError} />
        ))}
      </ul>
      {error && (
        <p className="text-[12px] font-bold text-[#e8590c]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
