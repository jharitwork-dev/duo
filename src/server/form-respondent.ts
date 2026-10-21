// Classroom forms (quick task 261021-r1c) — server-side respondent resolution.
// Plain server module (not a server action file). Membership, group, owner key and eligibility are
// ALWAYS derived from the database here — never from client input.

import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema/classrooms';
import { and, eq } from 'drizzle-orm';
import { decideFormEligibility, type FormQuestionDef } from '@/lib/forms';
import { loadFormAudience, loadFormQuestions, loadFormRow, type FormRow } from '@/server/queries/form';
import { getStudentGroup } from '@/server/queries/group';

export type FormEligibility = ReturnType<typeof decideFormEligibility>;

export interface Respondent {
  form: FormRow;
  classroomId: string;
  classroomName: string;
  questions: FormQuestionDef[];
  audienceGroupIds: string[];
  /** The caller's group in the form's classroom (from group_members), or null. */
  group: { id: string; name: string } | null;
  eligibility: FormEligibility;
  /** Owner key of the caller's response (individual: user id; group: group id), or null. */
  ownerKey: string | null;
}

/** Null when the form does not exist. Callers must check `eligibility.visible` / `canRespond`. */
export async function resolveRespondent(formId: string, userId: string, now = new Date()): Promise<Respondent | null> {
  const form = await loadFormRow(formId);
  if (!form) return null;

  const [questions, audienceGroupIds, membership, classroomRows, studentGroup] = await Promise.all([
    loadFormQuestions(formId),
    loadFormAudience(formId),
    db
      .select({ id: classroomMembers.id })
      .from(classroomMembers)
      .where(
        and(
          eq(classroomMembers.classroomId, form.classroomId),
          eq(classroomMembers.userId, userId),
          eq(classroomMembers.role, 'student'),
        ),
      )
      .limit(1),
    db.select({ name: classrooms.name }).from(classrooms).where(eq(classrooms.id, form.classroomId)).limit(1),
    getStudentGroup(form.classroomId, userId),
  ]);

  const isClassroomStudent = membership.length > 0;
  const group = isClassroomStudent && studentGroup ? { id: studentGroup.id, name: studentGroup.name } : null;
  const eligibility = decideFormEligibility({
    form,
    audienceGroupIds,
    isClassroomStudent,
    userId,
    studentGroupId: group?.id ?? null,
    now,
  });

  return {
    form,
    classroomId: form.classroomId,
    classroomName: classroomRows[0]?.name ?? '',
    questions,
    audienceGroupIds,
    group,
    eligibility,
    ownerKey: eligibility.ownerKey,
  };
}
