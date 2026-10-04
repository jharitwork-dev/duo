import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { cn } from 'cn';
import { getCurrentUserId, getCurrentRole } from '@/lib/auth';
import { getTodoDetail } from '@/server/queries/todo';
import { TodoDetail } from '@/components/todo/todo-detail';
import { TodoAttachmentsList } from '@/components/todo/todo-attachments-list';
import { ROLES } from '@/lib/constants';
import { parseDeliverables } from '@/lib/todo-deliverables';
import { StudentTodoView } from '@/components/student/student-todo-view';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { BTN_TERTIARY, CARD, CARD_TITLE, PAGE_BODY } from '@/components/cocoon/ui';

interface Props {
  params: Promise<{ todoId: string }>;
}

const PILL = 'inline-flex h-[31px] items-center rounded-full px-3 text-[14px] font-bold whitespace-nowrap';

export default async function TodoDetailPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const role = await getCurrentRole();
  const { todoId } = await params;

  if (role === ROLES.STUDENT) {
    // The old ?step=upload flow is gone (261004-01i); a stale `step` param is simply ignored.
    return <StudentTodoView todoId={todoId} userId={userId} />;
  }

  const todo = await getTodoDetail(todoId, userId);
  if (!todo) {
    redirect('/student');
  }

  const isTeacher = role === 'teacher' || role === 'superadmin';
  const phase = todo.phase;
  const group = todo.group;
  const classroom = group.classroom;
  const editorHref = `/teacher/classroom/${classroom.id}/group/${group.id}`;
  const { items } = parseDeliverables(todo.notes);

  return (
    <>
      <CocoonHeader variant="back" backHref={editorHref} />
      <PageHeader
        backHref={editorHref}
        backLabel={group.name}
        title={todo.title}
        subtitle={`${classroom.name} · ${group.name} · ${phase.name}`}
        actions={
          <>
            <span className={cn(PILL, 'border border-cocoon-blue bg-cocoon-blue-soft text-cocoon-blue')}>
              {todo.submissionMode === 'individual' ? 'รายบุคคล' : 'กลุ่ม'}
            </span>
            {todo.deadline && (
              <span className={cn(PILL, 'border border-cocoon-line bg-white text-cocoon-subtle')}>
                กำหนดส่ง {new Date(todo.deadline).toLocaleDateString('th-TH')}
              </span>
            )}
            {isTeacher && (
              <Link href={editorHref} className={cn(BTN_TERTIARY, 'inline-flex h-10 items-center text-[14px]')}>
                แก้ไข
              </Link>
            )}
          </>
        }
      />

      <div
        className={cn(
          PAGE_BODY,
          'space-y-4 lg:grid lg:grid-cols-[664px_1fr] lg:items-start lg:gap-8 lg:space-y-0 max-xl:lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
        )}
      >
        <TodoDetail notes={todo.notes} description={todo.description} />

        <div className="space-y-4 lg:space-y-8">
          <section className={CARD}>
            <h2 className={CARD_TITLE}>สิ่งที่ต้องส่ง</h2>
            {items.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] leading-normal text-cocoon-ink lg:text-[16px]">
                    <Check aria-hidden size={16} className="mt-1 shrink-0" />
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-cocoon-muted">
                ขึ้นบรรทัดด้วย “- ” ในบันทึกเพื่อระบุสิ่งที่ต้องส่ง
              </p>
            )}
          </section>

          <section className={CARD}>
            <h2 className={CARD_TITLE}>ไฟล์แนบ</h2>
            <div className="mt-3">
              <TodoAttachmentsList attachments={todo.attachments ?? []} />
            </div>
          </section>

          <div className="rounded-[16px] border border-dashed border-cocoon-line bg-white/60 p-5 text-center text-[14px] font-medium text-cocoon-muted">
            การตรวจงานจะเปิดให้ใช้ใน Phase ถัดไป
          </div>
        </div>
      </div>
    </>
  );
}
