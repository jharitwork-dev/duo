'use client';

import Link from 'next/link';
import { Lock, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CARD } from '@/components/cocoon/ui';
import { formatDeadline } from '@/lib/deadline';

interface Todo {
  id: string;
  title: string;
  submissionMode: string;
  deadline: Date | null;
}

interface Phase {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: Date | null;
  isFreeAccess: boolean;
  todos: Todo[];
}

interface GroupPhaseViewProps {
  phases: Phase[];
}

const statusConfig: Record<string, { label: string; pill: string; dot: string }> = {
  locked: { label: 'ล็อค', pill: 'bg-[rgba(15,23,42,.05)] text-[#9da1a6]', dot: 'bg-[rgba(29,37,49,.4)]' },
  active: { label: 'กำลังดำเนินการ', pill: 'bg-[rgba(0,105,166,.15)] text-cocoon-blue', dot: 'bg-cocoon-blue' },
  completed: { label: 'เสร็จสิ้น', pill: 'bg-[rgb(0_168_107/.15)] text-cocoon-green', dot: 'bg-cocoon-green' },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.locked;
  return (
    <span
      className={cn(
        'inline-flex h-[24px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold whitespace-nowrap',
        config.pill,
      )}
    >
      <span aria-hidden className={cn('size-2 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}

function PhaseHeading({ index, name }: { index: number; name: string }) {
  return (
    <span className="flex min-w-0 flex-col text-left">
      <span className="font-latin text-[12px] leading-normal font-bold text-cocoon-blue">Phase {index + 1}</span>
      <span className="text-[18px] leading-normal font-bold break-words text-cocoon-ink lg:text-[20px]">{name}</span>
    </span>
  );
}

// Read-only phase / to-do overview (teacher branch of the student group page).
export function GroupPhaseView({ phases }: GroupPhaseViewProps) {
  return (
    <div className="space-y-4 lg:space-y-5">
      {phases.map((phase, index) => {
        const isLocked = phase.status === 'locked' && !phase.isFreeAccess;

        if (isLocked) {
          return (
            <div key={phase.id} className={cn(CARD, 'flex items-center gap-3 opacity-70')}>
              <Lock className="size-5 shrink-0 text-cocoon-disabled" aria-hidden />
              <PhaseHeading index={index} name={phase.name} />
              <span className="ml-auto">
                <StatusBadge status={phase.status} />
              </span>
            </div>
          );
        }

        return (
          <Collapsible key={phase.id} defaultOpen={phase.status === 'active'} className={cn(CARD, 'p-0 lg:p-0')}>
            <CollapsibleTrigger className="group/phase flex w-full items-center gap-3 rounded-[16px] px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40 lg:px-7 lg:py-5">
              <PhaseHeading index={index} name={phase.name} />
              {phase.deadline && (
                <span className="hidden text-[13px] font-medium text-cocoon-muted sm:inline">
                  {formatDeadline(phase.deadline)}
                </span>
              )}
              <span className="ml-auto">
                <StatusBadge status={phase.status} />
              </span>
              <ChevronRight className="size-5 shrink-0 text-cocoon-blue transition-transform group-data-[panel-open]/phase:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 border-t border-[#f1ece5] px-5 pt-4 pb-5 lg:px-7 lg:pb-6">
                {phase.description && (
                  <p className="mb-2 text-[14px] leading-normal text-cocoon-subtle">{phase.description}</p>
                )}
                {phase.todos.length === 0 ? (
                  <p className="py-2 text-[14px] text-cocoon-muted">ยังไม่มีรายการ</p>
                ) : (
                  <ul className="space-y-2">
                    {phase.todos.map((todo) => (
                      <li key={todo.id}>
                        <Link
                          href={`/todo/${todo.id}`}
                          className="flex items-center gap-3 rounded-[12px] border border-[#e4e8ee] bg-[#fafbfc] px-4 py-3 outline-none transition-colors hover:border-cocoon-blue/40 focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[16px] font-bold text-cocoon-ink">{todo.title}</span>
                            <span className="text-[13px] font-medium text-cocoon-muted">
                              {todo.submissionMode === 'individual' ? 'รายบุคคล' : 'กลุ่ม'}
                              {todo.deadline &&
                                ` · ${formatDeadline(todo.deadline)}`}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-cocoon-blue" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
