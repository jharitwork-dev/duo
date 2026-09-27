'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropProvider } from '@dnd-kit/react';
import { PhaseItem } from './phase-item';
import { InlineAddPhase } from './inline-add-phase';
import { reorderPhases } from '@/server/actions/phase';

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

export function PhaseList({
  initialPhases,
  groupId,
}: {
  initialPhases: Phase[];
  groupId: string;
}) {
  const [phases, setPhases] = useState(initialPhases);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
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
              groupId,
              orderedIds: updated.map((p) => p.id),
            });
            router.refresh();
          });
        }}
      >
        {phases.map((phase, index) => (
          <PhaseItem key={phase.id} phase={phase} index={index} />
        ))}
      </DragDropProvider>

      <InlineAddPhase
        groupId={groupId}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
