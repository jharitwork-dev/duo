/* eslint-disable @next/next/no-img-element -- static Figma asset */
import { fileTypeTag, formatFileSize } from '@/lib/format';

export type FileRowAction =
  /** Selected local file: mobile ×, desktop "เปิด" (local preview) + small ×. */
  | { kind: 'local'; onOpen: () => void; onRemove: () => void }
  /** Stored file: mobile ↗, desktop "เปิด". */
  | { kind: 'open'; onOpen: () => void };

interface SubmissionFileRowProps {
  fileName: string;
  fileSize: number;
  action?: FileRowAction;
  disabled?: boolean;
}

const ICON_BUTTON =
  'flex size-7 shrink-0 items-center justify-center rounded-full outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-50';

// Mobile: ref 03/05 single-line row. lg: design/mac home-3/4 row (name over size, "เปิด" link).
export function SubmissionFileRow({ fileName, fileSize, action, disabled }: SubmissionFileRowProps) {
  return (
    <div className="flex h-[49px] items-center gap-3 rounded-[8px] border border-[#e4e8ee] bg-[#f8fafc] px-3 lg:h-[64px] lg:gap-4 lg:rounded-[10px] lg:bg-[#fafbfc] lg:pr-6 lg:pl-[18px]">
      <span className="w-8 shrink-0 truncate text-[10px] leading-normal font-bold text-[#f04a24] lg:w-9 lg:text-[12px]">
        {fileTypeTag(fileName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-latin text-[12px] leading-normal font-medium text-[#161c24] lg:font-sans lg:text-[16px] lg:font-bold lg:text-cocoon-ink">
          {fileName}
        </span>
        <span className="hidden text-[12px] leading-normal font-medium text-cocoon-muted lg:block">
          {formatFileSize(fileSize)}
        </span>
      </span>
      <span className="shrink-0 text-[11px] leading-normal font-medium text-cocoon-muted lg:hidden">
        {formatFileSize(fileSize)}
      </span>

      {action?.kind === 'local' && (
        <>
          <button
            type="button"
            onClick={action.onOpen}
            disabled={disabled}
            className="hidden rounded-sm text-[16px] leading-normal font-bold text-[#0269a7] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 disabled:opacity-50 lg:block"
          >
            เปิด
          </button>
          <button
            type="button"
            onClick={action.onRemove}
            disabled={disabled}
            aria-label="ลบไฟล์"
            className={`-mr-1 ${ICON_BUTTON} lg:mr-[-10px]`}
          >
            <img src="/figma/e2ca4.svg" alt="" width={9} height={9} className="size-[9px]" />
          </button>
        </>
      )}
      {action?.kind === 'open' && (
        <button
          type="button"
          onClick={action.onOpen}
          disabled={disabled}
          aria-label="เปิดไฟล์"
          className={`-mr-1 ${ICON_BUTTON} text-[16px] leading-none text-[#0269a7] lg:mr-0 lg:size-auto lg:rounded-sm lg:font-bold lg:hover:bg-transparent lg:hover:underline`}
        >
          <span className="lg:hidden">↗</span>
          <span className="hidden lg:inline">เปิด</span>
        </button>
      )}
    </div>
  );
}
