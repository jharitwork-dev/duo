'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropProvider } from '@dnd-kit/react';
import { TodoItem } from './todo-item';
import { InlineAddTodo } from './inline-add-todo';
import { reorderTodos } from '@/server/actions/todo';
import type { getActivePhases } from '@/server/queries/phase';

type Todo = Awaited<ReturnType<typeof getActivePhases>>[number]['todos'][number];

export function TodoList({
  initialTodos,
  phaseId,
  groupId,
}: {
  initialTodos: Todo[];
  phaseId: string;
  groupId: string;
}) {
  const [todos, setTodos] = useState(initialTodos);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      <h4 className="text-[14px] leading-normal font-bold text-cocoon-blue">
        งานใน Phase นี้ ({todos.length})
      </h4>

      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation;
          if (!source || !target || source.id === target.id) return;

          const sourceIndex = todos.findIndex((t) => t.id === source.id);
          const targetIndex = todos.findIndex((t) => t.id === target.id);
          if (sourceIndex === -1 || targetIndex === -1) return;

          // Reorder locally
          const updated = [...todos];
          const [moved] = updated.splice(sourceIndex, 1);
          updated.splice(targetIndex, 0, moved);
          setTodos(updated);

          // Persist to server
          startTransition(async () => {
            await reorderTodos({
              phaseId,
              groupId,
              orderedIds: updated.map((t) => t.id),
            });
            router.refresh();
          });
        }}
      >
        {todos.map((todo, index) => (
          <TodoItem key={todo.id} todo={todo} index={index} />
        ))}
      </DragDropProvider>

      <InlineAddTodo
        phaseId={phaseId}
        groupId={groupId}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
