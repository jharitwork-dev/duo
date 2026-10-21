'use server';

// Classroom forms (quick task 261021-r1c) — student server actions: save response (+ submission
// bridge for form-linked phase tasks), presigned upload for file questions, own-file download.
// The respondent's classroom membership, group and owner key are ALWAYS derived on the server via
// resolveRespondent — no group id is ever read from client input.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { formResponses } from '@/db/schema/forms';
import { submissions } from '@/db/schema/submissions';
import { todos } from '@/db/schema/todos';
import { and, eq } from 'drizzle-orm';
import { getCurrentUserId, requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { getR2Config, presignGet, presignPut, validateSubmissionFile } from '@/lib/r2';
import { cleanupR2Objects } from '@/lib/r2-cleanup';
import { actionError, type ActionResult } from '@/lib/action-result';
import { computeOrphanFileKeys, plainTextFromDoc } from '@/lib/work-page';
import {
  buildFormFileKey,
  buildFormSnapshotDoc,
  effectiveFormStatus,
  isFormFileKeyInScope,
  planFormSubmissionBridge,
  validateAnswers,
  type EligibilityReason,
  type FormAnswers,
} from '@/lib/forms';
import { resolveRespondent } from '@/server/form-respondent';
import { loadFormRow } from '@/server/queries/form';
import { latestScopedSubmission, loadWorkPageAccess } from '@/server/work-page-access';

const NOT_AUTHORIZED = 'Form not found or not authorized';
const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';
const ERR_CLOSED = 'แบบฟอร์มปิดรับคำตอบแล้ว';
const ERR_NO_GROUP = 'ต้องเข้ากลุ่มก่อนจึงจะตอบได้';
const ERR_REQUIRED = 'กรุณาตอบคำถามที่จำเป็นให้ครบ';
const ERR_NO_STORAGE = 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์';
const ERR_FILE = 'ไฟล์ไม่รองรับหรือใหญ่เกิน 10 MB';
const ERR_NOT_FILE_QUESTION = 'คำถามนี้ไม่รับไฟล์';
const ERR_FILE_NOT_FOUND = 'ไม่พบไฟล์';

const id = z.string().min(1).max(64);

function reasonError(reason: EligibilityReason): string {
  if (reason === 'closed') return ERR_CLOSED;
  if (reason === 'no_group') return ERR_NO_GROUP;
  return ERR_INPUT;
}

function fileKeysOf(answers: FormAnswers | null | undefined): string[] {
  if (!answers || typeof answers !== 'object') return [];
  const keys: string[] = [];
  for (const value of Object.values(answers)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'file' && value.key) {
      keys.push(value.key);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Save response

const saveSchema = z.object({ formId: id, answers: z.unknown() });

export type SaveFormResponseResult =
  | { success: true; updatedAt: string; linkedTodoIds: string[] }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function saveFormResponse(input: z.infer<typeof saveSchema>): Promise<SaveFormResponseResult> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { formId } = parsed.data;

  const respondent = await resolveRespondent(formId, userId);
  if (!respondent || !respondent.eligibility.visible) throw new Error(NOT_AUTHORIZED);
  const { eligibility, group, questions, classroomId } = respondent;
  if (!eligibility.canRespond || !respondent.ownerKey) return actionError(reasonError(eligibility.reason));
  const ownerKey = respondent.ownerKey;

  const validated = validateAnswers(questions, parsed.data.answers, { formId, ownerKey });
  if (!validated.ok) {
    const fieldErrors = { ...validated.errors };
    const formError = fieldErrors._form;
    delete fieldErrors._form;
    return { success: false, error: formError ?? ERR_REQUIRED, fieldErrors };
  }
  const answers = validated.answers;

  // Form-linked to-dos of the student's own group (server-derived). Each must pass the normal
  // student to-do access rule; phase viewability is handed to the bridge planner.
  const linked = group
    ? await db
        .select({ id: todos.id })
        .from(todos)
        .where(and(eq(todos.formId, formId), eq(todos.groupId, group.id), eq(todos.isArchived, false)))
    : [];
  const linkedAccess = (
    await Promise.all(linked.map((t) => loadWorkPageAccess(t.id, userId).catch(() => null)))
  ).filter((a): a is NonNullable<typeof a> => a !== null && a.groupId === group?.id);

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    // Lock the form row: serialises with a teacher closing the form.
    const form = await loadFormRow(formId, tx, { lock: true });
    if (!form || form.status === 'draft') return { kind: 'blocked' as const, message: ERR_INPUT };
    if (effectiveFormStatus(form, now) !== 'open') return { kind: 'blocked' as const, message: ERR_CLOSED };

    const [existing] = await tx
      .select({ id: formResponses.id, answers: formResponses.answers })
      .from(formResponses)
      .where(and(eq(formResponses.formId, formId), eq(formResponses.ownerKey, ownerKey)))
      .for('update');

    const [saved] = await tx
      .insert(formResponses)
      .values({
        formId,
        ownerKey,
        userId,
        groupId: group?.id ?? null,
        answers,
        submittedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [formResponses.formId, formResponses.ownerKey],
        set: { answers, userId, groupId: group?.id ?? null, updatedAt: now },
      })
      .returning({ updatedAt: formResponses.updatedAt });

    // Submission bridge (USER-LOCKED): viewable linked to-dos get a pending submission.
    const touched: string[] = [];
    if (group && linkedAccess.length > 0) {
      const snapshot = buildFormSnapshotDoc({ formTitle: form.title, questions, answers });
      const textContent = plainTextFromDoc(snapshot).slice(0, 20000) || null;
      for (const access of linkedAccess) {
        const latest = await latestScopedSubmission(
          tx,
          access.todo.id,
          access.todo.submissionMode,
          group.id,
          userId,
          { lock: true },
        );
        const [plan] = planFormSubmissionBridge([
          {
            todoId: access.todo.id,
            phaseViewable: access.phaseViewable,
            latestStatus: latest?.status ?? 'none',
            latestSubmissionId: latest?.id ?? null,
          },
        ]);
        if (plan.action === 'insert') {
          await tx.insert(submissions).values({
            todoId: access.todo.id,
            submittedBy: userId,
            groupId: group.id,
            status: 'pending',
            content: snapshot,
            textContent,
          });
          touched.push(access.todo.id);
        } else if (plan.action === 'update') {
          const updated = await tx
            .update(submissions)
            .set({ content: snapshot, textContent, updatedAt: now })
            .where(and(eq(submissions.id, plan.submissionId), eq(submissions.status, 'pending')))
            .returning({ id: submissions.id });
          if (updated.length > 0) touched.push(access.todo.id);
        }
        // 'skip' (phase_locked / approved): response saved, submission untouched.
      }
    }

    return {
      kind: 'ok' as const,
      updatedAt: saved.updatedAt,
      oldKeys: fileKeysOf(existing?.answers as FormAnswers | undefined),
      linkedTodoIds: touched,
    };
  });

  if (result.kind === 'blocked') return actionError(result.message);

  // Best-effort: files replaced / removed by this save are no longer referenced anywhere.
  await cleanupR2Objects(computeOrphanFileKeys(result.oldKeys, fileKeysOf(answers)));

  revalidatePath(`/forms/${formId}`);
  revalidatePath(`/student/classroom/${classroomId}`, 'layout');
  revalidatePath('/student');
  revalidatePath(`/teacher/classroom/${classroomId}/forms/${formId}/responses`);
  revalidatePath(`/teacher/classroom/${classroomId}`);
  if (group) {
    revalidatePath(`/student/classroom/${classroomId}/group/${group.id}`);
    revalidatePath(`/teacher/classroom/${classroomId}/group/${group.id}`);
  }
  if (result.linkedTodoIds.length > 0) {
    for (const todoId of result.linkedTodoIds) revalidatePath(`/todo/${todoId}`);
    revalidatePath('/teacher/review');
    revalidatePath('/teacher/review/[submissionId]', 'page');
    revalidatePath('/teacher');
  }

  return { success: true, updatedAt: result.updatedAt.toISOString(), linkedTodoIds: result.linkedTodoIds };
}

