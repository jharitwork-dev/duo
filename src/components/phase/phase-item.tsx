'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSortable } from '@dnd-kit/react/sortable';
import { GripVertical, ChevronDown, MoreHorizontal, Archive, Pencil, ListPlus } from 'lucide-react';
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
import { cn } from 'cn';
import { CARD } from '@/components/cocoon/ui';
import { PhaseEditForm } from './phase-edit-form';
import { AssignTodoDialog, type GroupOption } from '@/components/todo/assign-todo-dialog';
import { archivePhase } from '@/server/actions/phase';
import { formatDateShort } from '@/lib/format';
import type { ClassroomPhase } from './phase-list';

const PILL =
  'inline-flex h-[24px] items-center rounded-full border border-cocoon-line px-2.5 text-[12px] font-medium whitespace-nowrap text-cocoon-subtle';

/** Classroom-level phase card (no per-group status or to-dos — those live on the group page). */
export function PhaseItem({
  phase,
  index,
  groups,
}: {
  phase: ClassroomPhase;
  index: number;
  groups: GroupOption[];
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: phase.id,
    index,
    group: 'phases',
  });
  const [isOpen, setIsOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleArchive = () => {
    startTransition(async () => {
      try {
        await archivePhase({ phaseId: phase.id });
        toast.success('เก็บ Phase แล้ว');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'เก็บ Phase ไม่สำเร็จ');
      }
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
              {phase.description && (
                <span className="line-clamp-2 text-[14px] leading-normal font-medium text-cocoon-muted">
                  {phase.description}
                </span>
              )}
            </span>
            {phase.deadline && <span className={PILL}>กำหนดส่ง {formatDateShort(phase.deadline)}</span>}
            {phase.isFreeAccess && <span className={PILL}>เข้าถึงอิสระ</span>}
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
              <DropdownMenuItem onClick={() => setIsOpen(true)}>
                <Pencil className="mr-2 size-4" />
                แก้ไข Phase
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssignOpen(true)} disabled={groups.length === 0}>
                <ListPlus className="mr-2 size-4" />
                เพิ่มงานให้หลายกลุ่ม
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AssignTodoDialog
        phaseId={phase.id}
        phaseName={phase.name}
        groups={groups}
        defaultGroupIds={[]}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
