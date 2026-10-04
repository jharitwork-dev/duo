// Teacher review queries (quick task 261004-gic) — plain module.

import { db } from '@/db';
import { classrooms } from '@/db/schema/classrooms';
import { comments } from '@/db/schema/comments';
import { groups } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { submissionFiles, submissions } from '@/db/schema/submissions';
import { todos } from '@/db/schema/todos';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { buildReviewItems, type ReviewTab } from '@/lib/review';
import type { WorkPageDoc } from '@/lib/work-page';
import { getUserDirectory } from '@/lib/user-directory';
import { assertClassroomEditor, assertTodoEditor } from '@/server/phase-helpers';
import { getTeacherClassrooms } from '@/server/queries/classroom';
import { isInSubmissionScope } from '@/server/queries/submission';

type Status = 'pending' | 'approved' | 'rejected';

export interface ReviewListItem {
  id: string;
  todoId: string;
  todoTitle: string;
  submissionMode: 'group' | 'individual';
  groupId: string | null;
  groupName: string;
  submittedBy: string;
  status: Status;
  /** ISO string (RSC-serialisable). */
  createdAt: string;
  fileCount: number;
  attempt: number;
  tab: ReviewTab;
  /** Student name for individual to-dos, else null. */
  ownerLabel: string | null;
}

export type PhaseCounts = Record<ReviewTab, number>;

export interface ReviewListData {
  classrooms: { id: string; name: string }[];
  classroomId: string | null;
  phases: { id: string; name: string; orderIndex: number }[];
  phaseId: string | null;
  items: ReviewListItem[];
  countsByPhase: Record<string, PhaseCounts>;
}

const emptyCounts = (): PhaseCounts => ({ pending: 0, rejected: 0, approved: 0 });

/**
 * Review list for /teacher/review: latest round per (to-do, owner) of every non-archived to-do in the selected
 * classroom (default: the most recently created one) and phase (default: first phase with pending work, else first).
 */
export async function getReviewList(
  userId: string,
  params: { classroomId?: string; phaseId?: string },
): Promise<ReviewListData> {
  const owned = (await getTeacherClassrooms(userId))
    .filter((c) => !c.isArchived)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((c) => ({ id: c.id, name: c.name }));

  let classroomList = owned;
  let classroomId: string | null = null;
  if (params.classroomId) {
    // Throws for non-editors; also allows teacher members / superadmins to open a classroom they do not own.
    const classroom = await assertClassroomEditor(params.classroomId, userId);
    classroomId = classroom.id;
    if (!owned.some((c) => c.id === classroom.id)) {
      classroomList = [{ id: classroom.id, name: classroom.name }, ...owned];
    }
  } else {
    classroomId = owned[0]?.id ?? null;
  }

  const empty: ReviewListData = {
    classrooms: classroomList,
    classroomId,
    phases: [],
    phaseId: null,
    items: [],
    countsByPhase: {},
  };
  if (!classroomId) return empty;

  const [phaseRows, groupRows] = await Promise.all([
    db
      .select({ id: phases.id, name: phases.name, orderIndex: phases.orderIndex })
      .from(phases)
      .where(and(eq(phases.classroomId, classroomId), eq(phases.isArchived, false)))
      .orderBy(asc(phases.orderIndex), asc(phases.createdAt)),
    db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.classroomId, classroomId)),
  ]);
  if (phaseRows.length === 0) return { ...empty, phases: [] };

  const countsByPhase: Record<string, PhaseCounts> = Object.fromEntries(phaseRows.map((p) => [p.id, emptyCounts()]));
  if (groupRows.length === 0) {
    const phaseId = phaseRows.some((p) => p.id === params.phaseId) ? params.phaseId! : phaseRows[0].id;
    return { ...empty, phases: phaseRows, phaseId, countsByPhase };
  }

  const groupName = new Map(groupRows.map((g) => [g.id, g.name]));
  const todoRows = await db
    .select({ id: todos.id, title: todos.title, phaseId: todos.phaseId, groupId: todos.groupId, submissionMode: todos.submissionMode })
    .from(todos)
    .where(
      and(
        eq(todos.isArchived, false),
        inArray(todos.phaseId, phaseRows.map((p) => p.id)),
        inArray(todos.groupId, groupRows.map((g) => g.id)),
      ),
    );
  const todoById = new Map(todoRows.map((t) => [t.id, t]));

  const subRows =
    todoRows.length === 0
      ? []
      : await db
          .select({
            id: submissions.id,
            todoId: submissions.todoId,
            groupId: submissions.groupId,
            submittedBy: submissions.submittedBy,
            status: submissions.status,
            createdAt: submissions.createdAt,
          })
          .from(submissions)
          .where(inArray(submissions.todoId, todoRows.map((t) => t.id)))
          .orderBy(desc(submissions.createdAt));

  const fileCounts =
    subRows.length === 0
      ? []
      : await db
          .select({ submissionId: submissionFiles.submissionId, n: count() })
          .from(submissionFiles)
          .where(inArray(submissionFiles.submissionId, subRows.map((s) => s.id)))
          .groupBy(submissionFiles.submissionId);
  const fileCountById = new Map(fileCounts.map((f) => [f.submissionId, Number(f.n)]));

  const sourceRows = subRows.flatMap((s) => {
    const todo = todoById.get(s.todoId);
    if (!todo) return [];
    // Group to-dos only count the owning group's rounds (to-dos are per-group copies).
    if (todo.submissionMode === 'group' && s.groupId !== todo.groupId) return [];
    return [
      {
        ...s,
        groupId: todo.groupId,
        todoTitle: todo.title,
        submissionMode: todo.submissionMode,
        groupName: groupName.get(todo.groupId) ?? '',
        fileCount: fileCountById.get(s.id) ?? 0,
        phaseId: todo.phaseId,
      },
    ];
  });
  const allItems = buildReviewItems(sourceRows);
  for (const item of allItems) countsByPhase[item.phaseId][item.tab] += 1;

  const phaseId = phaseRows.some((p) => p.id === params.phaseId)
    ? params.phaseId!
    : (phaseRows.find((p) => countsByPhase[p.id].pending > 0) ?? phaseRows[0]).id;

  const selected = allItems.filter((i) => i.phaseId === phaseId);
  const individualIds = selected.filter((i) => i.submissionMode === 'individual').map((i) => i.submittedBy);
  const directory = individualIds.length > 0 ? await getUserDirectory(individualIds) : new Map();

  const items: ReviewListItem[] = selected.map((i) => ({
    id: i.id,
    todoId: i.todoId,
    todoTitle: i.todoTitle,
    submissionMode: i.submissionMode,
    groupId: i.groupId,
    groupName: i.groupName,
    submittedBy: i.submittedBy,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    fileCount: i.fileCount,
    attempt: i.attempt,
    tab: i.tab,
    ownerLabel: i.submissionMode === 'individual' ? (directory.get(i.submittedBy)?.name ?? null) : null,
  }));

  return { classrooms: classroomList, classroomId, phases: phaseRows, phaseId, items, countsByPhase };
}