// ---------------------------------------------------------------------------------------------
// File upload (presigned PUT scoped to forms/{formId}/{ownerKey}/)

const uploadSchema = z.object({
  formId: id,
  questionId: id,
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

export async function createFormUploadUrl(
  input: z.infer<typeof uploadSchema>,
): Promise<ActionResult<{ key: string; url: string }>> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const data = parsed.data;

  const respondent = await resolveRespondent(data.formId, userId);
  if (!respondent || !respondent.eligibility.visible) throw new Error(NOT_AUTHORIZED);
  if (!respondent.eligibility.canRespond || !respondent.ownerKey) {
    return actionError(reasonError(respondent.eligibility.reason));
  }
  const question = respondent.questions.find((q) => q.id === data.questionId);
  if (!question || question.type !== 'file') return actionError(ERR_NOT_FILE_QUESTION);
  if (!getR2Config()) return actionError(ERR_NO_STORAGE);
  if (!validateSubmissionFile(data.contentType, data.size)) return actionError(ERR_FILE);

  const key = buildFormFileKey(data.formId, respondent.ownerKey, createId(), data.fileName);
  try {
    const url = await presignPut(key, data.contentType);
    return { success: true, key, url };
  } catch {
    return actionError(ERR_NO_STORAGE);
  }
}

// ---------------------------------------------------------------------------------------------
// Own file download (the caller's own / group's response only)

const fileSchema = z.object({ formId: id, questionId: id });

export async function getMyFormFileUrl(input: z.infer<typeof fileSchema>): Promise<ActionResult<{ url: string }>> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { formId, questionId } = parsed.data;

  const respondent = await resolveRespondent(formId, userId);
  if (!respondent || !respondent.eligibility.visible) throw new Error(NOT_AUTHORIZED);
  const ownerKey = respondent.ownerKey;
  if (!ownerKey) return actionError(ERR_FILE_NOT_FOUND);

  const [row] = await db
    .select({ answers: formResponses.answers })
    .from(formResponses)
    .where(and(eq(formResponses.formId, formId), eq(formResponses.ownerKey, ownerKey)))
    .limit(1);
  const value = (row?.answers as FormAnswers | undefined)?.[questionId];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.kind !== 'file' ||
    !isFormFileKeyInScope(value.key, formId, ownerKey)
  ) {
    return actionError(ERR_FILE_NOT_FOUND);
  }

  try {
    const url = await presignGet(value.key, 3600, `inline; filename="${encodeURIComponent(value.name)}"`);
    return { success: true, url };
  } catch {
    return actionError(ERR_NO_STORAGE);
  }
}
