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
  effectiveFormStatus,
  expectedRespondents,
  parseQuestionConfig,
  type FormQuestionDef,
  type FormStatus,
  type ResponseMode,
} from '@/lib/forms';
import { loadClassroomAccess, type DbLike } from '@/server/phase-helpers';

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
