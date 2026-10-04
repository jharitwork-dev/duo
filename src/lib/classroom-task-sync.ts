// Classroom-level tasks (quick 261004-j6h) — pure sync planner + override marking.
// Framework-free: no DB / React imports. The DB layer (syncClassroomTasks in phase-helpers)
// loads state, calls planClassroomTaskSync and applies the returned plan.
import type { FileRequirement } from '@/lib/work-page';

/** Fields owned by the classroom task; never editable on a group copy. */
export const LOCKED_FIELDS = ['title', 'deadline', 'submissionMode'] as const;
/** Fields pushed to copies until a teacher edits them on that copy (stored in todos.overridden_fields). */
export const OVERRIDABLE_FIELDS = ['description', 'notes', 'fileRequirement', 'attachments'] as const;

export type LockedField = (typeof LOCKED_FIELDS)[number];
export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

export interface TaskFileSpec {
  fileKey: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedBy: string;
}

export interface TaskFieldValues {
  title: string;
  description: string | null;
  notes: string | null;
  submissionMode: 'group' | 'individual';
  fileRequirement: FileRequirement;
  deadline: Date | null;
}

export interface ClassroomTaskSpec extends TaskFieldValues {
  id: string;
  phaseId: string;
  orderIndex: number;
  files: TaskFileSpec[];
}

export interface CopyState extends TaskFieldValues {
  todoId: string;
  classroomTaskId: string;
  groupId: string;
  overriddenFields: string[];
  attachmentKeys: string[];
  hasSubmission: boolean;
}

export interface SyncPlan {
  inserts: { classroomTaskId: string; groupId: string; phaseId: string; values: TaskFieldValues; files: TaskFileSpec[] }[];
  updates: { todoId: string; set: Partial<TaskFieldValues> }[];
  attachmentInserts: { todoId: string; file: TaskFileSpec }[];
  attachmentDeletes: { todoId: string; fileKey: string }[];
  /** Todo ids to delete (task gone, copy has no submission). */
  deletes: string[];
  /** Todo ids to detach into ordinary group tasks (task gone, copy has a submission). */
  detaches: string[];
}

type SyncedTextField = 'description' | 'notes';
type SyncedField = keyof TaskFieldValues;

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '') === (b ?? '');
}

function sameDeadline(a: Date | null | undefined, b: Date | null | undefined): boolean {
  const ta = a == null ? null : new Date(a).getTime();
  const tb = b == null ? null : new Date(b).getTime();
  return ta === tb;
}

function sameField(field: SyncedField, a: TaskFieldValues, b: Partial<TaskFieldValues>): boolean {
  switch (field) {
    case 'deadline':
      return sameDeadline(a.deadline, b.deadline);
    case 'description':
    case 'notes':
      return sameText(a[field as SyncedTextField], b[field as SyncedTextField]);
    default:
      return a[field] === b[field];
  }
}

function fieldValues(t: TaskFieldValues): TaskFieldValues {
  return {
    title: t.title,
    description: t.description,
    notes: t.notes,
    submissionMode: t.submissionMode,
    fileRequirement: t.fileRequirement,
    deadline: t.deadline,
  };
}

const SYNCED_OVERRIDABLE = ['description', 'notes', 'fileRequirement'] as const;

export function planClassroomTaskSync(input: {
  groupIds: string[];
  tasks: ClassroomTaskSpec[];
  copies: CopyState[];
}): SyncPlan {
  const plan: SyncPlan = {
    inserts: [],
    updates: [],
    attachmentInserts: [],
    attachmentDeletes: [],
    deletes: [],
    detaches: [],
  };
  const groupSet = new Set(input.groupIds);
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
  // Copies of groups being deleted are ignored (cascade removes them).
  const copies = input.copies.filter((c) => groupSet.has(c.groupId));

  // 1. Missing copies.
  const existing = new Set(copies.map((c) => `${c.classroomTaskId}\u0000${c.groupId}`));
  for (const task of input.tasks) {
    for (const groupId of input.groupIds) {
      if (existing.has(`${task.id}\u0000${groupId}`)) continue;
      plan.inserts.push({
        classroomTaskId: task.id,
        groupId,
        phaseId: task.phaseId,
        values: fieldValues(task),
        files: [...task.files],
      });
    }
  }

  // 2. Existing copies.
  for (const copy of copies) {
    const task = taskById.get(copy.classroomTaskId);
    if (!task) {
      if (copy.hasSubmission) plan.detaches.push(copy.todoId);
      else plan.deletes.push(copy.todoId);
      continue;
    }

    const overridden = new Set(copy.overriddenFields);
    const set: Partial<TaskFieldValues> = {};
    for (const field of LOCKED_FIELDS) {
      if (!sameField(field, copy, task)) Object.assign(set, { [field]: task[field] });
    }
    for (const field of SYNCED_OVERRIDABLE) {
      if (overridden.has(field)) continue;
      if (!sameField(field, copy, task)) Object.assign(set, { [field]: task[field] });
    }
    if (Object.keys(set).length > 0) plan.updates.push({ todoId: copy.todoId, set });

    if (!overridden.has('attachments')) {
      const copyKeys = new Set(copy.attachmentKeys);
      const taskKeys = new Set(task.files.map((f) => f.fileKey));
      for (const file of task.files) {
        if (!copyKeys.has(file.fileKey)) plan.attachmentInserts.push({ todoId: copy.todoId, file });
      }
      for (const key of copy.attachmentKeys) {
        if (!taskKeys.has(key)) plan.attachmentDeletes.push({ todoId: copy.todoId, fileKey: key });
      }
    }
  }

  return plan;
}

/**
 * Validates an edit on a group copy: locked fields must be unchanged; changed overridable fields
 * are unioned into the copy's overridden list. `undefined` in updates = untouched.
 */
export function computeOverrideMarks(input: {
  current: TaskFieldValues;
  updates: Partial<TaskFieldValues>;
  existing: string[];
}): { lockedViolation: LockedField | null; overriddenFields: string[] } {
  const { current, updates } = input;
  let lockedViolation: LockedField | null = null;
  for (const field of LOCKED_FIELDS) {
    if (updates[field] === undefined) continue;
    if (!sameField(field, current, updates)) {
      lockedViolation = field;
      break;
    }
  }

  const marked = new Set(input.existing);
  for (const field of SYNCED_OVERRIDABLE) {
    if (updates[field] === undefined) continue;
    if (!sameField(field, current, updates)) marked.add(field);
  }
  const overriddenFields = OVERRIDABLE_FIELDS.filter((f) => marked.has(f));
  return { lockedViolation, overriddenFields };
}

export function summarizeDelete(copies: Pick<CopyState, 'hasSubmission'>[]): { removed: number; kept: number } {
  let kept = 0;
  for (const c of copies) if (c.hasSubmission) kept++;
  return { removed: copies.length - kept, kept };
}
