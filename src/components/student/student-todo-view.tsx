import { redirect } from 'next/navigation';
import { getSubmissionHistory } from '@/server/queries/submission';
import { isPhaseViewable } from '@/lib/node-path';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { TodoAttachmentsList } from '@/components/todo/todo-attachments-list';
import { TodoSubmitView } from './todo-submit-view';
import { SubmissionStatusView, HistoryCard } from './submission-status-view';

// Server component: Cocoon to-do page for students (upload → confirm → submitted/history).
export async function StudentTodoView({ todoId, userId }: { todoId: string; userId: string }) {
  const data = await getSubmissionHistory(todoId, userId);
  if (!data) redirect('/student');

  const { todo, phase, groupId, classroomId, submissions } = data;
  const backHref = `/student/classroom/${classroomId}/group/${groupId}`;
  const [firstLine, ...rest] = (todo.description ?? '').split(/\r?\n/);
  const moreDescription = rest.join('\n').trim();
  const latest = submissions[0];
  const canUpload = !latest || latest.status === 'rejected';
  const hasTeacherInfo = !!todo.notes || !!moreDescription || todo.attachments.length > 0;

  return (
    <>
      <CocoonHeader variant="back" backHref={backHref} />

      <div className="-mt-2 px-[31px]">
        <h1 className="text-[32px] leading-tight font-bold break-words text-cocoon-blue">{todo.title}</h1>
        {firstLine?.trim() && (
          <p className="text-[12px] leading-normal font-bold text-cocoon-muted">{firstLine.trim()}</p>
        )}
      </div>

      {hasTeacherInfo && (
        <section className="mx-[33px] mt-4 space-y-3 rounded-[12px] border border-cocoon-line bg-white p-5">
          <h2 className="text-[16px] leading-normal font-bold text-black">รายละเอียดจากครู</h2>
          {moreDescription && (
            <p className="text-[14px] leading-normal whitespace-pre-wrap text-cocoon-subtle">{moreDescription}</p>
          )}
          {todo.notes && (
            <p className="text-[14px] leading-normal break-words whitespace-pre-wrap text-cocoon-ink">{todo.notes}</p>
          )}
          {todo.attachments.length > 0 && (
            <div>
              <p className="mb-2 text-[14px] leading-normal font-bold text-cocoon-ink">ไฟล์จากครู</p>
              <TodoAttachmentsList
                attachments={todo.attachments.map((a) => ({
                  id: a.id,
                  fileName: a.fileName,
                  contentType: a.contentType,
                  fileSize: a.fileSize,
                }))}
              />
            </div>
          )}
        </section>
      )}

      <div className="mt-4">
        {!canUpload && latest ? (
          <SubmissionStatusView latest={latest} history={submissions} backHref={backHref} />
        ) : !isPhaseViewable(phase) ? (
          <div className="space-y-5 px-[33px]">
            <div className="rounded-[12px] border border-cocoon-line bg-white p-6 text-center">
              <p className="text-[16px] leading-normal font-bold text-cocoon-ink">Phase นี้ยังไม่ปลดล็อค</p>
              <p className="mt-1 text-[14px] leading-normal font-medium text-cocoon-muted">
                รอครูปลดล็อค Phase ก่อนจึงจะส่งงานได้
              </p>
            </div>
            <HistoryCard submissions={submissions} />
          </div>
        ) : (
          <TodoSubmitView
            todoId={todo.id}
            title={todo.title}
            rejected={latest?.status === 'rejected'}
            history={submissions}
          />
        )}
      </div>
    </>
  );
}
