'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, ChevronDown, MoreHorizontal, Archive } from 'lucide-react';
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
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhaseEditForm } from './phase-edit-form';
import { TodoList } from '@/components/todo/todo-list';
import { archivePhase } from '@/server/actions/phase';

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

type Phase = {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  orderIndex: number;
  status: 'locked' | 'active' | 'completed';
  isFreeAccess: boolean;
  isArchived: boolean;
  deadline: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  todos: Todo[];
};

const statusLabels: Record<string, string> = {
  locked: 'ล็อก',
  active: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
};

const statusColors: Record<string, string> = {
  locked: 'bg-muted text-muted-foreground',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

export function PhaseItem({
  phase,
  index,
}: {
  phase: Phase;
  index: number;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: phase.id,
    index,
    group: 'phases',
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleArchive = () => {
    startTransition(async () => {
      await archivePhase({ phaseId: phase.id });
      router.refresh();
    });
  };

  return (
    <div
      ref={ref}
      className="rounded-lg border bg-card"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 p-3">
          {/* Drag handle */}
          <button
            ref={handleRef}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            aria-label="ลากเพื่อจัดเรียง"
          >
            <GripVertical className="size-5" />
          </button>

          {/* Phase name + trigger */}
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
            <span className="font-medium">{phase.name}</span>
            <Badge
              variant="secondary"
              className={statusColors[phase.status]}
            >
              {statusLabels[phase.status]}
            </Badge>
            {phase.isFreeAccess && (
              <Badge variant="outline" className="text-xs">
                เข้าถึงอิสระ
              </Badge>
            )}
            <ChevronDown
              className={`ml-auto size-4 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </CollapsibleTrigger>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleArchive}
                disabled={isPending}
                className="text-destructive"
              >
                <Archive className="mr-2 size-4" />
                เก็บถาวร Phase
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CollapsibleContent>
          <div className="border-t px-3 pb-3 pt-3">
            <PhaseEditForm phase={phase} />
            <div className="mt-4">
              <TodoList
                initialTodos={phase.todos}
                phaseId={phase.id}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
