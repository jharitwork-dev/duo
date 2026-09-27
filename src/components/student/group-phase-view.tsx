'use client';

import Link from 'next/link';
import { Lock, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Lock }> = {
  locked: { label: 'ล็อค', variant: 'secondary', icon: Lock },
  active: { label: 'กำลังดำเนินการ', variant: 'default', icon: Circle },
  completed: { label: 'เสร็จสิ้น', variant: 'outline', icon: CheckCircle2 },
};

export function GroupPhaseView({ phases }: GroupPhaseViewProps) {
  return (
    <div className="space-y-3">
      {phases.map((phase) => {
        const config = statusConfig[phase.status] || statusConfig.locked;
        const isLocked = phase.status === 'locked' && !phase.isFreeAccess;
        const StatusIcon = config.icon;

        if (isLocked) {
          // Locked phases: not expandable
          return (
            <div
              key={phase.id}
              className="rounded-lg border bg-muted/50 px-4 py-3 opacity-60"
            >
              <div className="flex items-center gap-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">
                  {phase.name}
                </span>
                <Badge variant={config.variant} className="ml-auto text-xs">
                  {config.label}
                </Badge>
              </div>
            </div>
          );
        }

        // Active/completed phases: collapsible
        return (
          <Collapsible key={phase.id} defaultOpen={phase.status === 'active'}>
            <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50">
              <StatusIcon className="h-4 w-4" />
              <span className="font-medium">{phase.name}</span>
              {phase.deadline && (
                <span className="text-muted-foreground text-xs">
                  กำหนดส่ง:{' '}
                  {new Date(phase.deadline).toLocaleDateString('th-TH')}
                </span>
              )}
              <Badge variant={config.variant} className="ml-auto text-xs">
                {config.label}
              </Badge>
              <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 border-l pl-4 pt-2">
                {phase.description && (
                  <p className="text-muted-foreground mb-3 text-sm">
                    {phase.description}
                  </p>
                )}
                {phase.todos.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-sm">
                    ยังไม่มีรายการ
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {phase.todos.map((todo) => (
                      <li key={todo.id}>
                        <Link
                          href={`/todo/${todo.id}`}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <Circle className="h-3 w-3 text-muted-foreground" />
                          <span className="flex-1">{todo.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {todo.submissionMode === 'individual'
                              ? 'รายบุคคล'
                              : 'กลุ่ม'}
                          </Badge>
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
