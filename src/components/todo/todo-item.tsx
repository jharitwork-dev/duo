'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/react/sortable';
import { toast } from 'sonner';
import { GripVertical, ChevronDown, MoreHorizontal, Archive, ExternalLink, Trash2 } from 'lucide-react';
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
import { archiveTodo, deleteTodo } from '@/server/actions/todo';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { useDeletionImpact } from '@/components/cocoon/use-deletion-impact';
import { formatDateShort } from '@/lib/format';
import type { getActivePhases } from '@/server/queries/phase';

type Todo = Awaited<ReturnType<typeof getActivePhases>>[number]['todos'][number];

const modeLabels: Record<string, string> = {
  group: 'กลุ่ม',
  individual: 'รายบุคคล',
};

// Only the non-default requirements get a badge ('optional' is the default, 261004-01i).
const fileRequirementBadge: Record<string, { label: string; className: string } | undefined> = {
  none: { label: 'ไม่ต้องแนบไฟล์', className: 'bg-[rgba(15,23,42,.05)] text-cocoon-subtle' },
  required: { label: 'ต้องแนบไฟล์', className: 'bg-[rgb(239_73_36/.12)] text-cocoon-orange' },
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

  const [deleteScope, setDeleteScope] = useState<'one' | 'all' | null>(null);

  const handleArchive = () => {
    startTransition(async () => {
      try {
        await archiveTodo({ todoId: todo.id });
        toast.success('เก็บงานแล้ว');
      } catch {
        toast.error('เก็บงานไม่สำเร็จ');
      }
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
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-normal font-medium text-cocoon-muted">
                <span>
                  {modeLabels[todo.submissionMode]}
                  {todo.deadline && ` · กำหนดส่ง ${formatDateShort(todo.deadline)}`}
                </span>
                {fileRequirementBadge[todo.fileRequirement] && (
                  <span
                    className={`inline-flex h-[20px] items-center rounded-full px-2 text-[11px] font-bold ${fileRequirementBadge[todo.fileRequirement]!.className}`}
                  >
                    {fileRequirementBadge[todo.fileRequirement]!.label}
                  </span>
                )}
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
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteScope('one')} disabled={isPending}>
                <Trash2 className="mr-2 size-4" />
                ลบงานนี้
              </DropdownMenuItem>
              {todo.assignmentId && (
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteScope('all')} disabled={isPending}>
                  <Trash2 className="mr-2 size-4" />
                  ลบงานนี้ในทุกกลุ่ม
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CollapsibleContent>
          <div className="border-t border-[#e4e8ee] px-3 pt-3 pb-3 lg:px-4 lg:pb-4">
            <TodoEditForm todo={todo} />
          </div>
        </CollapsibleContent>
      </Collapsible>
      <DeleteTodoDialog
        todoId={todo.id}
        title={todo.title}
        scope={deleteScope}
        onClose={() => setDeleteScope(null)}
      />
    </div>
  );
}

function DeleteTodoDialog({
  todoId,
  title,
  scope,
  onClose,
}: {
  todoId: string;
  title: string;
  scope: 'one' | 'all' | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const allCopies = scope === 'all';
  const impact = useDeletionImpact(allCopies ? 'todoAllCopies' : 'todo', todoId, scope !== null);

  const consequences = impact
    ? [
        allCopies ? `งานนี้ ${impact.copies ?? impact.todos} ชุด (ทุกกลุ่มที่ได้รับงานนี้) จะถูกลบ` : 'งานนี้ของกลุ่มนี้จะถูกลบ',
        `งานที่ส่งแล้ว ${impact.submissions} ชิ้นและไฟล์แนบจะถูกลบ`,
      ]
    : null;

  return (
    <ConfirmDialog
      open={scope !== null}
      onOpenChange={(next) => !next && onClose()}
      title={allCopies ? `ลบ "${title}" ในทุกกลุ่ม?` : `ลบงาน "${title}"?`}
      description="ลบแล้วกู้คืนไม่ได้ (ถ้าอยากซ่อนชั่วคราว ใช้ เก็บถาวร)"
      consequences={consequences}
      warning={impact && impact.submissions > 0 ? 'งานที่ส่งแล้วจะถูกลบถาวร' : undefined}
      typeToConfirm={impact?.requiresConfirmation ? title : undefined}
      confirmLabel={allCopies ? 'ลบในทุกกลุ่ม' : 'ลบงานนี้'}
      onConfirm={async (typed) => {
        const result = await deleteTodo({ todoId, allCopies, confirmName: typed });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(result.deleted > 1 ? `ลบงานแล้ว ${result.deleted} กลุ่ม` : 'ลบงานแล้ว');
        onClose();
        router.refresh();
      }}
    />
  );
}
