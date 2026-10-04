'use client';

// "งานของห้องเรียน (ทุกกลุ่มต้องทำ)" section inside a classroom phase card (261004-j6h).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontal, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/cocoon/confirm-dialog';
import { formatDeadline } from '@/lib/deadline';
import type { ClassroomTaskView } from '@/server/queries/classroom-task';
import { deleteClassroomTask, getClassroomTaskDeleteImpact } from '@/server/actions/classroom-task';
import { ClassroomTaskDialog } from './classroom-task-dialog';

const modeLabels: Record<string, string> = { group: 'กลุ่ม', individual: 'รายบุคคล' };

const fileRequirementBadge: Record<string, { label: string; className: string } | undefined> = {
  none: { label: 'ไม่ต้องแนบไฟล์', className: 'bg-[rgba(15,23,42,.05)] text-cocoon-subtle' },
  required: { label: 'ต้องแนบไฟล์', className: 'bg-[rgb(239_73_36/.12)] text-cocoon-orange' },
};

export function ClassroomTaskSection({
  phaseId,
  phaseName,
  phaseDeadline = null,
  tasks,
  groupCount,
}: {
  phaseId: string;
  phaseName: string;
  phaseDeadline?: Date | string | null;
  /** Deadline-ordered (from getClassroomTasksByPhase). */
  tasks: ClassroomTaskView[];
  groupCount: number;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClassroomTaskView | null>(null);
  // Read the task from props so router.refresh() updates the open dialog (e.g. its file list).
  const editing = editingId ? (tasks.find((t) => t.id === editingId) ?? null) : null;

  return (
    <div className="space-y-2 border-t border-[#f1ece5] px-4 pt-3 pb-4 lg:px-6 lg:pb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[14px] leading-normal font-bold text-cocoon-blue">
          งานของห้องเรียน (ทุกกลุ่มต้องทำ) ({tasks.length})
        </h4>
      </div>

      {tasks.length === 0 ? (
        <p className="text-[14px] text-cocoon-muted">ยังไม่มีงานของห้องเรียน</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const badge = fileRequirementBadge[task.fileRequirement];
            return (
              <li
                key={task.id}
                className="flex items-center gap-2 rounded-[12px] border border-[#e4e8ee] bg-[#fafbfc] px-3 py-3 lg:px-4"
              >
                <button
                  type="button"
                  onClick={() => setEditingId(task.id)}
                  className="flex min-w-0 flex-1 flex-col rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cocoon-blue/40"
                >
                  <span className="truncate text-[16px] leading-normal font-bold text-cocoon-ink hover:text-cocoon-blue">
                    {task.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-normal font-medium text-cocoon-muted">
                    <span>
                      {modeLabels[task.submissionMode]} ·{' '}
                      {task.deadline ? formatDeadline(task.deadline) : 'ไม่มีกำหนดส่ง'}
                    </span>
                    {badge && (
                      <span
                        className={`inline-flex h-[20px] items-center rounded-full px-2 text-[11px] font-bold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}
                    {task.files.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[12px]">
                        <Paperclip className="size-3" aria-hidden />
                        {task.files.length}
                      </span>
                    )}
                    {task.overriddenCopyCount > 0 && (
                      <span className="text-[12px] text-cocoon-subtle">
                        {task.overriddenCopyCount} กลุ่มแก้รายละเอียดเอง
                      </span>
                    )}
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`จัดการ ${task.title}`}
                        className="size-8 rounded-full text-cocoon-muted hover:bg-cocoon-blue-soft hover:text-cocoon-blue"
                      />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingId(task.id)}>
                      <Pencil className="mr-2 size-4" />
                      แก้ไข
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(task)}>
                      <Trash2 className="mr-2 size-4" />
                      ลบงานของห้องเรียน
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-dashed border-cocoon-blue/40 bg-cocoon-blue-soft px-4 text-[14px] font-bold text-cocoon-blue hover:bg-cocoon-blue-soft/70"
      >
        <Plus className="size-4" aria-hidden />
        เพิ่มงานของห้องเรียน
      </button>
      {groupCount === 0 && (
        <p className="text-[12px] text-cocoon-muted">ยังไม่มีกลุ่ม — กลุ่มที่สร้างภายหลังจะได้งานนี้อัตโนมัติ</p>
      )}

      <ClassroomTaskDialog
        phaseId={phaseId}
        phaseName={phaseName}
        phaseDeadline={phaseDeadline}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => router.refresh()}
      />
      <ClassroomTaskDialog
        phaseId={phaseId}
        phaseName={phaseName}
        phaseDeadline={phaseDeadline}
        task={editing}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditingId(null)}
        onSaved={() => router.refresh()}
      />
      <DeleteClassroomTaskDialog task={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function DeleteClassroomTaskDialog({ task, onClose }: { task: ClassroomTaskView | null; onClose: () => void }) {
  const router = useRouter();
  const [impact, setImpact] = useState<{ id: string; removed: number; kept: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taskId = task?.id ?? null;

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    getClassroomTaskDeleteImpact({ classroomTaskId: taskId })
      .then((result) => {
        if (cancelled) return;
        if (result.success) setImpact({ id: taskId, removed: result.removed, kept: result.kept });
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError('โหลดข้อมูลไม่สำเร็จ');
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const current = impact && impact.id === taskId ? impact : null;
  const consequences = current
    ? [
        `ลบออกจาก ${current.removed} กลุ่มที่ยังไม่ส่ง (งานร่างจะถูกลบ)`,
        ...(current.kept > 0 ? [`เก็บไว้ใน ${current.kept} กลุ่มที่ส่งงานแล้ว — จะกลายเป็นงานของกลุ่มนั้น`] : []),
      ]
    : null;

  return (
    <ConfirmDialog
      open={task !== null}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          onClose();
        }
      }}
      title={task ? `ลบงานของห้องเรียน "${task.title}"?` : 'ลบงานของห้องเรียน?'}
      description="ลบแล้วกู้คืนไม่ได้"
      consequences={consequences}
      blockedReason={error ?? undefined}
      confirmLabel="ลบงานของห้องเรียน"
      onConfirm={async () => {
        if (!task) return;
        const result = await deleteClassroomTask({ classroomTaskId: task.id });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('ลบงานของห้องเรียนแล้ว');
        setError(null);
        onClose();
        router.refresh();
      }}
    />
  );
}
