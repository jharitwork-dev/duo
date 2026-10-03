'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from 'cn';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { CARD } from '@/components/cocoon/ui';
import { TodoList } from '@/components/todo/todo-list';
import type { GroupOption } from '@/components/todo/assign-todo-dialog';
import type { getActivePhases } from '@/server/queries/phase';
import { GroupPhaseStatusSelect, PhaseStatusPill } from './group-phase-status-select';

type GroupPhase = Awaited<ReturnType<typeof getActivePhases>>[number];

/**
 * Teacher group page: the classroom phases in order with THIS group's status, a manual
 * status control (D-3) and this group's to-dos. Phase order is managed on the classroom page.
 */
export function GroupPhaseBoard({
  groupId,
  phases,
  groups,
}: {
  groupId: string;
  phases: GroupPhase[];
  groups: GroupOption[];
}) {
  const defaultOpenId = (phases.find((p) => p.status === 'active') ?? phases[0])?.id;

  return (
    <div className="space-y-4 lg:space-y-5">
      {phases.map((phase, index) => (
        <GroupPhaseCard
          key={phase.id}
          phase={phase}
          index={index}
          groupId={groupId}
          groups={groups}
          defaultOpen={phase.id === defaultOpenId}
        />
      ))}
    </div>
  );
}

function GroupPhaseCard({
  phase,
  index,
  groupId,
  groups,
  defaultOpen,
}: {
  phase: GroupPhase;
  index: number;
  groupId: string;
  groups: GroupOption[];
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn(CARD, 'p-0 lg:p-0')}>
      <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:px-6 lg:py-5">
        <span className="flex min-w-0 flex-col">
          <span className="font-latin text-[12px] leading-normal font-bold text-cocoon-blue">
            Phase {index + 1}
          </span>
          <span className="text-[18px] leading-normal font-bold break-words text-cocoon-ink lg:text-[20px]">
            {phase.name}
          </span>
        </span>
        <PhaseStatusPill status={phase.status} />
        <span className="text-[13px] font-medium text-cocoon-muted">{phase.todos.length} งาน</span>
        <ChevronDown
          className={cn('ml-auto size-5 text-cocoon-blue transition-transform', isOpen && 'rotate-180')}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-4 border-t border-[#f1ece5] px-4 pt-4 pb-4 lg:px-6 lg:pb-6">
          {phase.description && (
            <p className="text-[14px] leading-normal font-medium text-cocoon-muted">{phase.description}</p>
          )}
          <GroupPhaseStatusSelect groupId={groupId} phaseId={phase.id} status={phase.status} />
          <TodoList
            key={phase.todos.map((t) => t.id).join(',')}
            initialTodos={phase.todos}
            phaseId={phase.id}
            phaseName={phase.name}
            groupId={groupId}
            groups={groups}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
