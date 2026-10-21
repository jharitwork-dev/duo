// Classroom forms (quick task 261021-r1c) — shared loaders + teacher queries.
// The load*/count* helpers do NO authorization (callers authorize first) and accept an optional tx.
// getClassroomForms / getFormForEditor authorize themselves (classroom editor) and return null otherwise.

import { db } from '@/db';
import { forms, formGroups, formQuestions, formResponses } from '@/db/schema/forms';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { groups, groupMembers } from '@/db/schema/groups';
import { phases } from '@/db/schema/phases';
import { todos } from '@/db/schema/todos';
import { classroomTasks } from '@/db/schema/classroomTasks';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  buildFormCsv,
  effectiveFormStatus,
  expectedRespondents,
  formCsvFileName,
  parseQuestionConfig,
  summarizeResponses,
  type FormAnswers,
  type FormQuestionDef,
  type FormStatus,
  type QuestionSummary,
  type ResponseMode,
} from '@/lib/forms';
import { loadClassroomAccess, type DbLike } from '@/server/phase-helpers';
import { getMyGroupIds } from '@/server/queries/group-teachers';
import { getUserDirectory } from '@/lib/user-directory';

export type FormRow = typeof forms.$inferSelect;

// ---------------------------------------------------------------------------------------------
// Shared loaders (no authorization)

export async function loadFormRow(
  formId: string,
  tx: DbLike = db,
  opts?: { lock?: boolean },
): Promise<FormRow | null> {
  const base = tx.select().from(forms).where(eq(forms.id, formId));
  const rows = opts?.lock ? await base.for('update') : await base;
  return rows[0] ?? null;
}

/** Ordered by orderIndex, createdAt; config normalized via parseQuestionConfig ({} when invalid). */
export async function loadFormQuestions(formId: string, tx: DbLike = db): Promise<FormQuestionDef[]> {
  const rows = await tx
    .select()
    .from(formQuestions)
    .where(eq(formQuestions.formId, formId))
    .orderBy(asc(formQuestions.orderIndex), asc(formQuestions.createdAt));
  return rows.map((q) => {
    const parsed = parseQuestionConfig(q.type, q.config);
    return {
      id: q.id,
      type: q.type,
      title: q.title,
      description: q.description,
      required: q.required,
      config: parsed.ok ? parsed.config : {},
      orderIndex: q.orderIndex,
    };
  });
}

/** Audience group ids; [] = whole classroom. */
export async function loadFormAudience(formId: string, tx: DbLike = db): Promise<string[]> {
  const rows = await tx.select({ groupId: formGroups.groupId }).from(formGroups).where(eq(formGroups.formId, formId));
  return rows.map((r) => r.groupId);
}

/** Classroom name, student member ids (classroom_members role 'student') and groups (createdAt order). */
export async function loadClassroomRoster(
  classroomId: string,
  tx: DbLike = db,
): Promise<{ classroomName: string; studentIds: string[]; groups: { id: string; name: string; memberIds: string[] }[] }> {
  const [classroomRows, studentRows, groupRows] = await Promise.all([
    tx.select({ name: classrooms.name }).from(classrooms).where(eq(classrooms.id, classroomId)).limit(1),
    tx
      .select({ userId: classroomMembers.userId })
      .from(classroomMembers)
      .where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.role, 'student'))),
    tx
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.classroomId, classroomId))
      .orderBy(asc(groups.createdAt)),
  ]);
  const groupIds = groupRows.map((g) => g.id);
  const memberRows =
    groupIds.length === 0
      ? []
      : await tx
          .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
          .from(groupMembers)
          .where(inArray(groupMembers.groupId, groupIds))
          .orderBy(asc(groupMembers.joinedAt));
  const membersByGroup = new Map<string, string[]>();
  for (const m of memberRows) {
    const list = membersByGroup.get(m.groupId) ?? [];
    list.push(m.userId);
    membersByGroup.set(m.groupId, list);
  }
  return {
    classroomName: classroomRows[0]?.name ?? '',
    studentIds: studentRows.map((r) => r.userId),
    groups: groupRows.map((g) => ({ id: g.id, name: g.name, memberIds: membersByGroup.get(g.id) ?? [] })),
  };
}

