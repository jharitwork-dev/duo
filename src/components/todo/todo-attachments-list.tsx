'use client';

import { useTransition } from 'react';
import { getAttachmentDownloadUrl } from '@/server/actions/todo';
import { Button } from '@/components/ui/button';
import { FileIcon, Download } from 'lucide-react';
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

function formatFileSize(bytes: number): string {
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
        // Open the presigned URL in a new tab to trigger download
        window.open(result.url, '_blank');
      } catch {
        toast.error('ไม่สามารถดาวน์โหลดไฟล์ได้');
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <FileIcon className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="text-muted-foreground text-xs">
          {formatFileSize(attachment.fileSize)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isPending}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TodoAttachmentsList({ attachments }: TodoAttachmentsListProps) {
  if (attachments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">ไม่มีไฟล์แนบ</p>
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
