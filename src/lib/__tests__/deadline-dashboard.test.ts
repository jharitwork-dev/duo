// Pure dashboard aggregation (quick task 261004-03i).
import { describe, it, expect } from 'vitest';
import {
  buildClassroomDashboard,
  buildDeadlineTimeline,
  buildStudentDeadlineItems,
  buildStudentDeadlineSections,
  filterMatrixRows,
  summarizeDashboards,
  type ClassroomSnapshot,
  type SnapshotGroup,
  type SnapshotPhase,
  type SnapshotSubmission,
  type SnapshotTodo,
  type StudentDeadlineItem,
} from '../deadline-dashboard';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const D = new Date('2026-10-18T16:59:00Z'); // 18 ต.ค. 23.59 Bangkok
const at = (ms: number) => new Date(D.getTime() + ms);

const phase = (id: string, orderIndex: number, extra: Partial<SnapshotPhase> = {}): SnapshotPhase => ({
  id,
  name: `Phase ${orderIndex + 1}`,
  orderIndex,
  deadline: null,
  isFreeAccess: false,
  ...extra,
});
const group = (id: string, name: string, memberIds: string[], i: number): SnapshotGroup => ({
  id,
  name,
  memberIds,
  createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
});
const todo = (id: string, extra: Partial<SnapshotTodo> & Pick<SnapshotTodo, 'groupId' | 'phaseId'>): SnapshotTodo => ({
  id,
  assignmentId: null,
  title: id,
  orderIndex: 0,
  submissionMode: 'group',
  deadline: null,
  ...extra,
});
const sub = (
  todoId: string,
  groupId: string | null,
  submittedBy: string,
  status: SnapshotSubmission['status'],
  createdAt: Date,
  updatedAt: Date = createdAt,
): SnapshotSubmission => ({ todoId, groupId, submittedBy, status, createdAt, updatedAt });

// ---------------------------------------------------------------------------------------------
// Matrix fixture

function matrixSnapshot(): ClassroomSnapshot {
  const phases = [phase('p1', 0), phase('p2', 1, { deadline: at(10 * DAY) })];
  const groups = [group('g1', 'Alpha', ['a1', 'a2'], 0), group('g2', 'Beta', ['b1'], 1), group('g3', 'Gamma', ['c1', 'c2', 'c3'], 2)];
  const todos: SnapshotTodo[] = [
    // assignment copies for g1 and g2 (g3 has none)
    todo('t1a', { groupId: 'g1', phaseId: 'p1', assignmentId: 'as1', title: 'Pitch', orderIndex: 0, deadline: D }),
    todo('t1b', { groupId: 'g2', phaseId: 'p1', assignmentId: 'as1', title: 'Pitch', orderIndex: 0, deadline: D }),
    // copies with different deadlines
    todo('t2a', { groupId: 'g1', phaseId: 'p1', assignmentId: 'as2', title: 'Poster', orderIndex: 1, deadline: at(DAY) }),
    todo('t2b', { groupId: 'g2', phaseId: 'p1', assignmentId: 'as2', title: 'Poster', orderIndex: 1, deadline: D }),
    // individual to-do for the 3-member group
    todo('t3', { groupId: 'g3', phaseId: 'p1', title: 'Reflection', orderIndex: 2, submissionMode: 'individual', deadline: D }),
    // same title in the same phase without assignment id → one row; duplicate in g1 keeps the first by orderIndex
    todo('t4a', { groupId: 'g1', phaseId: 'p2', title: 'Report ', orderIndex: 0 }),
    todo('t4dup', { groupId: 'g1', phaseId: 'p2', title: 'report', orderIndex: 5 }),
    todo('t4c', { groupId: 'g3', phaseId: 'p2', title: 'REPORT', orderIndex: 0 }),
  ];
  const submissions: SnapshotSubmission[] = [
    // g1: on time first, rejected, then resubmitted late → still on_time
    sub('t1a', 'g1', 'a1', 'rejected', at(-HOUR)),
    sub('t1a', 'g1', 'a2', 'pending', at(DAY), at(DAY + HOUR)),
    // g2: nothing for t1b → overdue
    // t3: c1 on time, c2 late, c3 nothing; ex-member x9 submitted too
    sub('t3', 'g3', 'c1', 'approved', at(-DAY)),
    sub('t3', 'g3', 'c2', 'pending', at(2 * HOUR)),
    sub('t3', 'g3', 'x9', 'pending', at(-2 * HOUR)),
    // t2b g2 submitted 30 min late
    sub('t2b', 'g2', 'b1', 'rejected', at(30 * MIN)),
  ];
  return { classroom: { id: 'c1', name: 'Cocoon A' }, phases, groups, todos, submissions, progress: [] };
}