export async function countFormResponses(formId: string, tx: DbLike = db): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(formResponses).where(eq(formResponses.formId, formId));
  return row?.n ?? 0;
}

/** Non-archived todos + classroom_tasks linked to this form. */
export async function countLinkedTasks(formId: string, tx: DbLike = db): Promise<number> {
  const [[todoRow], [taskRow]] = await Promise.all([
    tx
      .select({ n: count() })
      .from(todos)
      .where(and(eq(todos.formId, formId), eq(todos.isArchived, false))),
    tx.select({ n: count() }).from(classroomTasks).where(eq(classroomTasks.formId, formId)),
  ]);
  return (todoRow?.n ?? 0) + (taskRow?.n ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Teacher queries (self-authorizing)

export interface ClassroomFormListItem {
  id: string;
  title: string;
  /** Stored status. */
  status: FormStatus;
  /** Stored status with closesAt applied. */
  effectiveStatus: FormStatus;
  responseMode: ResponseMode;
  closesAt: Date | null;
  questionCount: number;
  responseCount: number;
  expectedCount: number;
  audienceGroupIds: string[];
  updatedAt: Date;
}

export async function getClassroomForms(classroomId: string, userId: string): Promise<ClassroomFormListItem[] | null> {
  const { classroom, allowed } = await loadClassroomAccess(classroomId, userId);
  if (!classroom || !allowed) return null;

  const formRows = await db
    .select()
    .from(forms)
    .where(eq(forms.classroomId, classroomId))
    .orderBy(desc(forms.createdAt));
  if (formRows.length === 0) return [];
  const formIds = formRows.map((f) => f.id);

  const [questionCounts, responseCounts, audienceRows, roster] = await Promise.all([
    db
      .select({ formId: formQuestions.formId, n: count() })
      .from(formQuestions)
      .where(inArray(formQuestions.formId, formIds))
      .groupBy(formQuestions.formId),
    db
      .select({ formId: formResponses.formId, n: count() })
      .from(formResponses)
      .where(inArray(formResponses.formId, formIds))
      .groupBy(formResponses.formId),
    db
      .select({ formId: formGroups.formId, groupId: formGroups.groupId })
      .from(formGroups)
      .where(inArray(formGroups.formId, formIds)),
    loadClassroomRoster(classroomId),
  ]);
  const questionsBy = new Map(questionCounts.map((r) => [r.formId, r.n]));
  const responsesBy = new Map(responseCounts.map((r) => [r.formId, r.n]));
  const audienceBy = new Map<string, string[]>();
  for (const a of audienceRows) {
    const list = audienceBy.get(a.formId) ?? [];
    list.push(a.groupId);
    audienceBy.set(a.formId, list);
  }

  const now = new Date();
  return formRows.map((f) => {
    const audienceGroupIds = audienceBy.get(f.id) ?? [];
    const expected = expectedRespondents({
      mode: f.responseMode,
      audienceGroupIds,
      groups: roster.groups,
      classroomStudentIds: roster.studentIds,
    });
    return {
      id: f.id,
      title: f.title,
      status: f.status,
      effectiveStatus: effectiveFormStatus(f, now),
      responseMode: f.responseMode,
      closesAt: f.closesAt,
      questionCount: questionsBy.get(f.id) ?? 0,
      responseCount: responsesBy.get(f.id) ?? 0,
      expectedCount: expected.ids.length,
      audienceGroupIds,
      updatedAt: f.updatedAt,
    };
  });
}

export interface FormLinkedTask {
  phaseId: string;
  phaseName: string;
  kind: 'classroom_task' | 'group_todo';
}

export interface FormEditorData {
  form: FormRow;
  classroom: { id: string; name: string };
  questions: FormQuestionDef[];
  audienceGroupIds: string[];
  groups: { id: string; name: string }[];
  phases: { id: string; name: string }[];
  responseCount: number;
  hasResponses: boolean;
  linkedTasks: FormLinkedTask[];
}

export async function getFormForEditor(formId: string, userId: string): Promise<FormEditorData | null> {
  const form = await loadFormRow(formId);
  if (!form) return null;
  const { classroom, allowed } = await loadClassroomAccess(form.classroomId, userId);
  if (!classroom || !allowed) return null;

  const [questions, audienceGroupIds, groupRows, phaseRows, responseCount, taskLinks, todoLinks] = await Promise.all([
    loadFormQuestions(formId),
    loadFormAudience(formId),
    db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.classroomId, form.classroomId))
      .orderBy(asc(groups.createdAt)),
    db
      .select({ id: phases.id, name: phases.name })
      .from(phases)
      .where(and(eq(phases.classroomId, form.classroomId), eq(phases.isArchived, false)))
      .orderBy(asc(phases.orderIndex), asc(phases.createdAt)),
    countFormResponses(formId),
    db
      .select({ phaseId: phases.id, phaseName: phases.name, orderIndex: phases.orderIndex })
      .from(classroomTasks)
      .innerJoin(phases, eq(phases.id, classroomTasks.phaseId))
      .where(eq(classroomTasks.formId, formId)),
    // Ordinary per-group todos only (classroom-task copies are reported via their classroom task).
    db
      .select({ phaseId: phases.id, phaseName: phases.name, orderIndex: phases.orderIndex })
      .from(todos)
      .innerJoin(phases, eq(phases.id, todos.phaseId))
      .where(and(eq(todos.formId, formId), eq(todos.isArchived, false), isNull(todos.classroomTaskId))),
  ]);

  const seen = new Set<string>();
  const linked: (FormLinkedTask & { orderIndex: number })[] = [];
  const push = (rows: typeof taskLinks, kind: FormLinkedTask['kind']) => {
    for (const r of rows) {
      const k = `${r.phaseId}\u0000${kind}`;
      if (seen.has(k)) continue;
      seen.add(k);
      linked.push({ phaseId: r.phaseId, phaseName: r.phaseName, kind, orderIndex: r.orderIndex });
    }
  };
  push(taskLinks, 'classroom_task');
  push(todoLinks, 'group_todo');
  linked.sort((a, b) => a.orderIndex - b.orderIndex);

  return {
    form,
    classroom: { id: classroom.id, name: classroom.name },
    questions,
    audienceGroupIds,
    groups: groupRows,
    phases: phaseRows,
    responseCount,
    hasResponses: responseCount > 0,
    linkedTasks: linked.map(({ phaseId, phaseName, kind }) => ({ phaseId, phaseName, kind })),
  };
}

