// Deadline dashboard data (quick task 261004-03i). Plain module (NOT 'use server').
//
// loadClassroomSnapshots issues a CONSTANT number of queries (7, in parallel) regardless of how
// many classrooms, groups or to-dos are involved; everything else is pure aggregation in
// src/lib/deadline-dashboard.ts.

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups, groupMembers } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { submissions } from '@/db/schema/submissions';
import { groupPhaseProgress } from '@/db/schema/groupPhaseProgress';
import { and, eq, inArray } from 'drizzle-orm';
import {
  buildClassroomDashboard,
  buildDeadlineTimeline,
  buildStudentDeadlineItems,
  buildStudentDeadlineSections,
  cellsForGroup,
  summarizeDashboards,
  type ClassroomDashboard,
  type ClassroomSnapshot,
  type DashboardCell,
  type DashboardCounts,
  type DeadlineTimeline,
  type StudentDeadlineSections,
} from '@/lib/deadline-dashboard';
import { getUserDirectory } from '@/lib/user-directory';
import { assertClassroomEditor, assertGroupEditor } from '@/server/phase-helpers';
import { getTeacherClassrooms } from '@/server/queries/classroom';

export type MemberDirectory = Record<string, { name: string; imageUrl: string | null }>;

/** Batched snapshot loader: one query per table, each filtered with inArray(classroomIds). */
export async function loadClassroomSnapshots(classroomIds: string[]): Promise<Map<string, ClassroomSnapshot>> {
  const ids = [...new Set(classroomIds)];
  const result = new Map<string, ClassroomSnapshot>();
  if (ids.length === 0) return result;

  const [classroomRows, phaseRows, groupRows, memberRows, todoRows, submissionRows, progressRows] = await Promise.all([
    db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms).where(inArray(classrooms.id, ids)),
    db
      .select({
        id: phases.id,
        classroomId: phases.classroomId,
        name: phases.name,
        orderIndex: phases.orderIndex,
        deadline: phases.deadline,
        isFreeAccess: phases.isFreeAccess,
      })
      .from(phases)
      .where(and(inArray(phases.classroomId, ids), eq(phases.isArchived, false))),
    db
      .select({ id: groups.id, classroomId: groups.classroomId, name: groups.name, createdAt: groups.createdAt })
      .from(groups)
      .where(inArray(groups.classroomId, ids)),
    db
      .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(inArray(groups.classroomId, ids)),
    db
      .select({
        id: todos.id,
        classroomId: phases.classroomId,
        phaseId: todos.phaseId,
        groupId: todos.groupId,
        assignmentId: todos.assignmentId,
        title: todos.title,
        orderIndex: todos.orderIndex,
        submissionMode: todos.submissionMode,
        deadline: todos.deadline,
      })
      .from(todos)
      .innerJoin(phases, eq(phases.id, todos.phaseId))
      .where(and(inArray(phases.classroomId, ids), eq(todos.isArchived, false), eq(phases.isArchived, false))),
    // Snapshot columns only (never content).
    db
      .select({
        classroomId: phases.classroomId,
        todoId: submissions.todoId,
        groupId: submissions.groupId,
        submittedBy: submissions.submittedBy,
        status: submissions.status,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt,
      })
      .from(submissions)
      .innerJoin(todos, eq(todos.id, submissions.todoId))
      .innerJoin(phases, eq(phases.id, todos.phaseId))
      .where(and(inArray(phases.classroomId, ids), eq(todos.isArchived, false), eq(phases.isArchived, false))),
    db
      .select({
        classroomId: groups.classroomId,
        groupId: groupPhaseProgress.groupId,
        phaseId: groupPhaseProgress.phaseId,
        status: groupPhaseProgress.status,
      })
      .from(groupPhaseProgress)
      .innerJoin(groups, eq(groups.id, groupPhaseProgress.groupId))
      .where(inArray(groups.classroomId, ids)),
  ]);

  for (const c of classroomRows) {
    result.set(c.id, {
      classroom: { id: c.id, name: c.name },
      phases: [],
      groups: [],
      todos: [],
      submissions: [],
      progress: [],
    });
  }
  const membersByGroup = new Map<string, string[]>();
  for (const m of memberRows) {
    const list = membersByGroup.get(m.groupId);
    if (list) list.push(m.userId);
    else membersByGroup.set(m.groupId, [m.userId]);
  }
  for (const { classroomId, ...p } of phaseRows) result.get(classroomId)?.phases.push(p);
  for (const { classroomId, ...g } of groupRows) {
    result.get(classroomId)?.groups.push({ ...g, memberIds: membersByGroup.get(g.id) ?? [] });
  }
  for (const { classroomId, ...t } of todoRows) result.get(classroomId)?.todos.push(t);
  for (const { classroomId, ...s } of submissionRows) result.get(classroomId)?.submissions.push(s);
  for (const { classroomId, ...p } of progressRows) result.get(classroomId)?.progress.push(p);
  return result;
}

