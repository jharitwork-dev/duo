import { cn } from 'cn';
import { CARD, CARD_META } from '@/components/cocoon/ui';
import { formatSubmissionDate } from '@/lib/format';
import { WorkPageViewer } from '@/components/work-page/work-page-viewer';
import { SubmittedFiles } from '@/components/student/submission-status-view';
import type { ReviewDetail } from '@/server/queries/review';

// Left card on the review detail (design/mac home-12): "ส่งครั้งที่ n", date, snapshot + files ("เปิด").
export function ReviewSubmissionCard({ submission }: { submission: ReviewDetail['submission'] }) {
  return (
    <section className={cn(CARD, 'min-w-0')}>
      <h2 className="text-[20px] leading-normal font-bold text-cocoon-ink lg:text-[24px] lg:text-cocoon-blue">
        ส่งครั้งที่ {submission.attempt}
      </h2>
      <p className={cn(CARD_META, 'mt-1')}>{formatSubmissionDate(submission.createdAt)}</p>
      <div className="mt-4">
        {submission.content ? (
          <WorkPageViewer content={submission.content} />
        ) : (
          <p className="text-[14px] font-medium text-cocoon-muted">ส่งเป็นไฟล์</p>
        )}
      </div>
      {submission.files.length > 0 && (
        <SubmittedFiles
          className="mt-4"
          files={submission.files.map((f) => ({ id: f.id, fileName: f.fileName, fileSize: f.fileSize }))}
        />
      )}
    </section>
  );
}
