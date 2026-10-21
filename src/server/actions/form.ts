'use server';

// Classroom forms — teacher actions (quick task 261021-r1c). Every export runs
// requireRole(TEACHER) + assertClassroomEditor (form's classroom, resolved from the DB) or
// assertPhaseEditor (addFormToPhase). Edit guards come from src/lib/forms.ts.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { forms, formGroups, formQuestions, formResponses } from '@/db/schema/forms';
import { groups } from '@/db/schema/groups';
import { todos } from '@/db/schema/todos';
import { classroomTasks } from '@/db/schema/classroomTasks';
import { and, asc, count, eq, inArray, max } from 'drizzle-orm';
import { getCurrentUserId, requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { actionError, type ActionResult } from '@/lib/action-result';
import {
  FORM_LIMITS,
  QUESTION_TYPES,
  RESPONSE_MODES,
  canChangeResponseMode,
  canDeleteQuestion,
  canPublish,
  checkQuestionChange,
  defaultQuestionConfig,
  parseQuestionConfig,
  reopenClosesAt,
  type FormAnswers,
} from '@/lib/forms';
import {
  assertClassroomEditor,
  assertPhaseEditor,
  cleanupR2Objects,
  syncClassroomTasks,
  type DbLike,
} from '@/server/phase-helpers';
import { countFormResponses, countLinkedTasks, loadFormAudience, loadFormRow } from '@/server/queries/form';

const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';
const ERR_NOT_AUTHORIZED = 'ไม่มีสิทธิ์แก้ไขแบบฟอร์มนี้';
const ERR_TOO_MANY_QUESTIONS = `เพิ่มคำถามได้สูงสุด ${FORM_LIMITS.questions} ข้อ`;
const ERR_ALREADY_IN_PHASE = 'แบบฟอร์มนี้อยู่ใน Phase นี้แล้ว';

function revalidateFormPages(classroomId: string, formId: string, groupIds: readonly string[] = []) {
  revalidatePath(`/teacher/classroom/${classroomId}`);
  revalidatePath(`/teacher/classroom/${classroomId}/forms/${formId}`);
  revalidatePath(`/teacher/classroom/${classroomId}/forms/${formId}/responses`);
  revalidatePath(`/student/classroom/${classroomId}`, 'layout');
  revalidatePath(`/forms/${formId}`);
  for (const groupId of groupIds) {
    revalidatePath(`/teacher/classroom/${classroomId}/group/${groupId}`);
    revalidatePath(`/student/classroom/${classroomId}/group/${groupId}`);
  }
}

async function hasResponses(tx: DbLike, formId: string): Promise<boolean> {
  return (await countFormResponses(formId, tx)) > 0;
}

async function touchForm(tx: DbLike, formId: string, now = new Date()) {
  await tx.update(forms).set({ updatedAt: now }).where(eq(forms.id, formId));
}

/** Loads a question with its form (no authorization). */
async function loadQuestionForEdit(questionId: string) {
  const [question] = await db.select().from(formQuestions).where(eq(formQuestions.id, questionId)).limit(1);
  if (!question) return null;
  const form = await loadFormRow(question.formId);
  if (!form) return null;
  return { question, form };
}

async function orderedQuestionIds(tx: DbLike, formId: string) {
  return tx
    .select({ id: formQuestions.id, orderIndex: formQuestions.orderIndex })
    .from(formQuestions)
    .where(eq(formQuestions.formId, formId))
    .orderBy(asc(formQuestions.orderIndex), asc(formQuestions.createdAt));
}

async function writeOrder(tx: DbLike, rows: { id: string; orderIndex: number }[], ids: string[]) {
  const current = new Map(rows.map((r) => [r.id, r.orderIndex]));
  for (let i = 0; i < ids.length; i++) {
    if (current.get(ids[i]) === i) continue;
    await tx.update(formQuestions).set({ orderIndex: i }).where(eq(formQuestions.id, ids[i]));
  }
}

function fileKeysOf(answers: FormAnswers | null | undefined): string[] {
  const keys: string[] = [];
  for (const value of Object.values(answers ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'file' && value.key) {
      keys.push(value.key);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Forms

const createFormSchema = z.object({ classroomId: z.string().min(1) });

export async function createForm(input: z.infer<typeof createFormSchema>): Promise<ActionResult<{ formId: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = createFormSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { classroomId } = parsed.data;
  try {
    await assertClassroomEditor(classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const [row] = await db
    .insert(forms)
    .values({
      classroomId,
      title: 'แบบฟอร์มใหม่',
      responseMode: 'individual',
      status: 'draft',
      createdBy: userId,
    })
    .returning({ id: forms.id });
  revalidateFormPages(classroomId, row.id);
  return { success: true, formId: row.id };
}

const settingsSchema = z.object({
  formId: z.string().min(1),
  title: z.string().trim().min(1).max(FORM_LIMITS.title),
  description: z.string().max(FORM_LIMITS.description).nullable().optional(),
  responseMode: z.enum(RESPONSE_MODES),
  closesAt: z.date().nullable(),
  audienceGroupIds: z.array(z.string().min(1)).max(500),
});

export async function updateFormSettings(input: z.infer<typeof settingsSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const data = parsed.data;

  const form = await loadFormRow(data.formId);
  if (!form) return actionError(ERR_NOT_AUTHORIZED);
  const classroomId = form.classroomId;
  try {
    await assertClassroomEditor(classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const audience = [...new Set(data.audienceGroupIds)];
  if (audience.length > 0) {
    const valid = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.classroomId, classroomId), inArray(groups.id, audience)));
    if (valid.length !== audience.length) return actionError(ERR_INPUT);
  }

  const result = await db.transaction(async (tx) => {
    const locked = await loadFormRow(data.formId, tx, { lock: true });
    if (!locked) return { error: ERR_NOT_AUTHORIZED };
    if (locked.responseMode !== data.responseMode) {
      const blocked = canChangeResponseMode({
        hasResponses: await hasResponses(tx, data.formId),
        linkedTaskCount: await countLinkedTasks(data.formId, tx),
      });
      if (blocked) return { error: blocked };
    }
    const description = data.description?.trim() ? data.description.trim() : null;
    await tx
      .update(forms)
      .set({
        title: data.title,
        description,
        responseMode: data.responseMode,
        closesAt: data.closesAt,
        updatedAt: new Date(),
      })
      .where(eq(forms.id, data.formId));
    await tx.delete(formGroups).where(eq(formGroups.formId, data.formId));
    if (audience.length > 0) {
      await tx.insert(formGroups).values(audience.map((groupId) => ({ formId: data.formId, groupId })));
    }
    return { error: null };
  });
  if (result.error) return actionError(result.error);

  revalidateFormPages(classroomId, data.formId);
  return { success: true };
}

const statusSchema = z.object({ formId: z.string().min(1), status: z.enum(['open', 'closed']) });

export async function setFormStatus(input: z.infer<typeof statusSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { formId, status } = parsed.data;

  const form = await loadFormRow(formId);
  if (!form) return actionError(ERR_NOT_AUTHORIZED);
  try {
    await assertClassroomEditor(form.classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const result = await db.transaction(async (tx) => {
    const locked = await loadFormRow(formId, tx, { lock: true });
    if (!locked) return { error: ERR_NOT_AUTHORIZED };
    const now = new Date();
    if (status === 'open') {
      const [{ n }] = await tx.select({ n: count() }).from(formQuestions).where(eq(formQuestions.formId, formId));
      const blocked = canPublish(n);
      if (blocked) return { error: blocked };
      await tx
        .update(forms)
        .set({ status: 'open', closesAt: reopenClosesAt(locked.closesAt, now), updatedAt: now })
        .where(eq(forms.id, formId));
    } else {
      await tx.update(forms).set({ status: 'closed', updatedAt: now }).where(eq(forms.id, formId));
    }
    return { error: null };
  });
  if (result.error) return actionError(result.error);

  revalidateFormPages(form.classroomId, formId);
  return { success: true };
}

const formIdSchema = z.object({ formId: z.string().min(1) });

export async function deleteForm(input: z.infer<typeof formIdSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = formIdSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { formId } = parsed.data;

  const form = await loadFormRow(formId);
  if (!form) return actionError(ERR_NOT_AUTHORIZED);
  try {
    await assertClassroomEditor(form.classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const keys = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ answers: formResponses.answers })
      .from(formResponses)
      .where(eq(formResponses.formId, formId));
    // Cascade removes audience / questions / responses; linked todos & classroom tasks get form_id NULL.
    await tx.delete(forms).where(eq(forms.id, formId));
    return rows.flatMap((r) => fileKeysOf(r.answers));
  });
  await cleanupR2Objects([...new Set(keys)]);

  revalidateFormPages(form.classroomId, formId);
  return { success: true };
}

// ---------------------------------------------------------------------------------------------
// Questions

const addQuestionSchema = z.object({ formId: z.string().min(1), type: z.enum(QUESTION_TYPES) });

export async function addQuestion(
  input: z.infer<typeof addQuestionSchema>,
): Promise<ActionResult<{ questionId: string }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = addQuestionSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { formId, type } = parsed.data;

  const form = await loadFormRow(formId);
  if (!form) return actionError(ERR_NOT_AUTHORIZED);
  try {
    await assertClassroomEditor(form.classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const result = await db.transaction(async (tx) => {
    if (!(await loadFormRow(formId, tx, { lock: true }))) return { error: ERR_NOT_AUTHORIZED };
    const [stats] = await tx
      .select({ n: count(), maxOrder: max(formQuestions.orderIndex) })
      .from(formQuestions)
      .where(eq(formQuestions.formId, formId));
    if ((stats?.n ?? 0) >= FORM_LIMITS.questions) return { error: ERR_TOO_MANY_QUESTIONS };
    const [row] = await tx
      .insert(formQuestions)
      .values({
        formId,
        type,
        title: 'คำถามใหม่',
        required: false,
        config: defaultQuestionConfig(type, createId),
        orderIndex: (stats?.maxOrder ?? -1) + 1,
      })
      .returning({ id: formQuestions.id });
    await touchForm(tx, formId);
    return { error: null, questionId: row.id };
  });
  if (result.error !== null) return actionError(result.error);

  revalidateFormPages(form.classroomId, formId);
  return { success: true, questionId: result.questionId };
}

const updateQuestionSchema = z.object({
  questionId: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  title: z.string().trim().min(1).max(FORM_LIMITS.questionTitle),
  description: z.string().max(FORM_LIMITS.questionDescription).nullable(),
  required: z.boolean(),
  config: z.unknown(),
});

export async function updateQuestion(input: z.infer<typeof updateQuestionSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = updateQuestionSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const data = parsed.data;

  const loaded = await loadQuestionForEdit(data.questionId);
  if (!loaded) return actionError(ERR_NOT_AUTHORIZED);
  const { form } = loaded;
  try {
    await assertClassroomEditor(form.classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const config = parseQuestionConfig(data.type, data.config);
  if (!config.ok) return actionError(config.error);

  const result = await db.transaction(async (tx) => {
    if (!(await loadFormRow(form.id, tx, { lock: true }))) return { error: ERR_NOT_AUTHORIZED };
    const [question] = await tx.select().from(formQuestions).where(eq(formQuestions.id, data.questionId)).limit(1);
    if (!question) return { error: ERR_NOT_AUTHORIZED };
    const blocked = checkQuestionChange({
      hasResponses: await hasResponses(tx, form.id),
      before: { type: question.type, config: question.config ?? {} },
      after: { type: data.type, config: config.config },
    });
    if (blocked) return { error: blocked };
    const now = new Date();
    await tx
      .update(formQuestions)
      .set({
        type: data.type,
        title: data.title,
        description: data.description?.trim() ? data.description.trim() : null,
        required: data.required,
        config: config.config,
        updatedAt: now,
      })
      .where(eq(formQuestions.id, data.questionId));
    await touchForm(tx, form.id, now);
    return { error: null };
  });
  if (result.error) return actionError(result.error);

  revalidateFormPages(form.classroomId, form.id);
  return { success: true };
}

const questionIdSchema = z.object({ questionId: z.string().min(1) });

export async function deleteQuestion(input: z.infer<typeof questionIdSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = questionIdSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { questionId } = parsed.data;

  const loaded = await loadQuestionForEdit(questionId);
  if (!loaded) return actionError(ERR_NOT_AUTHORIZED);
  const { form } = loaded;
  try {
    await assertClassroomEditor(form.classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  const result = await db.transaction(async (tx) => {
    if (!(await loadFormRow(form.id, tx, { lock: true }))) return { error: ERR_NOT_AUTHORIZED };
    const blocked = canDeleteQuestion(await hasResponses(tx, form.id));
    if (blocked) return { error: blocked };
    await tx.delete(formQuestions).where(eq(formQuestions.id, questionId));
    const rows = await orderedQuestionIds(tx, form.id);
    await writeOrder(
      tx,
      rows,
      rows.map((r) => r.id),
    );
    await touchForm(tx, form.id);
    return { error: null };
  });
  if (result.error) return actionError(result.error);

  revalidateFormPages(form.classroomId, form.id);
  return { success: true };
}

const moveQuestionSchema = z.object({ questionId: z.string().min(1), direction: z.enum(['up', 'down']) });

export async function moveQuestion(input: z.infer<typeof moveQuestionSchema>): Promise<ActionResult> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = moveQuestionSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { questionId, direction } = parsed.data;

  const loaded = await loadQuestionForEdit(questionId);
  if (!loaded) return actionError(ERR_NOT_AUTHORIZED);
  const { form } = loaded;
  try {
    await assertClassroomEditor(form.classroomId, userId);
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }

  await db.transaction(async (tx) => {
    if (!(await loadFormRow(form.id, tx, { lock: true }))) return;
    const rows = await orderedQuestionIds(tx, form.id);
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(questionId);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return; // no-op at the edges
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await writeOrder(tx, rows, ids);
    await touchForm(tx, form.id);
  });

  revalidateFormPages(form.classroomId, form.id);
  return { success: true };
}

// ---------------------------------------------------------------------------------------------
// Form as phase task (USER-LOCKED)

const addToPhaseSchema = z.object({ formId: z.string().min(1), phaseId: z.string().min(1) });

export async function addFormToPhase(
  input: z.infer<typeof addToPhaseSchema>,
): Promise<ActionResult<{ kind: 'classroom_task' | 'group_todos'; count: number }>> {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const parsed = addToPhaseSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { formId, phaseId } = parsed.data;

  const form = await loadFormRow(formId);
  if (!form) return actionError(ERR_NOT_AUTHORIZED);
  let phase: Awaited<ReturnType<typeof assertPhaseEditor>>['phase'];
  try {
    ({ phase } = await assertPhaseEditor(phaseId, userId));
  } catch {
    return actionError(ERR_NOT_AUTHORIZED);
  }
  if (phase.classroomId !== form.classroomId || phase.isArchived) return actionError(ERR_INPUT);
  const classroomId = form.classroomId;

  const result = await db.transaction(async (tx) => {
    // Form row lock serialises concurrent adds of the same form (duplicate guard below).
    const locked = await loadFormRow(formId, tx, { lock: true });
    if (!locked) return { error: ERR_NOT_AUTHORIZED } as const;

    const [[taskDup], [todoDup]] = await Promise.all([
      tx
        .select({ n: count() })
        .from(classroomTasks)
        .where(and(eq(classroomTasks.phaseId, phaseId), eq(classroomTasks.formId, formId))),
      tx
        .select({ n: count() })
        .from(todos)
        .where(and(eq(todos.phaseId, phaseId), eq(todos.formId, formId), eq(todos.isArchived, false))),
    ]);
    if ((taskDup?.n ?? 0) > 0 || (todoDup?.n ?? 0) > 0) return { error: ERR_ALREADY_IN_PHASE } as const;

    const values = {
      title: locked.title.slice(0, 200),
      description: locked.description,
      submissionMode: locked.responseMode === 'group' ? ('group' as const) : ('individual' as const),
      fileRequirement: 'none' as const,
      deadline: locked.closesAt,
      formId,
    };

    const audience = await loadFormAudience(formId, tx);
    if (audience.length === 0) {
      const [maxRow] = await tx
        .select({ maxOrder: max(classroomTasks.orderIndex) })
        .from(classroomTasks)
        .where(eq(classroomTasks.phaseId, phaseId));
      await tx.insert(classroomTasks).values({
        phaseId,
        ...values,
        orderIndex: (maxRow?.maxOrder ?? -1) + 1,
        createdBy: userId,
      });
      const sync = await syncClassroomTasks(tx, classroomId);
      return {
        error: null,
        kind: 'classroom_task' as const,
        count: sync.groupIds.length,
        groupIds: sync.groupIds,
        r2Keys: sync.r2Keys,
      };
    }

    // Restricted audience: one independent todo per audience group (createTodo pattern).
    const validGroups = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.classroomId, classroomId), inArray(groups.id, audience)))
      .orderBy(asc(groups.createdAt));
    const groupIds = validGroups.map((g) => g.id);
    if (groupIds.length === 0) return { error: ERR_INPUT } as const;
    const assignmentId = groupIds.length > 1 ? createId() : null;
    for (const groupId of groupIds) {
      const [orderRow] = await tx
        .select({ maxOrder: max(todos.orderIndex) })
        .from(todos)
        .where(and(eq(todos.phaseId, phaseId), eq(todos.groupId, groupId), eq(todos.isArchived, false)));
      await tx.insert(todos).values({
        phaseId,
        groupId,
        assignmentId,
        ...values,
        orderIndex: (orderRow?.maxOrder ?? -1) + 1,
        createdBy: userId,
      });
    }
    return { error: null, kind: 'group_todos' as const, count: groupIds.length, groupIds, r2Keys: [] as string[] };
  });
  if (result.error !== null) return actionError(result.error);

  await cleanupR2Objects(result.r2Keys);
  revalidateFormPages(classroomId, formId, result.groupIds);
  return { success: true, kind: result.kind, count: result.count };
}
