'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropProvider } from '@dnd-kit/react';
import { PhaseItem } from './phase-item';
import { InlineAddPhase } from './inline-add-phase';
import { reorderPhases } from '@/server/actions/phase';
import type { getActivePhases } from '@/server/queries/phase';

type Phase = Awaited<ReturnType<typeof getActivePhases>>[number];

export function PhaseList({
  initialPhases,
  classroomId,
  groupId,
}: {
  initialPhases: Phase[];
  classroomId: string;
  groupId: string;
}) {
  const [phases, setPhases] = useState(initialPhases);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-4 lg:space-y-5">
      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation;
          if (!source || !target || source.id === target.id) return;

          // Find source and target indices
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
            await reorderPhases({
              classroomId,
              orderedIds: updated.map((p) => p.id),
            });
            router.refresh();
          });
        }}
      >
        {phases.map((phase, index) => (
          <PhaseItem key={phase.id} phase={phase} index={index} groupId={groupId} />
        ))}
      </DragDropProvider>

      <InlineAddPhase
        classroomId={classroomId}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
