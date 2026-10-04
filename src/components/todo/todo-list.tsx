'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DragDropProvider } from '@dnd-kit/react';
import { TodoItem } from './todo-item';
import { InlineAddTodo } from './inline-add-todo';
import type { GroupOption } from './assign-todo-dialog';
import { reorderTodos } from '@/server/actions/todo';
import type { getActivePhases } from '@/server/queries/phase';
import type { TodoReviewSummary } from '@/lib/todo-review-status';
import type { DashboardCell } from '@/lib/deadline-dashboard';
import { sortTodosByDeadline } from '@/lib/todo-order';

type Todo = Awaited<ReturnType<typeof getActivePhases>>[number]['todos'][number];

/**
 * One group's to-dos inside one classroom phase (sortable). The parent should key this
 * component on the joined to-do ids so local order resets after a refresh.
 */
export function TodoList({
  initialTodos,
  phaseId,
  phaseName,
  phaseDeadline = null,
  groupId,
  groups,
  commentCounts = {},
  reviewStatuses = {},
  deadlineCells = {},
}: {
  initialTodos: Todo[];
  phaseId: string;
  phaseName: string;
  phaseDeadline?: Date | null;
  groupId: string;
  groups: GroupOption[];
  commentCounts?: Record<string, number>;
  reviewStatuses?: Record<string, TodoReviewSummary>;
  deadlineCells?: Record<string, DashboardCell>;
}) {
  const [todos, setTodos] = useState(initialTodos);
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      <h4 className="text-[14px] leading-normal font-bold text-cocoon-blue">
        งานของกลุ่มนี้ ({todos.length})
      </h4>

      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation;
          if (!source || !target || source.id === target.id) return;

          const sourceIndex = todos.findIndex((t) => t.id === source.id);
          const targetIndex = todos.findIndex((t) => t.id === target.id);
          if (sourceIndex === -1 || targetIndex === -1) return;

          // Reorder locally, then snap dated tasks back to deadline order (D-3', 261004-j6h).
          const moved = [...todos];
          const [item] = moved.splice(sourceIndex, 1);
          moved.splice(targetIndex, 0, item);
          const updated = sortTodosByDeadline(moved.map((t, i) => ({ ...t, orderIndex: i })));
          setTodos(updated);

          // Persist to server
          startTransition(async () => {
            try {
              await reorderTodos({
                phaseId,
                groupId,
                orderedIds: updated.map((t) => t.id),
              });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'จัดเรียงไม่สำเร็จ');
            }
            router.refresh();
          });
        }}
      >
        {todos.map((todo, index) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            index={index}
            commentCount={commentCounts[todo.id] ?? 0}
            review={reviewStatuses[todo.id]}
            phaseDeadline={phaseDeadline}
            deadlineCell={deadlineCells[todo.id]}
          />
        ))}
      </DragDropProvider>

      <InlineAddTodo
        phaseId={phaseId}
        phaseName={phaseName}
        phaseDeadline={phaseDeadline}
        groupId={groupId}
        groups={groups}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
