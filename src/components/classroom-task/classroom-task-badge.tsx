import { cn } from 'cn';

/** "🔒 งานของห้องเรียน" pill for group copies of a classroom-level task (261004-j6h). */
export function ClassroomTaskBadge({ className }: { className?: string }) {
  return (
    <span
      title="งานของห้องเรียน — ทุกกลุ่มต้องทำ"
      className={cn(
        'inline-flex h-[20px] shrink-0 items-center gap-1 rounded-full bg-cocoon-blue-soft px-2 text-[12px] leading-none font-bold whitespace-nowrap text-cocoon-blue',
        className,
      )}
    >
      <span aria-hidden>🔒</span>
      งานของห้องเรียน
    </span>
  );
}