async function memberDirectory(snapshots: Iterable<ClassroomSnapshot>): Promise<MemberDirectory> {
  const ids: string[] = [];
  for (const s of snapshots) for (const g of s.groups) ids.push(...g.memberIds);
  const directory = await getUserDirectory(ids);
  const out: MemberDirectory = {};
  // Teacher-facing only: `name` may fall back to the email.
  for (const [id, u] of directory) out[id] = { name: u.name, imageUrl: u.imageUrl };
  return out;
}

const EMPTY_DASHBOARD = (classroom: { id: string; name: string }): ClassroomDashboard => ({
  classroom,
  phases: [],
  groups: [],
  rows: [],
  counts: { pending: 0, overdue: 0, dueSoon: 0, late: 0 },
});

/** Classroom "ภาพรวม" tab. Throws for non-editors. */
export async function getClassroomDashboard(
  classroomId: string,
  userId: string,
): Promise<{ dashboard: ClassroomDashboard; members: MemberDirectory }> {
  const classroom = await assertClassroomEditor(classroomId, userId);
  const snapshots = await loadClassroomSnapshots([classroomId]);
  const snapshot = snapshots.get(classroomId);
  if (!snapshot) return { dashboard: EMPTY_DASHBOARD({ id: classroom.id, name: classroom.name }), members: {} };
  const dashboard = buildClassroomDashboard(snapshot, new Date());
  const members = await memberDirectory([snapshot]);
  return { dashboard, members };
}

async function teacherActiveClassrooms(userId: string) {
  // Owned or teacher member → already authorised (the same list /teacher shows).
  return (await getTeacherClassrooms(userId)).filter((c) => !c.isArchived);
}

export type TeacherClassroomRow = Awaited<ReturnType<typeof getTeacherClassrooms>>[number];

/** /teacher home dashboard across the user's non-archived classrooms (one batched snapshot). */
export async function getTeacherDashboard(userId: string): Promise<{
  classrooms: { classroom: TeacherClassroomRow; dashboard: ClassroomDashboard }[];
  counts: DashboardCounts;
  members: MemberDirectory;
}> {
  const list = await teacherActiveClassrooms(userId);
  const snapshots = await loadClassroomSnapshots(list.map((c) => c.id));
  const now = new Date();
  const entries = list.map((classroom) => {
    const snapshot = snapshots.get(classroom.id);
    return {
      classroom,
      dashboard: snapshot
        ? buildClassroomDashboard(snapshot, now)
        : EMPTY_DASHBOARD({ id: classroom.id, name: classroom.name }),
    };
  });
  const members = await memberDirectory(snapshots.values());
  return { classrooms: entries, counts: summarizeDashboards(entries.map((e) => e.dashboard)), members };
}

/** /teacher/deadlines timeline across the user's non-archived classrooms. */
export async function getTeacherDeadlineTimeline(userId: string): Promise<DeadlineTimeline> {
  const list = await teacherActiveClassrooms(userId);
  const snapshots = await loadClassroomSnapshots(list.map((c) => c.id));
  return buildDeadlineTimeline([...snapshots.values()], new Date());
}

/** Teacher group page: a cell (deadline + review status) per to-do of the group. Throws for non-editors. */
export async function getGroupDeadlineCells(groupId: string, userId: string): Promise<Record<string, DashboardCell>> {
  const { group } = await assertGroupEditor(groupId, userId);
  const snapshots = await loadClassroomSnapshots([group.classroomId]);
  const snapshot = snapshots.get(group.classroomId);
  return snapshot ? cellsForGroup(snapshot, groupId, new Date()) : {};
}

/** /student/deadlines: the student's to-dos across their (non-archived) classroom groups. */
export async function getStudentDeadlines(userId: string): Promise<StudentDeadlineSections> {
  const [classroomRows, groupRows] = await Promise.all([
    db
      .select({ classroomId: classroomMembers.classroomId })
      .from(classroomMembers)
      .innerJoin(classrooms, eq(classrooms.id, classroomMembers.classroomId))
      .where(and(eq(classroomMembers.userId, userId), eq(classrooms.isArchived, false))),
    db
      .select({ groupId: groupMembers.groupId, classroomId: groups.classroomId })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId)),
  ]);
  const classroomIds = new Set(classroomRows.map((r) => r.classroomId));
  const groupsByClassroom = new Map<string, string[]>();
  for (const r of groupRows) {
    if (!classroomIds.has(r.classroomId)) continue; // must be a classroom member too
    const list = groupsByClassroom.get(r.classroomId);
    if (list) list.push(r.groupId);
    else groupsByClassroom.set(r.classroomId, [r.groupId]);
  }

  const snapshots = await loadClassroomSnapshots([...groupsByClassroom.keys()]);
  const now = new Date();
  const items = [...groupsByClassroom].flatMap(([classroomId, groupIds]) => {
    const snapshot = snapshots.get(classroomId);
    return snapshot ? buildStudentDeadlineItems(snapshot, groupIds, userId, now) : [];
  });
  return buildStudentDeadlineSections(items);
}
