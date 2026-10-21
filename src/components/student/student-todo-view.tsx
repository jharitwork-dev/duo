import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cn } from 'cn';
import { getFormForRespondent } from '@/server/queries/form-response';
import type { FormStatus } from '@/lib/forms';
import { BTN_PRIMARY, CARD, CARD_META, CARD_TITLE } from '@/components/cocoon/ui';
import { getSubmissionHistory } from '@/server/queries/submission';
import { getStudentWorkPage, type StudentWorkPageData } from '@/server/queries/work-page';
import { parseDeliverables } from '@/lib/todo-deliverables';
import type { FileRequirement } from '@/lib/work-page';
import { getDeadlineStatus } from '@/lib/deadline';
import { DeadlineBanner } from '@/components/deadline/deadline-banner';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { StatusPill } from '@/components/cocoon/status-pill';
import { StudentWorkPage } from '@/components/work-page/student-work-page';
import { TodoDetailView } from './todo-detail-view';
import { HistoryCard, HistoryListCard, ReviewerNoteCard, type StudentSubmission } from './submission-status-view';
import { CommentThreadSection, CommentThreadSkeleton } from '@/components/comment/comment-thread-section';
import { ClassroomTaskBadge } from '@/components/classroom-task/classroom-task-badge';

/**
 * Server component: Cocoon to-do page for students (261004-01i). One page:
 * teacher detail → reviewer note (if rejected) → work page (editor + files + submit) → history.
 * The old `?step=upload` flow is gone; a stale `step` param is ignored.
 */
export async function StudentTodoView({ todoId, userId }: { todoId: string; userId: string }) {
  const [data, workPage] = await Promise.all([
    getSubmissionHistory(todoId, userId),
    getStudentWorkPage(todoId, userId),
  ]);
  if (!data || !workPage) redirect('/student');

  const { todo, classroomId, groupId, submissions } = data;
  // Form-linked to-do (261021-r1c): answered only through the form; decorative fetch, null on failure.
  const formView = todo.formId ? await getFormForRespondent(todo.formId, userId).catch(() => null) : null;
  const formTask: FormTaskInfo | null = todo.formId
    ? {
        formId: todo.formId,
        status: formView?.form.effectiveStatus ?? null,
        answered: !!formView?.response,
      }
    : null;
  return (
    <StudentTodoScreen
      formTask={formTask}
      todo={{
        id: todo.id,
        title: todo.title,
        description: todo.description,
        notes: todo.notes,
        submissionMode: todo.submissionMode,
        fileRequirement: todo.fileRequirement,
        classroomTaskId: todo.classroomTaskId ?? null,
        attachments: todo.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          contentType: a.contentType,
          fileSize: a.fileSize,
        })),
      }}
      workPage={workPage}
      submissions={submissions}
      groupHome={`/student/classroom/${classroomId}/group/${groupId}`}
    />
  );
}

/** Form-linked to-do state for FormTaskCard. `status` null = form not visible (draft / missing). */
export interface FormTaskInfo {
  formId: string;
  status: FormStatus | null;
  answered: boolean;
}

/**
 * Replaces the work page on form-linked to-dos: the only path to submit is the form itself
 * (the work-page actions reject these to-dos server-side with FORM_TASK_WORK_PAGE_ERROR).
 */
export function FormTaskCard({
  todoId,
  formTask,
  phaseViewable,
}: {
  todoId: string;
  formTask: FormTaskInfo;
  phaseViewable: boolean;
}) {
  const href = `/forms/${formTask.formId}?todo=${todoId}`;
  const unavailable = formTask.status === null || formTask.status === 'draft';
  const closed = formTask.status === 'closed';
  const label = formTask.answered ? 'ดู / แก้ไขคำตอบ' : 'ตอบแบบฟอร์ม';

  return (
    <section className={cn(CARD, 'space-y-3')} aria-label="งานนี้ตอบผ่านแบบฟอร์ม">
      <h2 className={CARD_TITLE}>งานนี้ตอบผ่านแบบฟอร์ม</h2>
      <p className={CARD_META}>ส่งแบบฟอร์มแล้วงานจะเข้าสถานะรอตรวจ</p>
      {!phaseViewable && !unavailable && !closed && (
        <p
          role="status"
          className="rounded-[12px] border border-cocoon-line bg-black/5 px-4 py-2.5 text-[14px] leading-normal font-bold text-cocoon-muted"
        >
          Phase นี้ยังไม่ปลดล็อค — ส่งแบบฟอร์มได้แต่ยังไม่นับเป็นการส่งงาน
        </p>
      )}
      {unavailable ? (
        <button
          type="button"
          disabled
          className={cn(BTN_PRIMARY, 'w-full cursor-not-allowed opacity-50 hover:bg-primary')}
        >
          ครูยังไม่เปิดแบบฟอร์มนี้
        </button>
      ) : closed ? (
        <>
          <p className="text-[14px] leading-normal font-bold text-cocoon-muted">แบบฟอร์มปิดรับคำตอบแล้ว</p>
          {formTask.answered && (
            <Link href={href} className={cn(BTN_PRIMARY, 'flex w-full items-center justify-center')}>
              ดูคำตอบ
            </Link>
          )}
        </>
      ) : (
        <Link href={href} className={cn(BTN_PRIMARY, 'flex w-full items-center justify-center')}>
          {label}
        </Link>
      )}
    </section>
  );
}

