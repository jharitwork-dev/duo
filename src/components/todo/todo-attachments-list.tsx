'use client';

import { useTransition } from 'react';
import { getAttachmentDownloadUrl } from '@/server/actions/todo';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { fileTypeTag } from '@/lib/format';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

interface TodoAttachmentsListProps {
  attachments: Attachment[];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ attachment }: { attachment: Attachment }) {
  const [isPending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const result = await getAttachmentDownloadUrl({
          attachmentId: attachment.id,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        // Open the presigned URL in a new tab to trigger download
        window.open(result.url, '_blank');
      } catch {
        toast.error('ไม่สามารถดาวน์โหลดไฟล์ได้');
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-2 lg:px-4">
      <span className="w-9 shrink-0 truncate text-[11px] leading-normal font-bold text-[#f04a24] lg:text-[12px]">
        {fileTypeTag(attachment.fileName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-cocoon-ink">{attachment.fileName}</p>
        <p className="text-[12px] text-cocoon-muted">
          {formatFileSize(attachment.fileSize)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isPending}
        aria-label="ดาวน์โหลดไฟล์"
        className="text-cocoon-blue hover:bg-cocoon-blue-soft hover:text-cocoon-blue"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TodoAttachmentsList({ attachments }: TodoAttachmentsListProps) {
  if (attachments.length === 0) {
    return (
      <p className="text-[14px] text-cocoon-muted">ไม่มีไฟล์แนบ</p>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <AttachmentRow key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}
