'use client';

import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { cn } from 'cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface OverflowMenuItem {
  label: string;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

/** "⋯" menu (44px hit area) for rows/cards: เปิด / แก้ไข / ลบ. Destructive items go last, after a separator. */
export function OverflowMenu({
  items,
  className,
  label = 'ตัวเลือก',
}: {
  items: OverflowMenuItem[];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const firstDestructive = items.findIndex((i) => i.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-cocoon-muted outline-none hover:bg-cocoon-blue-soft hover:text-cocoon-blue focus-visible:ring-2 focus-visible:ring-cocoon-blue/40',
          className,
        )}
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index === firstDestructive && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              variant={item.destructive ? 'destructive' : 'default'}
              disabled={item.disabled}
              className="min-h-10 px-3 text-[14px] font-medium"
              onClick={() => {
                if (item.href) router.push(item.href);
                item.onSelect?.();
              }}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