interface StudentTodoScreenProps {
  /** Set when the to-do is a form task (261021-r1c): FormTaskCard replaces the work page. */
  formTask?: FormTaskInfo | null;
  todo: {
    id: string;
    title: string;
    description: string | null;
    notes: string | null;
    submissionMode: 'group' | 'individual';
    fileRequirement: FileRequirement;
    /** Copy of a classroom-level task (261004-j6h) → 🔒 badge. */
    classroomTaskId?: string | null;
    attachments: { id: string; fileName: string; contentType: string; fileSize: number }[];
  };
  workPage: StudentWorkPageData;
  /** Newest first. */
  submissions: StudentSubmission[];
  groupHome: string;
}

/** Presentational to-do screen (plain props, no data access). */
export function StudentTodoScreen({ todo, workPage, submissions, groupHome, formTask }: StudentTodoScreenProps) {
  const [firstLineRaw, ...restLines] = (todo.description ?? '').split(/\r?\n/);
  const firstLine = firstLineRaw?.trim() ?? '';
  const moreDescription = restLines.join('\n').trim();
  const { items, rest } = parseDeliverables(todo.notes);

  const latest = submissions[0];
  const resubmit = latest?.status === 'rejected';
  const pill = latest ? <StatusPill status={latest.status} size="xl" /> : undefined;

  // Lateness is decided by the FIRST submission (oldest = last, since newest first).
  const first = submissions.length > 0 ? submissions[submissions.length - 1] : undefined;
  const deadlineInfo = getDeadlineStatus({
    deadline: workPage.deadline,
    firstSubmittedAt: first?.createdAt ?? null,
    latestStatus: workPage.latestStatus,
    now: new Date(workPage.serverNow),
  });
  const banner = (
    <DeadlineBanner
      deadline={workPage.deadline}
      status={deadlineInfo.status}
      lateMs={deadlineInfo.lateMs}
      overdueMs={deadlineInfo.overdueMs}
      nowIso={workPage.serverNow}
    />
  );

  return (
    <>
      <CocoonHeader variant="back" backHref={groupHome} />

      {/* Mobile title block (260928-iwi) */}
      <div className="-mt-2 px-[31px] lg:hidden">
        <h1 className="text-[32px] leading-tight font-bold break-words text-cocoon-blue">{todo.title}</h1>
        {todo.classroomTaskId && <ClassroomTaskBadge className="mt-1" />}
        {firstLine && <p className="text-[12px] leading-normal font-bold text-cocoon-muted">{firstLine}</p>}
        {latest && (
          <div className="mt-2">
            <StatusPill status={latest.status} size="lg" />
          </div>
        )}
        {workPage.deadline && <div className="mt-3">{banner}</div>}
      </div>

      {/* Desktop page header (design/mac) */}
      <PageHeader
        className="hidden lg:block"
        backHref={groupHome}
        backLabel="งานของฉัน"
        title={todo.title}
        subtitle={firstLine || undefined}
        actions={
          todo.classroomTaskId ? (
            <>
              <ClassroomTaskBadge className="h-[24px] px-2.5" />
              {pill}
            </>
          ) : (
            pill
          )
        }
      />
      {workPage.deadline && <div className="mt-4 hidden lg:block">{banner}</div>}

      <TodoDetailView
        description={moreDescription}
        notes={rest}
        deliverables={items}
        attachments={todo.attachments}
        fileRequirement={todo.fileRequirement}
      />

      <div className="mt-4 space-y-4 px-[33px] lg:mt-8 lg:grid lg:grid-cols-[664px_1fr] lg:items-start lg:gap-8 lg:space-y-0 lg:px-0 max-xl:lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4 lg:space-y-6">
          {resubmit && <ReviewerNoteCard title="คำแนะนำจากผู้ตรวจ" comment={latest.reviewerComment} />}
          {latest?.status === 'approved' && latest.reviewerComment && (
            <ReviewerNoteCard tone="approved" title="ข้อความจากผู้ตรวจ" comment={latest.reviewerComment} />
          )}
          {formTask ? (
            <FormTaskCard todoId={todo.id} formTask={formTask} phaseViewable={workPage.phaseViewable} />
          ) : (
            <StudentWorkPage
              todoId={todo.id}
              todoTitle={todo.title}
              submissionMode={todo.submissionMode}
              initial={workPage.page}
              files={workPage.files}
              fileRequirement={workPage.fileRequirement}
              storageReady={workPage.storageReady}
              canEdit={workPage.canEdit}
              phaseViewable={workPage.phaseViewable}
              latestStatus={workPage.latestStatus}
              resubmit={resubmit}
              deadline={workPage.deadline}
              lock={workPage.lock}
              latestSubmission={workPage.latestSubmission}
              latestAttempt={latest?.attempt}
              serverNow={workPage.serverNow}
            />
          )}
        </div>

        {submissions.length > 0 && (
          <div className="min-w-0">
            <div className="lg:hidden">
              <HistoryCard submissions={submissions} />
            </div>
            <div className="hidden lg:block">
              <HistoryListCard submissions={submissions} />
            </div>
          </div>
        )}
      </div>

      {/* Discussion thread (261004-fgj): self-contained block under the work page + history. */}
      <div className="mt-4 px-[33px] lg:mt-8 lg:max-w-[664px] lg:px-0 max-xl:lg:max-w-none">
        <Suspense fallback={<CommentThreadSkeleton />}>
          <CommentThreadSection todoId={todo.id} viewer="student" />
        </Suspense>
      </div>
    </>
  );
}
