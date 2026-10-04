'use client';

import { cn } from 'cn';
import { formatSubmissionDate } from '@/lib/format';
import type { TeacherWorkPageEntry } from '@/server/queries/work-page';
import { StatusPill } from '@/components/cocoon/status-pill';
import { CARD, CARD_META, CARD_TITLE } from '@/components/cocoon/ui';
import { SubmittedFiles } from '@/components/student/submission-status-view';
import { WorkPageViewer } from './work-page-viewer';
import { WorkPageFileList } from './work-page-files';

/**
 * Teacher read-only view of a to-do's work: latest submission snapshot + the live page when it
 * changed after that submission ("ฉบับล่าสุด (ยังไม่ส่ง)"). No review actions (Phase 4).
 */
export function TeacherWorkPagePanel({
  entries,
  submissionMode,
}: {
  entries: TeacherWorkPageEntry[];
  submissionMode: 'group' | 'individual';
}) {
  if (entries.length === 0) {
    return (
      <section className={CARD}>
        <h2 className={CARD_TITLE}>งานของนักเรียน</h2>
        <p className={cn(CARD_META, 'mt-2')}>กลุ่มนี้ยังไม่มีสมาชิก</p>
      </section>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {entries.map((entry) => (
        <EntryBlock key={entry.key} entry={entry} showOwner={submissionMode === 'individual'} />
      ))}
    </div>
  );
}

function EntryBlock({ entry, showOwner }: { entry: TeacherWorkPageEntry; showOwner: boolean }) {
  const { latestSubmission: sub, livePage, liveIsNewer } = entry;
  const nothing = !sub && !liveIsNewer;

  return (
    <div className="space-y-3">
      {showOwner && <h3 className="text-[16px] leading-normal font-bold text-cocoon-ink lg:text-[18px]">{entry.ownerLabel}</h3>}

      {sub && (
        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className={cn(CARD_TITLE, 'min-w-0 flex-1')}>งานที่ส่งล่าสุด · ครั้งที่ {sub.attempt}</h2>
            <StatusPill status={sub.status} size="lg" />
          </div>
          <p className={cn(CARD_META, 'mt-1')}>
            ส่งโดย {sub.submittedByName} · {formatSubmissionDate(sub.createdAt)}
          </p>
          <div className="mt-3">
            {sub.content ? (
              <WorkPageViewer content={sub.content} />
            ) : (
              <p className="text-[14px] font-medium text-cocoon-muted">ส่งเป็นไฟล์</p>
            )}
          </div>
          {sub.files.length > 0 && (
            <SubmittedFiles className="mt-3" files={sub.files.map((f) => ({ id: f.id, fileName: f.fileName, fileSize: f.fileSize }))} />
          )}
        </section>
      )}

      {liveIsNewer && livePage && (
        <section className={cn(CARD, 'border-dashed')}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className={cn(CARD_TITLE, 'min-w-0 flex-1')}>ฉบับล่าสุด (ยังไม่ส่ง)</h2>
            <span className="inline-flex h-[26px] items-center rounded-full bg-cocoon-blue-soft px-3 text-[12px] font-bold text-cocoon-blue">
              กำลังทำ
            </span>
          </div>
          <p className={cn(CARD_META, 'mt-1')}>
            แก้ไขล่าสุดโดย {livePage.updatedByName ?? 'ไม่ระบุชื่อ'} · {formatSubmissionDate(livePage.updatedAt)}
          </p>
          <div className="mt-3">
            <WorkPageViewer content={livePage.content} />
          </div>
          {livePage.files.length > 0 && (
            <div className="mt-3">
              <WorkPageFileList files={livePage.files} />
            </div>
          )}
        </section>
      )}

      {nothing && (
        <section className={CARD}>
          <p className="text-[14px] leading-normal font-medium text-cocoon-muted">ยังไม่มีการเริ่มทำงาน</p>
        </section>
      )}
    </div>
  );
}