describe('buildClassroomDashboard: matrix', () => {
  const now = at(2 * DAY);
  const dash = buildClassroomDashboard(matrixSnapshot(), now);

  it('rows are grouped by phase order and min orderIndex', () => {
    expect(dash.rows.map((r) => [r.phaseId, r.title])).toEqual([
      ['p1', 'Pitch'],
      ['p1', 'Poster'],
      ['p1', 'Reflection'],
      ['p2', 'Report '],
    ]);
  });

  it('assignment copies form one row; on_time vs overdue; null for a group without a copy', () => {
    const row = dash.rows.find((r) => r.key === 'as1')!;
    expect(Object.keys(row.cells).sort()).toEqual(['g1', 'g2', 'g3']);
    expect(row.cells.g3).toBeNull();
    expect(row.cells.g1).toMatchObject({ todoId: 't1a', deadlineStatus: 'on_time', reviewStatus: 'pending', pendingCount: 1, submittedCount: 1, ownerCount: 1 });
    expect(row.cells.g1!.latestSubmittedAt?.getTime()).toBe(at(DAY + HOUR).getTime());
    expect(row.cells.g2).toMatchObject({ todoId: 't1b', deadlineStatus: 'overdue', overdueMs: 2 * DAY, reviewStatus: 'none', submittedCount: 0 });
    expect(row.deadline?.getTime()).toBe(D.getTime());
    expect(row.mixedDeadlines).toBe(false);
  });

  it('copies with different deadlines → earliest + mixedDeadlines', () => {
    const row = dash.rows.find((r) => r.key === 'as2')!;
    expect(row.mixedDeadlines).toBe(true);
    expect(row.deadline?.getTime()).toBe(D.getTime());
    expect(row.cells.g2).toMatchObject({ deadlineStatus: 'late', lateMs: 30 * MIN, reviewStatus: 'rejected' });
    expect(row.cells.g1).toMatchObject({ deadlineStatus: 'overdue', overdueMs: DAY });
  });

  it('individual to-do: 2/3 members submitted, ex-member not counted, worst status overdue', () => {
    const cell = dash.rows.find((r) => r.title === 'Reflection')!.cells.g3!;
    expect(cell).toMatchObject({ submittedCount: 2, ownerCount: 3, deadlineStatus: 'overdue', overdueMs: 2 * DAY });
    // c2 + ex-member x9 pending
    expect(cell.pendingCount).toBe(2);
    expect(cell.reviewStatus).toBe('pending');
  });

  it('same-title rows (case/space-insensitive) merge; a duplicate copy in one group keeps the first', () => {
    const row = dash.rows.find((r) => r.phaseId === 'p2')!;
    expect(row.key).toBe('p2::report');
    expect(row.cells.g1!.todoId).toBe('t4a');
    expect(row.cells.g3!.todoId).toBe('t4c');
    expect(row.cells.g2).toBeNull();
    // phase deadline is the fallback
    expect(row.deadline?.getTime()).toBe(at(10 * DAY).getTime());
    expect(row.cells.g1!.deadlineStatus).toBe('upcoming');
  });

  it('counts', () => {
    // pending: t1a(1) + t3(2) = 3; overdue: t1b, t2a, t3 = 3; late: t2b = 1; due soon: none
    expect(dash.counts).toEqual({ pending: 3, overdue: 3, dueSoon: 0, late: 1 });
    expect(summarizeDashboards([dash, dash])).toEqual({ pending: 6, overdue: 6, dueSoon: 0, late: 2 });
    expect(summarizeDashboards([])).toEqual({ pending: 0, overdue: 0, dueSoon: 0, late: 0 });
  });

  it('a rejected individual resubmission keeps on_time for that owner', () => {
    const snap = matrixSnapshot();
    snap.todos = [todo('ti', { groupId: 'g2', phaseId: 'p1', submissionMode: 'individual', deadline: D })];
    snap.submissions = [sub('ti', 'g2', 'b1', 'rejected', at(-HOUR)), sub('ti', 'g2', 'b1', 'pending', at(3 * DAY))];
    const cell = buildClassroomDashboard(snap, at(4 * DAY)).rows[0].cells.g2!;
    expect(cell).toMatchObject({ deadlineStatus: 'on_time', reviewStatus: 'pending', submittedCount: 1, ownerCount: 1 });
  });
});

