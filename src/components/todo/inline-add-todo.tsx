'use client';

import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { ADD_ROW } from '@/components/cocoon/ui';
import { AssignTodoDialog, type GroupOption } from './assign-todo-dialog';

/** "เพิ่มงาน" row: opens the multi-group form with the current group pre-checked. */
export function InlineAddTodo({
  phaseId,
  phaseName,
  groupId,
  groups,
  onCreated,
}: {
  phaseId: string;
  phaseName: string;
  groupId: string;
  groups: GroupOption[];
  onCreated: () => void;
}) {
  return (
    <AssignTodoDialog
      phaseId={phaseId}
      phaseName={phaseName}
      groups={groups}
      defaultGroupIds={[groupId]}
      onCreated={onCreated}
      triggerClassName={cn(ADD_ROW, 'h-11 text-[14px]')}
      trigger={
        <>
          <Plus className="size-4" />
          เพิ่มงาน
        </>
      }
    />
  );
}