/**
 * Pending submissions across the teacher's own non-archived classrooms (same scope as getTeacherClassrooms),
 * non-archived phases and to-dos. One SQL count. No per-owner dedupe is needed: a new round can only start after
 * the previous one was sent back, so a pending submission is always the latest round of its owner.
 */
export async function getPendingReviewCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(submissions)
    .innerJoin(todos, eq(todos.id, submissions.todoId))
    .innerJoin(phases, eq(phases.id, todos.phaseId))
    .innerJoin(classrooms, eq(classrooms.id, phases.classroomId))
    .where(
      and(
        eq(submissions.status, 'pending'),
        eq(todos.isArchived, false),
        eq(phases.isArchived, false),
        eq(classrooms.isArchived, false),
        eq(classrooms.createdBy, userId),
      ),
    );
  return Number(row?.n ?? 0);
}

export interface ReviewDetail {
  submission: {
    id: string;
    attempt: number;
    status: Status;
    createdAt: string;
    content: WorkPageDoc | null;
    files: { id: string; fileName: string; fileSize: number; contentType: string }[];
  };
  todo: { id: string; title: string; submissionMode: 'group' | 'individual' };
  group: { id: string; name: string };
  classroom: { id: string; name: string };
  phase: { id: string; name: string };
  ownerLabel: string | null;
  /** The submitting student (individual to-dos), for the comment thread; null for group to-dos. */
  studentId: string | null;
  history: { id: string; attempt: number; status: Status; createdAt: string }[];
  /** Feedback of the round right before this one, when it was sent back. */
  previousFeedback: string | null;
  /** This round is the latest in scope, still pending and unreviewed. */
  canReview: boolean;
  /** Newest round of this owner (for the "มีการส่งฉบับใหม่แล้ว" link). */
  latestId: string;
}

/** Review detail for /teacher/review/[submissionId]. Throws for non-editors; null when the submission is missing. */
export async function getReviewDetail(submissionId: string, userId: string): Promise<ReviewDetail | null> {
  const sub = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { id: true, todoId: true, submittedBy: true },
  });
  if (!sub) return null;
  const { todo, classroom } = await assertTodoEditor(sub.todoId, userId);

  const [phase, group, rows] = await Promise.all([
    db.query.phases.findFirst({ where: eq(phases.id, todo.phaseId), columns: { id: true, name: true } }),
    db.query.groups.findFirst({ where: eq(groups.id, todo.groupId), columns: { id: true, name: true } }),
    db.query.submissions.findMany({
      where: eq(submissions.todoId, todo.id),
      orderBy: [desc(submissions.createdAt)],
      with: {
        files: true,
        // Same as getSubmissionHistory: latest non-deleted TEACHER comment tied to each round.
        comments: {
          where: and(eq(comments.authorRole, 'teacher'), isNull(comments.deletedAt)),
          orderBy: [desc(comments.createdAt)],
          limit: 1,
          columns: { content: true },
        },
      },
    }),
  ]);
  if (!phase || !group) return null;

  const scoped = rows.filter((row) => isInSubmissionScope(row, todo.submissionMode, todo.groupId, sub.submittedBy));
  const index = scoped.findIndex((row) => row.id === sub.id);
  if (index === -1) return null;
  const current = scoped[index];
  const previous = scoped[index + 1];

  const isIndividual = todo.submissionMode === 'individual';
  const ownerLabel = isIndividual ? ((await getUserDirectory([sub.submittedBy])).get(sub.submittedBy)?.name ?? null) : null;

  return {
    submission: {
      id: current.id,
      attempt: scoped.length - index,
      status: current.status,
      createdAt: current.createdAt.toISOString(),
      content: (current.content as WorkPageDoc | null) ?? null,
      files: current.files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        contentType: f.contentType,
      })),
    },
    todo: { id: todo.id, title: todo.title, submissionMode: todo.submissionMode },
    group,
    classroom: { id: classroom.id, name: classroom.name },
    phase,
    ownerLabel,
    studentId: isIndividual ? sub.submittedBy : null,
    history: scoped.map((row, i) => ({
      id: row.id,
      attempt: scoped.length - i,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    previousFeedback: previous?.status === 'rejected' ? (previous.comments[0]?.content ?? null) : null,
    canReview: index === 0 && current.status === 'pending' && !current.reviewedAt && !current.reviewedBy,
    latestId: scoped[0].id,
  };
}
