// Full-screen Typeform-style form (quick task 261021-r1c): students answer, classroom editors preview.
import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getFormForEditor } from '@/server/queries/form';
import { getFormForRespondent } from '@/server/queries/form-response';
import { FormRunner, type RunnerInitial } from '@/components/form/form-runner';

type Params = Promise<{ formId: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const TODO_ID = /^[A-Za-z0-9_-]{1,64}$/;

const CLOSED_REASON: Record<string, string> = {
  closed: 'แบบฟอร์มปิดรับคำตอบแล้ว',
  no_group: 'ต้องเข้ากลุ่มก่อนจึงจะตอบแบบฟอร์มนี้ได้',
};

// Deduped between generateMetadata and the page within one request.
const loadForRole = cache(async (formId: string) => {
  const [role, userId] = await Promise.all([getCurrentRole(), getCurrentUserId()]);
  if (role === ROLES.STUDENT) {
    return { kind: 'student' as const, view: await getFormForRespondent(formId, userId) };
  }
  if (role === ROLES.TEACHER || role === ROLES.SUPERADMIN) {
    return { kind: 'editor' as const, data: await getFormForEditor(formId, userId) };
  }
  return { kind: 'none' as const };
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { formId } = await params;
  const loaded = await loadForRole(formId).catch(() => null);
  const title =
    loaded?.kind === 'student' ? loaded.view?.form.title : loaded?.kind === 'editor' ? loaded.data?.form.title : null;
  return { title: title ? `${title} | build.Innovator` : 'แบบฟอร์ม | build.Innovator' };
}

export default async function FormPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ formId }, sp] = await Promise.all([params, searchParams]);
  const loaded = await loadForRole(formId);

  if (loaded.kind === 'student') {
    const view = loaded.view;
    if (!view) redirect('/student');
    const todoParam = typeof sp.todo === 'string' && TODO_ID.test(sp.todo) ? sp.todo : null;
    const { classroomId, groupId } = view.respondent;
    const returnHref = todoParam
      ? `/todo/${todoParam}`
      : groupId
        ? `/student/classroom/${classroomId}/group/${groupId}`
        : `/student/classroom/${classroomId}`;
    const initial: RunnerInitial | null = view.response
      ? {
          answers: view.response.answers,
          updatedAt: view.response.updatedAt.toISOString(),
          lastEditorName: view.response.lastEditorName,
        }
      : null;
    return (
      <FormRunner
        mode="respond"
        form={{
          id: view.form.id,
          title: view.form.title,
          description: view.form.description,
          responseMode: view.form.responseMode,
          closesAt: view.form.closesAt ? view.form.closesAt.toISOString() : null,
        }}
        questions={view.questions}
        initial={initial}
        canRespond={view.eligibility.canRespond}
        closedReason={view.eligibility.canRespond ? undefined : CLOSED_REASON[view.eligibility.reason]}
        returnHref={returnHref}
        returnLabel={todoParam ? 'กลับไปที่งาน' : 'กลับหน้าหลัก'}
      />
    );
  }

  if (loaded.kind === 'editor') {
    const data = loaded.data;
    if (!data) notFound();
    return (
      <FormRunner
        mode="preview"
        form={{
          id: data.form.id,
          title: data.form.title,
          description: data.form.description,
          responseMode: data.form.responseMode,
          closesAt: data.form.closesAt ? data.form.closesAt.toISOString() : null,
        }}
        questions={data.questions}
        initial={null}
        canRespond
        returnHref={`/teacher/classroom/${data.classroom.id}/forms/${data.form.id}`}
        returnLabel="กลับไปแก้ไขแบบฟอร์ม"
      />
    );
  }

  notFound();
}
