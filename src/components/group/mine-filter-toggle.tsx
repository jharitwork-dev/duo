// "กลุ่มที่ฉันดูแล" pill (quick task 261008-0y9; extracted from /teacher/review).
// Server-safe (no 'use client'): a plain Link whose `href` is the TOGGLED destination (caller decides).

import Link from 'next/link';
import { cn } from 'cn';
import { PILL_CAPACITY } from '@/components/cocoon/ui';

export const MINE_FILTER_EMPTY_HINT = 'คุณยังไม่ได้ดูแลกลุ่มใดในห้องนี้ — ตั้งค่าได้ที่หน้ากลุ่ม';

export function MineFilterToggle({ href, active, className }: { href: string; active: boolean; className?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        PILL_CAPACITY,
        'h-[36px] justify-center px-4 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40',
        active ? 'bg-cocoon-blue text-white' : 'border border-cocoon-blue/40 bg-white hover:bg-cocoon-blue-soft',
        className,
      )}
    >
      กลุ่มที่ฉันดูแล
    </Link>
  );
}