// ---------------------------------------------------------------------------------------------
// Responses view + CSV (teacher, self-authorizing)

export interface FormResponseFilters {
  /** Restrict to one group of the classroom (ignored when not in the classroom). */
  groupId?: string | null;
  /** "กลุ่มที่ฉันดูแล": groups the caller is a responsible teacher of. */
  mine?: boolean;
}

export interface FormResponseRow {
  id: string;
  submittedAt: Date;
  updatedAt: Date;
  groupId: string | null;
  groupName: string;
  respondentName: string;
  email: string;
  answers: FormAnswers;
}

export interface FormResponsesView {
  form: FormRow;
  classroom: { id: string; name: string };
  questions: FormQuestionDef[];
  audienceGroupIds: string[];
  groups: { id: string; name: string }[];
  /** Effective filters after validation. */
  filters: { groupId: string | null; mine: boolean };
  rows: FormResponseRow[];
  summary: QuestionSummary[];
  notAnswered: { kind: 'students' | 'groups'; items: { id: string; name: string; groupName?: string }[] };
  counts: { answered: number; expected: number };
}

export async function getFormResponsesView(
  formId: string,
  userId: string,
  filters: FormResponseFilters = {},
): Promise<FormResponsesView | null> {
  const form = await loadFormRow(formId);
  if (!form) return null;
  const { classroom, allowed } = await loadClassroomAccess(form.classroomId, userId);
  if (!classroom || !allowed) return null;

  const [questions, audienceGroupIds, roster, responseRows, myGroups] = await Promise.all([
    loadFormQuestions(formId),
    loadFormAudience(formId),
    loadClassroomRoster(form.classroomId),
    db
      .select()
      .from(formResponses)
      .where(eq(formResponses.formId, formId))
      .orderBy(desc(formResponses.submittedAt)),
    filters.mine ? getMyGroupIds(userId, [form.classroomId]) : Promise.resolve(null),
  ]);

  const groupName = new Map(roster.groups.map((g) => [g.id, g.name]));
  const groupOfStudent = new Map<string, string>();
  for (const g of roster.groups) for (const m of g.memberIds) if (!groupOfStudent.has(m)) groupOfStudent.set(m, g.id);

  const groupId = filters.groupId && groupName.has(filters.groupId) ? filters.groupId : null;
  const mine = Boolean(filters.mine);
  // null = no group restriction.
  let allowedGroups: Set<string> | null = null;
  if (groupId) allowedGroups = new Set([groupId]);
  if (myGroups) allowedGroups = new Set([...(allowedGroups ?? groupName.keys())].filter((id) => myGroups.has(id)));
  const inScope = (gid: string | null | undefined) => allowedGroups === null || (!!gid && allowedGroups.has(gid));

  const responseGroupId = (r: (typeof responseRows)[number]) =>
    r.groupId ?? (form.responseMode === 'individual' ? (groupOfStudent.get(r.userId) ?? null) : null);
  const visibleResponses = responseRows.filter((r) => inScope(responseGroupId(r)));

  const expected = expectedRespondents({
    mode: form.responseMode,
    audienceGroupIds,
    groups: roster.groups,
    classroomStudentIds: roster.studentIds,
  });
  const answeredOwners = new Set(responseRows.map((r) => r.ownerKey));
  const expectedInScope =
    expected.kind === 'groups'
      ? expected.ids.filter((id) => inScope(id))
      : expected.ids.filter((id) => inScope(groupOfStudent.get(id)));
  const missing = expectedInScope.filter((id) => !answeredOwners.has(id));

  const directory = await getUserDirectory([
    ...visibleResponses.map((r) => r.userId),
    ...(expected.kind === 'students' ? missing : []),
  ]);

  const rows: FormResponseRow[] = visibleResponses.map((r) => {
    const gid = responseGroupId(r);
    const person = directory.get(r.userId);
    return {
      id: r.id,
      submittedAt: r.submittedAt,
      updatedAt: r.updatedAt,
      groupId: gid,
      groupName: gid ? (groupName.get(gid) ?? '') : '',
      respondentName: person?.name ?? '',
      email: person?.email ?? '',
      answers: r.answers ?? {},
    };
  });

  const notAnswered: FormResponsesView['notAnswered'] =
    expected.kind === 'groups'
      ? { kind: 'groups', items: missing.map((id) => ({ id, name: groupName.get(id) ?? '' })) }
      : {
          kind: 'students',
          items: missing
            .map((id) => {
              const gid = groupOfStudent.get(id);
              return { id, name: directory.get(id)?.name ?? '', groupName: gid ? groupName.get(gid) : undefined };
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'th')),
        };

  return {
    form,
    classroom: { id: classroom.id, name: classroom.name },
    questions,
    audienceGroupIds,
    groups: roster.groups.map((g) => ({ id: g.id, name: g.name })),
    filters: { groupId, mine },
    rows,
    summary: summarizeResponses(
      questions,
      rows.map((r) => r.answers),
    ),
    notAnswered,
    counts: { answered: expectedInScope.length - missing.length, expected: expectedInScope.length },
  };
}

