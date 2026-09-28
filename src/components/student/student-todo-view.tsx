import { redirect } from 'next/navigation';
import { getSubmissionHistory } from '@/server/queries/submission';
import { isPhaseViewable } from '@/lib/node-path';
import { parseDeliverables } from '@/lib/todo-deliverables';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { StatusPill } from '@/components/cocoon/status-pill';
import { TodoDetailView } from './todo-detail-view';
import { TodoSubmitView } from './todo-submit-view';
import {
  SubmissionStatusDesktop,
  SubmissionStatusView,
  type StudentSubmission,
} from './submission-status-view';
import { SubmissionRejectedView } from './submission-rejected-view';

/**
 * Server component: Cocoon to-do page for students.
 * detail (no submission) → ?step=upload → submitted (pending/approved) | rejected → ?step=upload (resubmit).
 */
export async function StudentTodoView({
  todoId,
  userId,
  step,
}: {
  todoId: string;
  userId: string;
  step?: string;
}) {
  const data = await getSubmissionHistory(todoId, userId);
  if (!data) redirect('/student');

  const { todo, phase, groupId, classroomId, submissions } = data;
  return (
    <StudentTodoScreen
      todo={{
        id: todo.id,
        title: todo.title,
        description: todo.description,
        notes: todo.notes,
        attachments: todo.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          contentType: a.contentType,
          fileSize: a.fileSize,
        })),
      }}
      phaseViewable={isPhaseViewable(phase)}
      submissions={submissions}
      groupHome={`/student/classroom/${classroomId}/group/${groupId}`}
      step={step}
    />
  );
}

interface StudentTodoScreenProps {
  todo: {
    id: string;
    title: string;
    description: string | null;
    notes: string | null;
    attachments: { id: string; fileName: string; contentType: string; fileSize: number }[];
  };
  phaseViewable: boolean;
  /** Newest first. */
  submissions: StudentSubmission[];
  groupHome: string;
  step?: string;
}

/** Presentational to-do screen (plain props, no data access). */
export function StudentTodoScreen({ todo, phaseViewable, submissions, groupHome, step }: StudentTodoScreenProps) {
  const todoHref = `/todo/${todo.id}`;
  const uploadHref = `${todoHref}?step=upload`;

  const [firstLineRaw, ...restLines] = (todo.description ?? '').split(/\r?\n/);
  const firstLine = firstLineRaw?.trim() ?? '';
  const moreDescription = restLines.join('\n').trim();
  const { items, rest } = parseDeliverables(todo.notes);

  const latest = submissions[0];
  const canUpload = !latest || latest.status === 'rejected';
  // Comment on the most recent rejected submission older than the latest one (home-9).
  const previousComment =
    submissions.slice(1).find((s) => s.status === 'rejected')?.reviewerComment ?? null;

  let view: 'submitted' | 'rejected' | 'upload' | 'detail';
  if (latest && latest.status !== 'rejected') view = 'submitted';
  else if (latest?.status === 'rejected' && step !== 'upload') view = 'rejected';
  else if (step === 'upload' && canUpload && phaseViewable) view = 'upload';
  else view = 'detail';

  const isUpload = view === 'upload';
  const resubmit = latest?.status === 'rejected';
  const subtitleWithTitle = firstLine ? `${todo.title} · ${firstLine}` : todo.title;

  const pill =
    view === 'submitted' && latest ? (
      <StatusPill status={latest.status === 'approved' ? 'approved' : 'pending'} size="xl" />
    ) : view === 'rejected' ? (
      <StatusPill status="rejected" size="xl" />
    ) : undefined;

  return (
    <>
      <CocoonHeader variant="back" backHref={isUpload ? todoHref : groupHome} />

      {/* Mobile title block (260928-iwi) */}
      <div className="-mt-2 px-[31px] lg:hidden">
        <h1 className="text-[32px] leading-tight font-bold break-words text-cocoon-blue">{todo.title}</h1>
        {firstLine && <p className="text-[12px] leading-normal font-bold text-cocoon-muted">{firstLine}</p>}
      </div>

      {/* Desktop page header (design/mac) */}
      <PageHeader
        className="hidden lg:block"
        backHref={groupHome}
        backLabel="งานของฉัน"
        title={isUpload ? (resubmit ? 'แก้ไขงาน' : 'ส่งงาน') : todo.title}
        subtitle={isUpload ? subtitleWithTitle : firstLine || undefined}
        actions={pill}
      />

      {view === 'detail' && (
        <TodoDetailView
          description={moreDescription}
          notes={rest}
          deliverables={items}
          attachments={todo.attachments}
          uploadHref={uploadHref}
          canSelect={phaseViewable}
        />
      )}

      {view === 'upload' && (
        <div className="mt-4 lg:mt-0">
          <TodoSubmitView
            todoId={todo.id}
            title={todo.title}
            mode={resubmit ? 'resubmit' : 'new'}
            history={submissions}
          />
        </div>
      )}

      {view === 'rejected' && latest && (
        <div className="mt-4 lg:mt-0">
          <SubmissionRejectedView
            latest={latest}
            history={submissions}
            editHref={uploadHref}
            canResubmit={phaseViewable}
          />
        </div>
      )}

      {view === 'submitted' && latest && (
        <>
          <div className="mt-4 lg:hidden">
            <SubmissionStatusView
              latest={latest}
              history={submissions}
              backHref={groupHome}
              previousComment={previousComment}
            />
          </div>
          <div className="hidden lg:block">
            <SubmissionStatusDesktop
              latest={latest}
              history={submissions}
              backHref={groupHome}
              previousComment={previousComment}
            />
          </div>
        </>
      )}
    </>
  );
}
