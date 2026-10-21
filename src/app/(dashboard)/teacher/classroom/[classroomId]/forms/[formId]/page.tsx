import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from 'cn';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { effectiveFormStatus } from '@/lib/forms';
import { getFormForEditor } from '@/server/queries/form';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_TERTIARY, PAGE_BODY } from '@/components/cocoon/ui';
import { FormBuilder } from '@/components/form/form-builder';
import { FormStatusPill } from '@/components/form/form-pills';
import { AddFormToPhaseButton } from '@/components/form/add-form-to-phase-dialog';

const HEADER_LINK = cn(BTN_TERTIARY, 'inline-flex h-10 items-center text-[14px]');

// Teacher form builder (quick task 261021-r1c). getFormForEditor authorizes (classroom editor).
export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ classroomId: string; formId: string }>;
}) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const { classroomId, formId } = await params;

  const data = await getFormForEditor(formId, userId);
  if (!data || data.classroom.id !== classroomId) notFound();

  const { form } = data;
  const status = effectiveFormStatus(form, new Date());
  const backHref = `/teacher/classroom/${classroomId}?tab=forms`;
  const base = `/teacher/classroom/${classroomId}/forms/${formId}`;
  const linkedPhaseIds = new Set(data.linkedTasks.map((t) => t.phaseId));
  const groupIds = new Set(data.groups.map((g) => g.id));
  const restrictedGroupCount = data.audienceGroupIds.filter((id) => groupIds.has(id)).length;

  return (
    <>
      <CocoonHeader variant="back" backHref={backHref} />
      <PageHeader
        backHref={backHref}
        backLabel={data.classroom.name}
        title={form.title}
        subtitle={
          data.linkedTasks.length > 0
            ? `อยู่ในงานของ Phase: ${data.linkedTasks.map((t) => t.phaseName).join(', ')}`
            : `แบบฟอร์ม · ${data.classroom.name}`
        }
        actions={
          <>
            <FormStatusPill status={status} className="h-[31px] px-3.5 text-[14px]" />
            <Link href={`${base}/responses`} className={HEADER_LINK}>
              ดูคำตอบ ({data.responseCount})
            </Link>
            {/* Served by the student form runner (plan 03). */}
            <a href={`/forms/${formId}`} target="_blank" rel="noopener noreferrer" className={HEADER_LINK}>
              ดูตัวอย่าง
            </a>
            <AddFormToPhaseButton
              mode="pick-phase"
              formId={formId}
              formStatus={form.status}
              restrictedGroupCount={restrictedGroupCount}
              phases={data.phases.map((p) => ({ id: p.id, name: p.name, alreadyLinked: linkedPhaseIds.has(p.id) }))}
              className={cn(HEADER_LINK, 'bg-cocoon-blue-soft')}
            />
          </>
        }
      />
      <div className={PAGE_BODY}>
        <FormBuilder
          formId={formId}
          classroomId={classroomId}
          status={form.status}
          effectiveStatus={status}
          settings={{
            title: form.title,
            description: form.description,
            responseMode: form.responseMode,
            closesAt: form.closesAt,
            audienceGroupIds: data.audienceGroupIds,
          }}
          groups={data.groups}
          questions={data.questions}
          hasResponses={data.hasResponses}
          responseCount={data.responseCount}
          linkedTaskCount={data.linkedTasks.length}
        />
      </div>
    </>
  );
}
