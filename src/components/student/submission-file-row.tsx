/* eslint-disable @next/next/no-img-element -- static Figma asset */
import { fileTypeTag, formatFileSize } from '@/lib/format';

interface SubmissionFileRowProps {
  fileName: string;
  fileSize: number;
  onRemove?: () => void;
  onOpen?: () => void;
  disabled?: boolean;
}

export function SubmissionFileRow({ fileName, fileSize, onRemove, onOpen, disabled }: SubmissionFileRowProps) {
  return (
    <div className="flex h-[49px] items-center gap-3 rounded-[8px] border border-[#e4e8ee] bg-[#f8fafc] px-3">
      <span className="w-8 shrink-0 truncate text-[10px] leading-normal font-bold text-[#f04a24]">
        {fileTypeTag(fileName)}
      </span>
      <span className="min-w-0 flex-1 truncate font-latin text-[12px] leading-normal font-medium text-[#161c24]">
        {fileName}
      </span>
      <span className="shrink-0 text-[11px] leading-normal font-medium text-cocoon-muted">
        {formatFileSize(fileSize)}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="ลบไฟล์"
          className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-full outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-50"
        >
          <img src="/figma/e2ca4.svg" alt="" width={9} height={9} className="size-[9px]" />
        </button>
      )}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          aria-label="เปิดไฟล์"
          className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[16px] leading-none text-[#0269a7] outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-50"
        >
          ↗
        </button>
      )}
    </div>
  );
}
