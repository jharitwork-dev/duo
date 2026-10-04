import { redirect } from 'next/navigation';
import { getSubmissionHistory } from '@/server/queries/submission';
import { getStudentWorkPage, type StudentWorkPageData } from '@/server/queries/work-page';
import { parseDeliverables } from '@/lib/todo-deliverables';
import type { FileRequirement } from '@/lib/work-page';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { StatusPill } from '@/components/cocoon/status-pill';
import { StudentWorkPage } from '@/components/work-page/student-work-page';
import { TodoDetailView } from './todo-detail-view';
import { HistoryCard, HistoryListCard, ReviewerNoteCard, type StudentSubmission } from './submission-status-view';

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
  return (
    <StudentTodoScreen
      todo={{
        id: todo.id,
        title: todo.title,
        description: todo.description,
        notes: todo.notes,
        submissionMode: todo.submissionMode,
        fileRequirement: todo.fileRequirement,
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

interface StudentTodoScreenProps {
  todo: {
    id: string;
    title: string;
    description: string | null;
    notes: string | null;
    submissionMode: 'group' | 'individual';
    fileRequirement: FileRequirement;
    attachments: { id: string; fileName: string; contentType: string; fileSize: number }[];
  };
  workPage: StudentWorkPageData;
  /** Newest first. */
  submissions: StudentSubmission[];
  groupHome: string;
}

/** Presentational to-do screen (plain props, no data access). */
export function StudentTodoScreen({ todo, workPage, submissions, groupHome }: StudentTodoScreenProps) {
  const [firstLineRaw, ...restLines] = (todo.description ?? '').split(/\r?\n/);
  const firstLine = firstLineRaw?.trim() ?? '';
  const moreDescription = restLines.join('\n').trim();
  const { items, rest } = parseDeliverables(todo.notes);

  const latest = submissions[0];
  const resubmit = latest?.status === 'rejected';
  const pill = latest ? <StatusPill status={latest.status} size="xl" /> : undefined;

  return (
    <>
      <CocoonHeader variant="back" backHref={groupHome} />

      {/* Mobile title block (260928-iwi) */}
      <div className="-mt-2 px-[31px] lg:hidden">
        <h1 className="text-[32px] leading-tight font-bold break-words text-cocoon-blue">{todo.title}</h1>
        {firstLine && <p className="text-[12px] leading-normal font-bold text-cocoon-muted">{firstLine}</p>}
        {latest && (
          <div className="mt-2">
            <StatusPill status={latest.status} size="lg" />
          </div>
        )}
      </div>

      {/* Desktop page header (design/mac) */}
      <PageHeader
        className="hidden lg:block"
        backHref={groupHome}
        backLabel="งานของฉัน"
        title={todo.title}
        subtitle={firstLine || undefined}
        actions={pill}
      />

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
          />
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
    </>
  );
}
