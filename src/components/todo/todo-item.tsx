'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, ChevronDown, MoreHorizontal, Archive, ExternalLink } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { TodoEditForm } from './todo-edit-form';
import { archiveTodo } from '@/server/actions/todo';
import { formatDateShort } from '@/lib/format';
import type { getActivePhases } from '@/server/queries/phase';

type Todo = Awaited<ReturnType<typeof getActivePhases>>[number]['todos'][number];

const modeLabels: Record<string, string> = {
  group: 'กลุ่ม',
  individual: 'รายบุคคล',
};

export function TodoItem({
  todo,
  index,
}: {
  todo: Todo;
  index: number;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: todo.id,
    index,
    group: `todos-${todo.phaseId}-${todo.groupId}`,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleArchive = () => {
    startTransition(async () => {
      await archiveTodo({ todoId: todo.id });
      router.refresh();
    });
  };

  return (
    <div
      ref={ref}
      className="rounded-[12px] border border-[#e4e8ee] bg-[#fafbfc]"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 px-3 py-3 lg:px-4">
          {/* Drag handle */}
          <button
            ref={handleRef}
            className="cursor-grab touch-none rounded-md text-cocoon-disabled hover:text-cocoon-blue"
            aria-label="ลากเพื่อจัดเรียง"
          >
            <GripVertical className="size-4" />
          </button>

          {/* Todo title + trigger */}
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[16px] leading-normal font-bold text-cocoon-ink">{todo.title}</span>
              <span className="text-[13px] leading-normal font-medium text-cocoon-muted">
                {modeLabels[todo.submissionMode]}
                {todo.deadline && ` · กำหนดส่ง ${formatDateShort(todo.deadline)}`}
              </span>
            </span>
            <ChevronDown
              className={`ml-auto size-4 shrink-0 text-cocoon-blue transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </CollapsibleTrigger>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 rounded-full text-cocoon-muted hover:bg-cocoon-blue-soft hover:text-cocoon-blue" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/todo/${todo.id}`)}
              >
                <ExternalLink className="mr-2 size-4" />
                เปิดหน้ารายละเอียด
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleArchive}
                disabled={isPending}
                className="text-destructive"
              >
                <Archive className="mr-2 size-4" />
                เก็บถาวร
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CollapsibleContent>
          <div className="border-t border-[#e4e8ee] px-3 pt-3 pb-3 lg:px-4 lg:pb-4">
            <TodoEditForm todo={todo} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
