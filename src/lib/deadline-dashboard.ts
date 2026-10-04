// Teacher dashboard / deadline aggregation (quick task 261004-03i). Pure: no DB / React imports.
// Data comes from src/server/queries/deadline.ts as a ClassroomSnapshot (constant number of queries).

import {
  bangkokDayKey,
  getDeadlineStatus,
  getEffectiveDeadline,
  type DeadlineStatus,
} from '@/lib/deadline';
import {
  pickCurrentPhaseIndex,
  resolveGroupPhaseStatuses,
  isPhaseViewable,
  type PhaseStatus,
  type SubmissionStatus,
} from '@/lib/node-path';

type SubmissionMode = 'group' | 'individual';
type ReviewedStatus = 'pending' | 'approved' | 'rejected';

export interface SnapshotPhase {
  id: string;
  name: string;
  orderIndex: number;
  deadline: Date | null;
  isFreeAccess: boolean;
}

export interface SnapshotGroup {
  id: string;
  name: string;
  createdAt: Date;
  memberIds: string[];
}

export interface SnapshotTodo {
  id: string;
  phaseId: string;
  groupId: string;
  assignmentId: string | null;
  title: string;
  orderIndex: number;
  submissionMode: SubmissionMode;
  deadline: Date | null;
}

export interface SnapshotSubmission {
  todoId: string;
  groupId: string | null;
  submittedBy: string;
  status: ReviewedStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassroomSnapshot {
  classroom: { id: string; name: string };
  /** Non-archived phases (any order; sorted here). */
  phases: SnapshotPhase[];
  groups: SnapshotGroup[];
  /** Non-archived to-dos in non-archived phases. */
  todos: SnapshotTodo[];
  submissions: SnapshotSubmission[];
  progress: { groupId: string; phaseId: string; status: PhaseStatus }[];
}

export interface DashboardCell {
  todoId: string;
  submissionMode: SubmissionMode;
  /** pending > rejected > approved > none over each owner's latest submission. */
  reviewStatus: SubmissionStatus;
  /** Owners whose latest submission is waiting for review. */
  pendingCount: number;
  /** Effective deadline (todo ?? phase). */
  deadline: Date | null;
  /** Worst owner: overdue > late > due_soon > upcoming > on_time > none. */
  deadlineStatus: DeadlineStatus;
  lateMs?: number;
  overdueMs?: number;
  remainingMs?: number;
  /** Group: 0/1. Individual: current members with at least one submission. */
  submittedCount: number;
  /** Group: 1. Individual: current member count (ex-members excluded). */
  ownerCount: number;
  /** Max updatedAt among in-scope submissions. */
  latestSubmittedAt: Date | null;
}

export interface MatrixRow {
  key: string;
  phaseId: string;
  title: string;
  /** Shared deadline, or the earliest one when copies differ. */
  deadline: Date | null;
  mixedDeadlines: boolean;
  /** Every group id → its cell, or null when the group has no copy. */
  cells: Record<string, DashboardCell | null>;
}

export interface GroupCard {
  id: string;
  name: string;
  memberIds: string[];
  currentPhase: { id: string; name: string; index: number } | null;
  currentProgress: { approved: number; total: number };
  overallProgress: { approved: number; total: number };
  pendingCount: number;
  rejectedCount: number;
  overdueCount: number;
  nextDeadline: { todoId: string; title: string; deadline: Date } | null;
}

export interface DashboardCounts {
  pending: number;
  overdue: number;
  dueSoon: number;
  late: number;
}

export interface ClassroomDashboard {
  classroom: { id: string; name: string };
  phases: { id: string; name: string; orderIndex: number; deadline: Date | null }[];
  groups: GroupCard[];
  rows: MatrixRow[];
  counts: DashboardCounts;
}

const DEADLINE_SEVERITY: Record<DeadlineStatus, number> = {
  none: 0,
  on_time: 1,
  upcoming: 2,
  due_soon: 3,
  late: 4,
  overdue: 5,
};

const EMPTY_COUNTS: DashboardCounts = { pending: 0, overdue: 0, dueSoon: 0, late: 0 };

function sortPhases<T extends { orderIndex: number }>(phases: T[]): T[] {
  return [...phases].sort((a, b) => a.orderIndex - b.orderIndex);
}

function sortGroups(groups: SnapshotGroup[]): SnapshotGroup[] {
  return [...groups].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

/** Owner of a submission row: the group (group mode) or the submitter (individual mode). */
function ownerOf(row: SnapshotSubmission, mode: SubmissionMode, groupId: string): string | null {
  if (mode === 'group') return row.groupId === groupId ? groupId : null;
  return row.submittedBy;
}

interface OwnerState {
  latest: ReviewedStatus;
  latestAt: number;
  firstAt: Date;
}

function ownerStates(rows: SnapshotSubmission[], mode: SubmissionMode, groupId: string): Map<string, OwnerState> {
  const states = new Map<string, OwnerState>();
  for (const row of rows) {
    const owner = ownerOf(row, mode, groupId);
    if (!owner) continue;
    const t = row.createdAt.getTime();
    const s = states.get(owner);
    if (!s) {
      states.set(owner, { latest: row.status, latestAt: t, firstAt: row.createdAt });
      continue;
    }
    if (t >= s.latestAt) {
      s.latest = row.status;
      s.latestAt = t;
    }
    if (t < s.firstAt.getTime()) s.firstAt = row.createdAt;
  }
  return states;
}

function combineReview(statuses: SubmissionStatus[]): SubmissionStatus {
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('rejected')) return 'rejected';
  if (statuses.includes('approved')) return 'approved';
  return 'none';
}

/** One to-do of one group (see DashboardCell). `submissionsForTodo` = all rows of that to-do. */
export function cellFor(
  todo: SnapshotTodo,
  group: Pick<SnapshotGroup, 'id' | 'memberIds'>,
  submissionsForTodo: SnapshotSubmission[],
  phase: { deadline: Date | null } | null,
  now: Date,
): DashboardCell {
  const deadline = getEffectiveDeadline(todo, phase);
  const states = ownerStates(submissionsForTodo, todo.submissionMode, group.id);
  const counted = todo.submissionMode === 'group' ? [group.id] : group.memberIds;
  // Individual: past submitters who left the group still contribute their status (not the counts).
  const owners = [...new Set([...counted, ...states.keys()])];

  let worst: ReturnType<typeof getDeadlineStatus> = { status: 'none' };
  const reviews: SubmissionStatus[] = [];
  let pendingCount = 0;
  for (const owner of owners) {
    const s = states.get(owner);
    const latest: SubmissionStatus = s?.latest ?? 'none';
    reviews.push(latest);
    if (latest === 'pending') pendingCount += 1;
    const status = getDeadlineStatus({ deadline, firstSubmittedAt: s?.firstAt ?? null, latestStatus: latest, now });
    if (DEADLINE_SEVERITY[status.status] > DEADLINE_SEVERITY[worst.status]) worst = status;
  }

  let latestSubmittedAt: Date | null = null;
  for (const row of submissionsForTodo) {
    if (!ownerOf(row, todo.submissionMode, group.id)) continue;
    if (!latestSubmittedAt || row.updatedAt.getTime() > latestSubmittedAt.getTime()) latestSubmittedAt = row.updatedAt;
  }

  return {
    todoId: todo.id,
    submissionMode: todo.submissionMode,
    reviewStatus: combineReview(reviews),
    pendingCount,
    deadline,
    deadlineStatus: worst.status,
    ...(worst.lateMs !== undefined && { lateMs: worst.lateMs }),
    ...(worst.overdueMs !== undefined && { overdueMs: worst.overdueMs }),
    ...(worst.remainingMs !== undefined && { remainingMs: worst.remainingMs }),
    submittedCount: counted.filter((owner) => states.has(owner)).length,
    ownerCount: counted.length,
    latestSubmittedAt,
  };
}

/** Cells for every to-do of one group (teacher group page rows), keyed by to-do id. */
export function cellsForGroup(snapshot: ClassroomSnapshot, groupId: string, now: Date): Record<string, DashboardCell> {
  const group = snapshot.groups.find((g) => g.id === groupId);
  if (!group) return {};
  const phaseById = new Map(snapshot.phases.map((p) => [p.id, p]));
  const result: Record<string, DashboardCell> = {};
  for (const todo of snapshot.todos) {
    if (todo.groupId !== groupId || !phaseById.has(todo.phaseId)) continue;
    const rows = snapshot.submissions.filter((s) => s.todoId === todo.id);
    result[todo.id] = cellFor(todo, group, rows, phaseById.get(todo.phaseId)!, now);
  }
  return result;
}

/** A group counts as "submitted" for a to-do: group mode ≥ 1 submission, individual = every member. */
export function isCellSubmitted(cell: DashboardCell): boolean {
  if (cell.submissionMode === 'group') return cell.submittedCount >= 1;
  return cell.ownerCount > 0 && cell.submittedCount === cell.ownerCount;
}

function rowKey(todo: SnapshotTodo): string {
  return todo.assignmentId ?? `${todo.phaseId}::${todo.title.trim().toLowerCase()}`;
}

export function buildClassroomDashboard(snapshot: ClassroomSnapshot, now: Date): ClassroomDashboard {
  const phases = sortPhases(snapshot.phases);
  const phaseIndex = new Map(phases.map((p, i) => [p.id, i]));
  const phaseById = new Map(phases.map((p) => [p.id, p]));
  const groups = sortGroups(snapshot.groups);
  const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const subsByTodo = new Map<string, SnapshotSubmission[]>();
  for (const s of snapshot.submissions) {
    const list = subsByTodo.get(s.todoId);
    if (list) list.push(s);
    else subsByTodo.set(s.todoId, [s]);
  }

  const todos = snapshot.todos
    .filter((t) => phaseIndex.has(t.phaseId) && groupById.has(t.groupId))
    .sort(
      (a, b) =>
        phaseIndex.get(a.phaseId)! - phaseIndex.get(b.phaseId)! ||
        a.orderIndex - b.orderIndex ||
        groupIndex.get(a.groupId)! - groupIndex.get(b.groupId)! ||
        a.id.localeCompare(b.id),
    );

  const cells = new Map<string, DashboardCell>();
  for (const todo of todos) {
    cells.set(
      todo.id,
      cellFor(todo, groupById.get(todo.groupId)!, subsByTodo.get(todo.id) ?? [], phaseById.get(todo.phaseId) ?? null, now),
    );
  }

  // Matrix rows (todos are already in phase → orderIndex order, so the first copy wins).
  const rowMap = new Map<string, MatrixRow & { minOrder: number; phaseOrder: number }>();
  for (const todo of todos) {
    const key = rowKey(todo);
    const mapKey = `${todo.phaseId}#${key}`;
    let row = rowMap.get(mapKey);
    if (!row) {
      row = {
        key,
        phaseId: todo.phaseId,
        title: todo.title,
        deadline: null,
        mixedDeadlines: false,
        cells: Object.fromEntries(groups.map((g) => [g.id, null])),
        minOrder: todo.orderIndex,
        phaseOrder: phaseIndex.get(todo.phaseId)!,
      };
      rowMap.set(mapKey, row);
    }
    if (row.cells[todo.groupId]) continue;
    row.cells[todo.groupId] = cells.get(todo.id)!;
    row.minOrder = Math.min(row.minOrder, todo.orderIndex);
  }
  const rows: MatrixRow[] = [...rowMap.values()]
    .sort((a, b) => a.phaseOrder - b.phaseOrder || a.minOrder - b.minOrder)
    .map((row): MatrixRow => {
      const deadlines = Object.values(row.cells)
        .filter((c): c is DashboardCell => c !== null)
        .map((c) => c.deadline?.getTime() ?? null);
      const distinct = new Set(deadlines);
      const nonNull = deadlines.filter((d): d is number => d !== null);
      return {
        key: row.key,
        phaseId: row.phaseId,
        title: row.title,
        cells: row.cells,
        deadline: nonNull.length > 0 ? new Date(Math.min(...nonNull)) : null,
        mixedDeadlines: distinct.size > 1,
      };
    });

  // Group cards.
  const progressByGroup = new Map<string, ClassroomSnapshot['progress']>();
  for (const p of snapshot.progress) {
    const list = progressByGroup.get(p.groupId);
    if (list) list.push(p);
    else progressByGroup.set(p.groupId, [p]);
  }
  const groupCards: GroupCard[] = groups.map((group) => {
    const statuses = resolveGroupPhaseStatuses(phases, progressByGroup.get(group.id) ?? []);
    const idx = pickCurrentPhaseIndex(phases.map((p) => ({ status: statuses[p.id], isFreeAccess: p.isFreeAccess })));
    const current = idx >= 0 ? phases[idx] : null;
    const own = todos.filter((t) => t.groupId === group.id);
    const ownCells = own.map((t) => ({ todo: t, cell: cells.get(t.id)! }));
    const approved = (list: typeof ownCells) => list.filter((x) => x.cell.reviewStatus === 'approved').length;
    const inCurrent = current ? ownCells.filter((x) => x.todo.phaseId === current.id) : [];

    let nextDeadline: GroupCard['nextDeadline'] = null;
    for (const { todo, cell } of ownCells) {
      if (cell.deadlineStatus !== 'upcoming' && cell.deadlineStatus !== 'due_soon') continue;
      if (!cell.deadline || cell.deadline.getTime() < now.getTime()) continue;
      if (!nextDeadline || cell.deadline.getTime() < nextDeadline.deadline.getTime()) {
        nextDeadline = { todoId: todo.id, title: todo.title, deadline: cell.deadline };
      }
    }

    return {
      id: group.id,
      name: group.name,
      memberIds: group.memberIds,
      currentPhase: current ? { id: current.id, name: current.name, index: idx } : null,
      currentProgress: { approved: approved(inCurrent), total: inCurrent.length },
      overallProgress: { approved: approved(ownCells), total: ownCells.length },
      pendingCount: ownCells.reduce((n, x) => n + x.cell.pendingCount, 0),
      rejectedCount: ownCells.filter((x) => x.cell.reviewStatus === 'rejected').length,
      overdueCount: ownCells.filter((x) => x.cell.deadlineStatus === 'overdue').length,
      nextDeadline,
    };
  });

  const counts = { ...EMPTY_COUNTS };
  for (const cell of cells.values()) {
    counts.pending += cell.pendingCount;
    if (cell.deadlineStatus === 'overdue') counts.overdue += 1;
    if (cell.deadlineStatus === 'due_soon') counts.dueSoon += 1;
    if (cell.deadlineStatus === 'late') counts.late += 1;
  }

  return {
    classroom: snapshot.classroom,
    phases: phases.map((p) => ({ id: p.id, name: p.name, orderIndex: p.orderIndex, deadline: p.deadline })),
    groups: groupCards,
    rows,
    counts,
  };
}

export interface MatrixFilter {
  phaseId?: string | null;
  problemsOnly?: boolean;
  groupQuery?: string;
}

function isProblem(cell: DashboardCell | null): boolean {
  if (!cell) return false;
  return cell.deadlineStatus === 'overdue' || cell.deadlineStatus === 'late' || cell.reviewStatus === 'rejected';
}

/** Filters the matrix; returns the visible rows and the visible group ids (in group order). */
export function filterMatrixRows(
  rows: MatrixRow[],
  groups: { id: string; name: string }[],
  filter: MatrixFilter,
): { rows: MatrixRow[]; groupIds: string[] } {
  const q = (filter.groupQuery ?? '').trim().toLowerCase();
  const groupIds = groups.filter((g) => !q || g.name.toLowerCase().includes(q)).map((g) => g.id);
  const visible = rows.filter((row) => {
    if (filter.phaseId && row.phaseId !== filter.phaseId) return false;
    if (filter.problemsOnly && !groupIds.some((id) => isProblem(row.cells[id] ?? null))) return false;
    return true;
  });
  return { rows: visible, groupIds };
}

export function summarizeDashboards(dashboards: Pick<ClassroomDashboard, 'counts'>[]): DashboardCounts {
  const total = { ...EMPTY_COUNTS };
  for (const d of dashboards) {
    total.pending += d.counts.pending;
    total.overdue += d.counts.overdue;
    total.dueSoon += d.counts.dueSoon;
    total.late += d.counts.late;
  }
  return total;
}

// ---------------------------------------------------------------------------------------------
// Teacher deadline timeline

export interface TimelineItem {
  classroomId: string;
  classroomName: string;
  phaseName: string;
  title: string;
  deadline: Date;
  submittedGroups: number;
  totalGroups: number;
  firstTodoId: string;
}

export interface DeadlineTimeline {
  overdue: TimelineItem[];
  today: TimelineItem[];
  next7: TimelineItem[];
  later: TimelineItem[];
}

const WEEK_MS = 7 * 24 * 3600_000;

/**
 * Rows with a deadline across classrooms:
 * overdue (passed and not every group submitted; fully submitted past rows are omitted),
 * today (same Bangkok calendar day, not yet passed), next7 (≤ 7 days ahead), later.
 */
export function buildDeadlineTimeline(snapshots: ClassroomSnapshot[], now: Date): DeadlineTimeline {
  const result: DeadlineTimeline = { overdue: [], today: [], next7: [], later: [] };
  const todayKey = bangkokDayKey(now);
  for (const snapshot of snapshots) {
    const dashboard = buildClassroomDashboard(snapshot, now);
    const phaseName = new Map(dashboard.phases.map((p) => [p.id, p.name]));
    for (const row of dashboard.rows) {
      if (!row.deadline) continue;
      const present = Object.values(row.cells).filter((c): c is DashboardCell => c !== null);
      if (present.length === 0) continue;
      const item: TimelineItem = {
        classroomId: snapshot.classroom.id,
        classroomName: snapshot.classroom.name,
        phaseName: phaseName.get(row.phaseId) ?? '',
        title: row.title,
        deadline: row.deadline,
        submittedGroups: present.filter(isCellSubmitted).length,
        totalGroups: present.length,
        firstTodoId: present[0].todoId,
      };
      const t = row.deadline.getTime();
      if (t < now.getTime()) {
        if (item.submittedGroups < item.totalGroups) result.overdue.push(item);
      } else if (bangkokDayKey(row.deadline) === todayKey) result.today.push(item);
      else if (t - now.getTime() <= WEEK_MS) result.next7.push(item);
      else result.later.push(item);
    }
  }
  const byDeadline = (a: TimelineItem, b: TimelineItem) => a.deadline.getTime() - b.deadline.getTime();
  result.overdue.sort(byDeadline);
  result.today.sort(byDeadline);
  result.next7.sort(byDeadline);
  result.later.sort(byDeadline);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Student deadline list

export interface StudentDeadlineItem {
  todoId: string;
  title: string;
  phaseName: string;
  classroomId: string;
  classroomName: string;
  groupId: string;
  deadline: Date | null;
  reviewStatus: SubmissionStatus;
  deadlineStatus: DeadlineStatus;
  lateMs?: number;
  overdueMs?: number;
  remainingMs?: number;
}

/**
 * The student's to-dos in `groupIds` (their groups in this classroom), only in phases viewable
 * for that group. Scope per to-do: the group (group mode) or the student (individual mode).
 */
export function buildStudentDeadlineItems(
  snapshot: ClassroomSnapshot,
  groupIds: string[],
  userId: string,
  now: Date,
): StudentDeadlineItem[] {
  const phases = sortPhases(snapshot.phases);
  const phaseById = new Map(phases.map((p) => [p.id, p]));
  const mine = new Set(groupIds);
  const items: StudentDeadlineItem[] = [];
  const viewableByGroup = new Map<string, Set<string>>();
  for (const groupId of mine) {
    const statuses = resolveGroupPhaseStatuses(
      phases,
      snapshot.progress.filter((p) => p.groupId === groupId),
    );
    viewableByGroup.set(
      groupId,
      new Set(phases.filter((p) => isPhaseViewable({ status: statuses[p.id], isFreeAccess: p.isFreeAccess })).map((p) => p.id)),
    );
  }

  const todos = snapshot.todos
    .filter((t) => mine.has(t.groupId) && viewableByGroup.get(t.groupId)?.has(t.phaseId))
    .sort((a, b) => phaseById.get(a.phaseId)!.orderIndex - phaseById.get(b.phaseId)!.orderIndex || a.orderIndex - b.orderIndex);

  for (const todo of todos) {
    const phase = phaseById.get(todo.phaseId)!;
    const scoped = snapshot.submissions
      .filter((s) => s.todoId === todo.id)
      .filter((s) => (todo.submissionMode === 'group' ? s.groupId === todo.groupId : s.submittedBy === userId));
    // Treat the student as the only owner for individual to-dos.
    const cell = cellFor(
      { ...todo, submissionMode: 'group' },
      { id: todo.groupId, memberIds: [] },
      scoped.map((s) => ({ ...s, groupId: todo.groupId })),
      phase,
      now,
    );
    items.push({
      todoId: todo.id,
      title: todo.title,
      phaseName: phase.name,
      classroomId: snapshot.classroom.id,
      classroomName: snapshot.classroom.name,
      groupId: todo.groupId,
      deadline: cell.deadline,
      reviewStatus: cell.reviewStatus,
      deadlineStatus: cell.deadlineStatus,
      ...(cell.lateMs !== undefined && { lateMs: cell.lateMs }),
      ...(cell.overdueMs !== undefined && { overdueMs: cell.overdueMs }),
      ...(cell.remainingMs !== undefined && { remainingMs: cell.remainingMs }),
    });
  }
  return items;
}

export interface StudentDeadlineSections {
  overdue: StudentDeadlineItem[];
  dueSoon: StudentDeadlineItem[];
  upcoming: StudentDeadlineItem[];
  submitted: StudentDeadlineItem[];
  noDeadlineCount: number;
}

/** Sections for /student/deadlines. Items without a deadline are only counted. */
export function buildStudentDeadlineSections(items: StudentDeadlineItem[]): StudentDeadlineSections {
  const out: StudentDeadlineSections = { overdue: [], dueSoon: [], upcoming: [], submitted: [], noDeadlineCount: 0 };
  for (const item of items) {
    if (!item.deadline || item.deadlineStatus === 'none') {
      out.noDeadlineCount += 1;
      continue;
    }
    if (item.deadlineStatus === 'overdue') out.overdue.push(item);
    else if (item.deadlineStatus === 'due_soon') out.dueSoon.push(item);
    else if (item.deadlineStatus === 'upcoming') out.upcoming.push(item);
    else out.submitted.push(item);
  }
  const asc = (a: StudentDeadlineItem, b: StudentDeadlineItem) => a.deadline!.getTime() - b.deadline!.getTime();
  out.overdue.sort(asc);
  out.dueSoon.sort(asc);
  out.upcoming.sort(asc);
  out.submitted.sort(
    (a, b) =>
      Number(b.reviewStatus === 'rejected') - Number(a.reviewStatus === 'rejected') ||
      b.deadline!.getTime() - a.deadline!.getTime(),
  );
  return out;
}
