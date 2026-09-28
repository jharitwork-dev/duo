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
import { cn } from 'cn';
import { CARD } from '@/components/cocoon/ui';
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

// StatusPill-like colours: active blue / locked grey / completed green.
const statusColors: Record<string, string> = {
  locked: 'bg-[rgba(15,23,42,.05)] text-[#9da1a6]',
  active: 'bg-[rgba(0,105,166,.15)] text-cocoon-blue',
  completed: 'bg-[rgb(0_168_107/.15)] text-cocoon-green',
};
const statusDots: Record<string, string> = {
  locked: 'bg-[rgba(29,37,49,.4)]',
  active: 'bg-cocoon-blue',
  completed: 'bg-cocoon-green',
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
      className={cn(CARD, 'p-0 lg:p-0')}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 p-4 lg:gap-3 lg:px-6 lg:py-5">
          {/* Drag handle */}
          <button
            ref={handleRef}
            className="cursor-grab touch-none rounded-md text-cocoon-disabled hover:text-cocoon-blue"
            aria-label="ลากเพื่อจัดเรียง"
          >
            <GripVertical className="size-5" />
          </button>

          {/* Phase name + trigger */}
          <CollapsibleTrigger className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40">
            <span className="flex min-w-0 flex-col">
              <span className="font-latin text-[12px] leading-normal font-bold text-cocoon-blue">
                Phase {index + 1}
              </span>
              <span className="text-[18px] leading-normal font-bold break-words text-cocoon-ink lg:text-[20px]">
                {phase.name}
              </span>
            </span>
            <span
              className={cn(
                'inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold whitespace-nowrap',
                statusColors[phase.status],
              )}
            >
              <span aria-hidden className={cn('size-2 rounded-full', statusDots[phase.status])} />
              {statusLabels[phase.status]}
            </span>
            {phase.isFreeAccess && (
              <span className="inline-flex h-[24px] items-center rounded-full border border-cocoon-line px-2.5 text-[12px] font-medium text-cocoon-subtle">
                เข้าถึงอิสระ
              </span>
            )}
            <ChevronDown
              className={`ml-auto size-5 text-cocoon-blue transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </CollapsibleTrigger>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-9 rounded-full text-cocoon-muted hover:bg-cocoon-blue-soft hover:text-cocoon-blue" />}>
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
          <div className="border-t border-[#f1ece5] px-4 pt-4 pb-4 lg:px-6 lg:pb-6">
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