describe('filterMatrixRows', () => {
  const dash = buildClassroomDashboard(matrixSnapshot(), at(2 * DAY));

  it('no filters → everything', () => {
    const r = filterMatrixRows(dash.rows, dash.groups, {});
    expect(r.rows).toHaveLength(4);
    expect(r.groupIds).toEqual(['g1', 'g2', 'g3']);
  });

  it('by phase', () => {
    expect(filterMatrixRows(dash.rows, dash.groups, { phaseId: 'p2' }).rows.map((x) => x.title)).toEqual(['Report ']);
  });

  it('problemsOnly keeps overdue / late / rejected rows', () => {
    expect(filterMatrixRows(dash.rows, dash.groups, { problemsOnly: true }).rows.map((x) => x.title)).toEqual([
      'Pitch',
      'Poster',
      'Reflection',
    ]);
  });

  it('groupQuery narrows the visible groups (case-insensitive) and problemsOnly looks at visible cells only', () => {
    const r = filterMatrixRows(dash.rows, dash.groups, { groupQuery: 'ALP' });
    expect(r.groupIds).toEqual(['g1']);
    const p = filterMatrixRows(dash.rows, dash.groups, { groupQuery: 'gam', problemsOnly: true });
    expect(p.groupIds).toEqual(['g3']);
    expect(p.rows.map((x) => x.title)).toEqual(['Reflection']);
  });
});

// ---------------------------------------------------------------------------------------------
// Group cards

