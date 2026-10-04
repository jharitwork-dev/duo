import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { CocoonHeader } from '@/components/cocoon/cocoon-header';
import { PageHeader } from '@/components/cocoon/page-header';
import { StatusPill } from '@/components/cocoon/status-pill';
import { ReviewerNoteCard } from '@/components/student/submission-status-view';
import { CommentThreadSection, CommentThreadSkeleton } from '@/components/comment/comment-thread-section';
import { ReviewSubmissionCard } from '@/components/review/review-submission-card';
import { ReviewHistoryCard } from '@/components/review/review-history-card';
import { ReviewActions } from '@/components/review/review-actions';
import { reviewListHref } from '@/lib/review';
import { getReviewDetail } from '@/server/queries/review';

// Teacher review detail (quick task 261004-gic; design/mac home-12..17, mobile ref 08).

interface Props {
  params: Promise<{ submissionId: string }>;
}

export default async function TeacherReviewDetailPage({ params }: Props) {
  await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN);
  const userId = await getCurrentUserId();
  const { submissionId } = await params;
  const detail = await getReviewDetail(submissionId, userId);
  if (!detail) notFound();

  const { submission, todo, group, classroom, phase } = detail;
  const backHref = reviewListHref({ classroom: classroom.id, phase: phase.id, tab: submission.status });
  const isIndividual = todo.submissionMode === 'individual';
  const subtitle = [todo.title, group.name, detail.ownerLabel].filter(Boolean).join(' · ');
  const stale = detail.latestId !== submission.id;

  return (
    <>
      <CocoonHeader variant="back" backHref={backHref} />
      <PageHeader
        backHref={backHref}
        backLabel="ตรวจงาน"
        title="ตรวจงาน"
        subtitle={subtitle}
        actions={<StatusPill status={submission.status} size="xl" />}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 px-[33px] lg:mt-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-8 lg:px-0">
        <div className="min-w-0 space-y-4 lg:space-y-6">
          <ReviewSubmissionCard submission={submission} />
          {detail.previousFeedback && <ReviewerNoteCard title="คำแนะนำครั้งก่อน" comment={detail.previousFeedback} />}
        </div>
        <ReviewHistoryCard history={detail.history} currentId={submission.id} />
      </div>

      <div className="mt-6 px-[33px] lg:mt-10 lg:px-0">
        {detail.canReview ? (
          <ReviewActions
            submissionId={submission.id}
            todoTitle={todo.title}
            classroomId={classroom.id}
            phaseId={phase.id}
          />
        ) : stale ? (
          <p className="text-[15px] font-medium text-cocoon-muted">
            มีการส่งฉบับใหม่แล้ว ·{' '}
            <Link href={`/teacher/review/${detail.latestId}`} className="font-bold text-cocoon-blue hover:underline">
              ดูฉบับล่าสุด
            </Link>
          </p>
        ) : (
          <p className="text-[15px] font-medium text-cocoon-muted">ตรวจแล้ว</p>
        )}
      </div>

      <div id="comments" className="mt-6 scroll-mt-6 px-[33px] lg:mt-10 lg:max-w-[760px] lg:px-0">
        <Suspense fallback={<CommentThreadSkeleton />}>
          <CommentThreadSection
            todoId={todo.id}
            groupId={group.id}
            studentId={isIndividual && detail.studentId ? detail.studentId : undefined}
            viewer="teacher"
          />
        </Suspense>
      </div>
    </>
  );
}
