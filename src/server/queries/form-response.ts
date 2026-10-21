// Classroom forms (quick task 261021-r1c) — student-facing queries. Server-only (imports the user
// directory). Every query derives membership / group / eligibility on the server.

import { db } from '@/db';
import { forms, formGroups, formResponses } from '@/db/schema/forms';
import { classroomMembers } from '@/db/schema/classrooms';
import { and, eq, inArray, ne } from 'drizzle-orm';
import {
  decideFormEligibility,
  effectiveFormStatus,
  type FormAnswers,
  type FormQuestionDef,
  type FormStatus,
  type ResponseMode,
} from '@/lib/forms';
import { getUserDirectory } from '@/lib/user-directory';
import { resolveRespondent, type FormEligibility } from '@/server/form-respondent';
import { getStudentGroup } from '@/server/queries/group';

export type FormQuestion = FormQuestionDef;

export interface RespondentFormView {
  form: {
    id: string;
    classroomId: string;
    title: string;
    description: string | null;
    responseMode: ResponseMode;
    status: FormStatus;
    closesAt: Date | null;
    effectiveStatus: FormStatus;
  };
  questions: FormQuestion[];
  eligibility: FormEligibility;
  respondent: { classroomId: string; groupId: string | null; ownerKey: string };
  response: null | {
    answers: FormAnswers;
    submittedAt: Date;
    updatedAt: Date;
    /** Public name of the last editor, or 'คุณ' when it is the caller. */
    lastEditorName: string;
  };
}

/**
 * The form as the calling student sees it, plus their own (or their group's) response.
 * Null unless the form is visible to the caller. `respondent.ownerKey` is '' when the caller has no
 * owner key (group mode without a group); no response is loaded in that case.
 */
export async function getFormForRespondent(formId: string, userId: string): Promise<RespondentFormView | null> {
  const now = new Date();
  const r = await resolveRespondent(formId, userId, now);
  if (!r || !r.eligibility.visible) return null;

  let response: RespondentFormView['response'] = null;
  if (r.ownerKey) {
    const [row] = await db
      .select()
      .from(formResponses)
      .where(and(eq(formResponses.formId, formId), eq(formResponses.ownerKey, r.ownerKey)))
      .limit(1);
    if (row) {
      let lastEditorName = 'คุณ';
      if (row.userId !== userId) {
        const directory = await getUserDirectory([row.userId]).catch(() => null);
        lastEditorName = directory?.get(row.userId)?.publicName ?? 'สมาชิกในกลุ่ม';
      }
      response = {
        answers: (row.answers ?? {}) as FormAnswers,
        submittedAt: row.submittedAt,
        updatedAt: row.updatedAt,
        lastEditorName,
      };
    }
  }

  return {
    form: {
      id: r.form.id,
      classroomId: r.form.classroomId,
      title: r.form.title,
      description: r.form.description,
      responseMode: r.form.responseMode,
      status: r.form.status,
      closesAt: r.form.closesAt,
      effectiveStatus: effectiveFormStatus(r.form, now),
    },
    questions: r.questions,
    eligibility: r.eligibility,
    respondent: { classroomId: r.classroomId, groupId: r.group?.id ?? null, ownerKey: r.ownerKey ?? '' },
    response,
  };
}

export type StudentFormState = 'todo' | 'done' | 'closed' | 'no_group';

export interface StudentFormItem {
  id: string;
  title: string;
  closesAt: Date | null;
  responseMode: ResponseMode;
  state: StudentFormState;
}

const STATE_ORDER: Record<StudentFormState, number> = { todo: 0, no_group: 1, done: 2, closed: 3 };

/**
 * Forms of a classroom visible to the calling student (never drafts / out-of-audience), with their
 * state. Order: todo first, then by closesAt asc (nulls last). [] when not a classroom student.
 */
export async function getStudentForms(classroomId: string, userId: string): Promise<StudentFormItem[]> {
  const [membership, group, formRows] = await Promise.all([
    db
      .select({ id: classroomMembers.id })
      .from(classroomMembers)
      .where(
        and(
          eq(classroomMembers.classroomId, classroomId),
          eq(classroomMembers.userId, userId),
          eq(classroomMembers.role, 'student'),
        ),
      )
      .limit(1),
    getStudentGroup(classroomId, userId),
    db
      .select()
      .from(forms)
      .where(and(eq(forms.classroomId, classroomId), ne(forms.status, 'draft'))),
  ]);
  if (membership.length === 0 || formRows.length === 0) return [];

  const formIds = formRows.map((f) => f.id);
  const ownerKeys = group ? [userId, group.id] : [userId];
  const [audienceRows, responseRows] = await Promise.all([
    db
      .select({ formId: formGroups.formId, groupId: formGroups.groupId })
      .from(formGroups)
      .where(inArray(formGroups.formId, formIds)),
    db
      .select({ formId: formResponses.formId, ownerKey: formResponses.ownerKey })
      .from(formResponses)
      .where(and(inArray(formResponses.formId, formIds), inArray(formResponses.ownerKey, ownerKeys))),
  ]);
  const audienceBy = new Map<string, string[]>();
  for (const a of audienceRows) {
    const list = audienceBy.get(a.formId) ?? [];
    list.push(a.groupId);
    audienceBy.set(a.formId, list);
  }
  const answered = new Set(responseRows.map((r) => `${r.formId}\u0000${r.ownerKey}`));

  const now = new Date();
  const items: StudentFormItem[] = [];
  for (const form of formRows) {
    const eligibility = decideFormEligibility({
      form,
      audienceGroupIds: audienceBy.get(form.id) ?? [],
      isClassroomStudent: true,
      userId,
      studentGroupId: group?.id ?? null,
      now,
    });
    if (!eligibility.visible) continue;
    let state: StudentFormState;
    if (eligibility.ownerKey && answered.has(`${form.id}\u0000${eligibility.ownerKey}`)) state = 'done';
    else if (eligibility.reason === 'closed') state = 'closed';
    else if (eligibility.reason === 'no_group') state = 'no_group';
    else state = 'todo';
    items.push({ id: form.id, title: form.title, closesAt: form.closesAt, responseMode: form.responseMode, state });
  }

  return items.sort((a, b) => {
    const byState = (a.state === 'todo' ? 0 : 1) - (b.state === 'todo' ? 0 : 1);
    if (byState !== 0) return byState;
    const at = a.closesAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.closesAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at < bt ? -1 : 1;
    return STATE_ORDER[a.state] - STATE_ORDER[b.state];
  });
}

/** Number of forms in state 'todo' per classroom (missing classrooms → 0 entry). */
export async function getPendingFormCounts(userId: string, classroomIds: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(classroomIds)];
  const counts: Record<string, number> = {};
  await Promise.all(
    ids.map(async (classroomId) => {
      const items = await getStudentForms(classroomId, userId);
      counts[classroomId] = items.filter((f) => f.state === 'todo').length;
    }),
  );
  return counts;
}
