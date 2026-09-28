import Link from 'next/link';
import { cn } from 'cn';

interface PageHeaderProps {
  backHref?: string;
  backLabel?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned on the title row (status pills, buttons, segmented tabs). */
  actions?: React.ReactNode;
  className?: string;
}

// Cocoon page pattern (design/mac home-1/4/11): "‹ parent" link, 30px blue title, muted subtitle.
// Mobile uses the same stack inside the 33px gutter.
export function PageHeader({ backHref, backLabel, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('px-[33px] pt-4 lg:px-0 lg:pt-[26px]', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="hidden rounded-sm text-[14px] leading-normal font-medium text-cocoon-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:inline-block"
        >
          ‹ {backLabel ?? 'ย้อนกลับ'}
        </Link>
      )}
      <div
        className={cn(
          'flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6',
          backHref ? 'lg:mt-[18px]' : 'lg:mt-0',
        )}
      >
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold break-words text-cocoon-blue lg:text-[30px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[14px] leading-normal font-medium break-words text-cocoon-muted lg:mt-1 lg:text-[16px]">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3 lg:mb-[10px]">{actions}</div>}
      </div>
    </div>
  );
}
