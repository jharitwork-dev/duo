'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DragDropProvider } from '@dnd-kit/react';
import { PhaseItem } from './phase-item';
import { InlineAddPhase } from './inline-add-phase';
import { reorderPhases } from '@/server/actions/phase';
import type { getClassroomPhases } from '@/server/queries/phase';
import type { GroupOption } from '@/components/todo/assign-todo-dialog';
import type { ClassroomTaskView } from '@/server/queries/classroom-task';

export type ClassroomPhase = Awaited<ReturnType<typeof getClassroomPhases>>[number];

/**
 * The classroom's fixed phase list (D-1): add / edit / reorder / archive.
 * The parent keys this component on the joined phase ids so local order resets after a refresh.
 */
export function PhaseList({
  classroomId,
  initialPhases,
  groups,
  classroomTasks = {},
}: {
  classroomId: string;
  initialPhases: ClassroomPhase[];
  groups: GroupOption[];
  /** Classroom-level tasks keyed by phase id (261004-j6h). A prop (not state) so refreshes show. */
  classroomTasks?: Record<string, ClassroomTaskView[]>;
}) {
  const [phases, setPhases] = useState(initialPhases);
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-4 lg:space-y-5">
      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation;
          if (!source || !target || source.id === target.id) return;

          const sourceIndex = phases.findIndex((p) => p.id === source.id);
          const targetIndex = phases.findIndex((p) => p.id === target.id);
          if (sourceIndex === -1 || targetIndex === -1) return;

          // Reorder locally
          const updated = [...phases];
          const [moved] = updated.splice(sourceIndex, 1);
          updated.splice(targetIndex, 0, moved);
          setPhases(updated);

          // Persist to server
          startTransition(async () => {
            try {
              await reorderPhases({
                classroomId,
                orderedIds: updated.map((p) => p.id),
              });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'จัดเรียงไม่สำเร็จ');
            }
            router.refresh();
          });
        }}
      >
        {phases.map((phase, index) => (
          <PhaseItem
            key={phase.id}
            phase={phase}
            index={index}
            groups={groups}
            classroomTasks={classroomTasks[phase.id] ?? []}
          />
        ))}
      </DragDropProvider>

      <InlineAddPhase classroomId={classroomId} onCreated={() => router.refresh()} />
    </div>
  );
}