describe('buildClassroomDashboard: group cards', () => {
  const phases = [phase('p1', 0), phase('p2', 1, { name: 'Go to Market' })];
  const groups = [group('g1', 'Alpha', ['a1'], 0), group('g2', 'Beta', ['b1'], 1)];
  const todos: SnapshotTodo[] = [
    todo('ta', { groupId: 'g1', phaseId: 'p1', orderIndex: 0 }),
    todo('tb', { groupId: 'g1', phaseId: 'p1', orderIndex: 1 }),
    todo('tc', { groupId: 'g1', phaseId: 'p2', orderIndex: 0, title: 'สั่งผลิตสินค้า', deadline: D }),
    todo('td', { groupId: 'g1', phaseId: 'p2', orderIndex: 1, deadline: at(-2 * HOUR) }),
    todo('te', { groupId: 'g1', phaseId: 'p2', orderIndex: 2 }),
    todo('tf', { groupId: 'g1', phaseId: 'p2', orderIndex: 3, deadline: at(DAY) }),
    todo('tg', { groupId: 'g2', phaseId: 'p1', orderIndex: 0 }),
  ];
  const submissions: SnapshotSubmission[] = [
    sub('ta', 'g1', 'a1', 'approved', at(-10 * DAY)),
    sub('tb', 'g1', 'a1', 'approved', at(-9 * DAY)),
    sub('tf', 'g1', 'a1', 'pending', at(-2 * DAY)),
    sub('te', 'g1', 'a1', 'rejected', at(-3 * DAY)),
  ];
  const snapshot: ClassroomSnapshot = {
    classroom: { id: 'c1', name: 'C' },
    phases,
    groups,
    todos,
    submissions,
    progress: [
      { groupId: 'g1', phaseId: 'p1', status: 'completed' },
      { groupId: 'g1', phaseId: 'p2', status: 'active' },
    ],
  };
  const now = at(-DAY);
  const dash = buildClassroomDashboard(snapshot, now);
  const g1 = dash.groups.find((g) => g.id === 'g1')!;
  const g2 = dash.groups.find((g) => g.id === 'g2')!;

  it('current phase from progress rows, default rule otherwise', () => {
    expect(g1.currentPhase).toEqual({ id: 'p2', name: 'Go to Market', index: 1 });
    expect(g2.currentPhase).toEqual({ id: 'p1', name: 'Phase 1', index: 0 });
  });

  it('progress and chips', () => {
    expect(g1.currentProgress).toEqual({ approved: 0, total: 4 });
    expect(g1.overallProgress).toEqual({ approved: 2, total: 6 });
    expect(g1.pendingCount).toBe(1);
    expect(g1.rejectedCount).toBe(1);
    expect(g1.overdueCount).toBe(0);
    expect(g1.memberIds).toEqual(['a1']);
  });

  it('nextDeadline = earliest future deadline that is still upcoming / due soon (submitted ones skipped)', () => {
    // td is 2h before D but now is D-1d → due soon and earlier than tc
    expect(g1.nextDeadline).toEqual({ todoId: 'td', title: 'td', deadline: at(-2 * HOUR) });
    const later = buildClassroomDashboard(snapshot, at(-HOUR)).groups.find((g) => g.id === 'g1')!;
    // td is now overdue, tf submitted → tc
    expect(later.nextDeadline).toEqual({ todoId: 'tc', title: 'สั่งผลิตสินค้า', deadline: D });
    expect(later.overdueCount).toBe(1);
    expect(g2.nextDeadline).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Teacher timeline

describe('buildDeadlineTimeline', () => {
  const now = new Date('2026-10-18T16:30:00Z'); // 23.30 Bangkok
  const groups = [group('g1', 'A', ['a1'], 0), group('g2', 'B', ['b1'], 1)];
  const both = (id: string, title: string, deadline: Date | null, orderIndex: number): SnapshotTodo[] => [
    todo(`${id}1`, { groupId: 'g1', phaseId: 'p1', assignmentId: id, title, deadline, orderIndex }),
    todo(`${id}2`, { groupId: 'g2', phaseId: 'p1', assignmentId: id, title, deadline, orderIndex }),
  ];
  const snapshot: ClassroomSnapshot = {
    classroom: { id: 'c1', name: 'Cocoon A' },
    phases: [phase('p1', 0, { name: 'Ideation' })],
    groups,
    todos: [
      ...both('today', 'Today', new Date('2026-10-18T16:59:00Z'), 0),
      ...both('tomorrow', 'Tomorrow', new Date('2026-10-18T17:30:00Z'), 1),
      ...both('week', 'Week edge', new Date(now.getTime() + 7 * DAY), 2),
      ...both('later', 'Later', new Date(now.getTime() + 7 * DAY + MIN), 3),
      ...both('pastopen', 'Past open', new Date('2026-10-17T10:00:00Z'), 4),
      ...both('pastdone', 'Past done', new Date('2026-10-17T10:00:00Z'), 5),
      ...both('nodl', 'No deadline', null, 6),
    ],
    submissions: [
      sub('today1', 'g1', 'a1', 'pending', new Date('2026-10-18T10:00:00Z')),
      sub('pastopen1', 'g1', 'a1', 'pending', new Date('2026-10-16T10:00:00Z')),
      sub('pastdone1', 'g1', 'a1', 'approved', new Date('2026-10-16T10:00:00Z')),
      sub('pastdone2', 'g2', 'b1', 'pending', new Date('2026-10-17T12:00:00Z')),
    ],
    progress: [],
  };
  const t = buildDeadlineTimeline([snapshot], now);

  it('sections around Bangkok midnight', () => {
    expect(t.overdue.map((i) => i.title)).toEqual(['Past open']);
    expect(t.today.map((i) => i.title)).toEqual(['Today']);
    expect(t.next7.map((i) => i.title)).toEqual(['Tomorrow', 'Week edge']);
    expect(t.later.map((i) => i.title)).toEqual(['Later']);
  });

  it('items carry submitted counts and the first to-do id', () => {
    expect(t.today[0]).toMatchObject({
      classroomId: 'c1',
      classroomName: 'Cocoon A',
      phaseName: 'Ideation',
      submittedGroups: 1,
      totalGroups: 2,
      firstTodoId: 'today1',
    });
    expect(t.overdue[0]).toMatchObject({ submittedGroups: 1, totalGroups: 2 });
  });

  it('sorted by deadline ascending across classrooms', () => {
    const other: ClassroomSnapshot = {
      ...snapshot,
      classroom: { id: 'c2', name: 'Cocoon B' },
      todos: [todo('x', { groupId: 'g1', phaseId: 'p1', title: 'Early', deadline: new Date('2026-10-19T01:00:00Z') })],
      submissions: [],
    };
    const merged = buildDeadlineTimeline([snapshot, other], now);
    expect(merged.next7.map((i) => i.title)).toEqual(['Tomorrow', 'Early', 'Week edge']);
  });

  it('individual mode counts a group as submitted only when every member submitted', () => {
    const snap: ClassroomSnapshot = {
      classroom: { id: 'c3', name: 'C' },
      phases: [phase('p1', 0)],
      groups: [group('g1', 'A', ['a1', 'a2'], 0)],
      todos: [todo('ind', { groupId: 'g1', phaseId: 'p1', submissionMode: 'individual', deadline: at(3 * DAY) })],
      submissions: [sub('ind', 'g1', 'a1', 'pending', now)],
      progress: [],
    };
    expect(buildDeadlineTimeline([snap], now).next7[0]).toMatchObject({ submittedGroups: 0, totalGroups: 1 });
  });
});

// ---------------------------------------------------------------------------------------------
// Student

describe('student deadlines', () => {
  const snapshot: ClassroomSnapshot = {
    classroom: { id: 'c1', name: 'Cocoon A' },
    phases: [phase('p1', 0, { deadline: at(5 * DAY) }), phase('p2', 1), phase('p3', 2, { isFreeAccess: true })],
    groups: [group('g1', 'A', ['me', 'friend'], 0), group('g2', 'B', ['other'], 1)],
    todos: [
      todo('over', { groupId: 'g1', phaseId: 'p1', deadline: at(-DAY), orderIndex: 0 }),
      todo('soon', { groupId: 'g1', phaseId: 'p1', deadline: at(HOUR), orderIndex: 1 }),
      todo('inherit', { groupId: 'g1', phaseId: 'p1', orderIndex: 2 }), // phase deadline → upcoming
      todo('ontime', { groupId: 'g1', phaseId: 'p1', deadline: at(-2 * DAY), orderIndex: 3 }),
      todo('rej', { groupId: 'g1', phaseId: 'p1', deadline: at(-3 * DAY), orderIndex: 4 }),
      todo('mine', { groupId: 'g1', phaseId: 'p1', deadline: at(-DAY), orderIndex: 5, submissionMode: 'individual' }),
      todo('locked', { groupId: 'g1', phaseId: 'p2', deadline: at(-DAY) }), // p2 locked for g1 → hidden
      todo('free', { groupId: 'g1', phaseId: 'p3' }), // free access, no deadline → noDeadlineCount
      todo('theirs', { groupId: 'g2', phaseId: 'p1', deadline: at(-DAY) }), // not my group
    ],
    submissions: [
      sub('ontime', 'g1', 'friend', 'approved', at(-3 * DAY)),
      sub('rej', 'g1', 'me', 'rejected', at(-2 * DAY)), // late by 1 day
      sub('mine', 'g1', 'friend', 'pending', at(-2 * DAY)), // friend's individual submission is not mine
    ],
    progress: [],
  };
  const now = D;
  const items = buildStudentDeadlineItems(snapshot, ['g1'], 'me', now);

  it('only my groups, only viewable phases, individual scoped to me', () => {
    expect(items.map((i) => i.todoId).sort()).toEqual(['free', 'inherit', 'mine', 'ontime', 'over', 'rej', 'soon']);
    expect(items.find((i) => i.todoId === 'mine')).toMatchObject({ deadlineStatus: 'overdue', reviewStatus: 'none' });
    expect(items.find((i) => i.todoId === 'inherit')).toMatchObject({ deadlineStatus: 'upcoming', phaseName: 'Phase 1', classroomName: 'Cocoon A' });
    expect(items.find((i) => i.todoId === 'rej')).toMatchObject({ deadlineStatus: 'late', lateMs: DAY, reviewStatus: 'rejected' });
  });

  it('sections', () => {
    const s = buildStudentDeadlineSections(items);
    expect(s.overdue.map((i) => i.todoId)).toEqual(['over', 'mine']);
    expect(s.dueSoon.map((i) => i.todoId)).toEqual(['soon']);
    expect(s.upcoming.map((i) => i.todoId)).toEqual(['inherit']);
    // rejected first, then deadline descending
    expect(s.submitted.map((i) => i.todoId)).toEqual(['rej', 'ontime']);
    expect(s.noDeadlineCount).toBe(1);
  });

  it('sorts overdue by deadline ascending', () => {
    const mk = (todoId: string, deadline: Date): StudentDeadlineItem => ({
      todoId,
      title: todoId,
      phaseName: 'P',
      classroomId: 'c',
      classroomName: 'C',
      groupId: 'g',
      deadline,
      reviewStatus: 'none',
      deadlineStatus: 'overdue',
    });
    expect(buildStudentDeadlineSections([mk('b', at(-HOUR)), mk('a', at(-DAY))]).overdue.map((i) => i.todoId)).toEqual(['a', 'b']);
  });
});
