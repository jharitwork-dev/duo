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
import { Badge } from '@/components/ui/badge';
import { TodoEditForm } from './todo-edit-form';
import { archiveTodo } from '@/server/actions/todo';

type Todo = {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  notes: string | null;
  orderIndex: number;
  submissionMode: 'group' | 'individual';
  isArchived: boolean;
  deadline: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

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
    group: `todos-${todo.phaseId}`,
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
      className="rounded-md border bg-background"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Drag handle */}
          <button
            ref={handleRef}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            aria-label="ลากเพื่อจัดเรียง"
          >
            <GripVertical className="size-4" />
          </button>

          {/* Todo title + trigger */}
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
            <span className="text-sm">{todo.title}</span>
            <Badge variant="outline" className="text-xs">
              {modeLabels[todo.submissionMode]}
            </Badge>
            <ChevronDown
              className={`ml-auto size-3 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </CollapsibleTrigger>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
              <MoreHorizontal className="size-3" />
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
          <div className="border-t px-3 pb-3 pt-3">
            <TodoEditForm todo={todo} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