/** Path of the authorized file-answer redirect (no file extension — see src/middleware.ts). */
export function formFileAnswerPath(classroomId: string, formId: string, responseId: string, questionId: string): string {
  const qs = new URLSearchParams({ response: responseId, question: questionId });
  return `/teacher/classroom/${classroomId}/forms/${formId}/file?${qs.toString()}`;
}

/** CSV export for the route handler; null when the caller is not a classroom editor. */
export async function buildFormCsvForRequest(
  formId: string,
  userId: string,
  filters: FormResponseFilters,
  origin: string,
): Promise<{ csv: string; fileName: { ascii: string; utf8: string }; classroomId: string } | null> {
  const view = await getFormResponsesView(formId, userId, filters);
  if (!view) return null;
  const csv = buildFormCsv({
    questions: view.questions,
    rows: view.rows.map((r) => ({
      submittedAt: r.submittedAt,
      classroomName: view.classroom.name,
      groupName: r.groupName,
      respondentName: r.respondentName,
      email: r.email,
      answers: r.answers,
      fileLink: (questionId) => `${origin}${formFileAnswerPath(view.classroom.id, formId, r.id, questionId)}`,
    })),
  });
  return { csv, fileName: formCsvFileName(view.form.title, new Date()), classroomId: view.classroom.id };
}
