'use client';

import Link from 'next/link';
import { cn } from 'cn';
import { formatSubmissionDate } from '@/lib/format';
import { getDeadlineStatus } from '@/lib/deadline';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import type { TeacherWorkPageEntry } from '@/server/queries/work-page';
import { StatusPill } from '@/components/cocoon/status-pill';
import { BTN_INFO, BTN_TERTIARY, CARD, CARD_META, CARD_TITLE } from '@/components/cocoon/ui';
import { SubmittedFiles } from '@/components/student/submission-status-view';
import { WorkPageViewer } from './work-page-viewer';
import { WorkPageFileList } from './work-page-files';

/**
 * Teacher read-only view of a to-do's work: latest submission snapshot + the live page when it
 * changed after that submission ("ฉบับล่าสุด (ยังไม่ส่ง)"). Review happens on /teacher/review/[id] (261004-gic):
 * the submission card links there ("เช็คงาน" while pending, else "ดูผลตรวจ").
 */
export function TeacherWorkPagePanel({
  entries,
  submissionMode,
  deadline = null,
  nowIso,
}: {
  entries: TeacherWorkPageEntry[];
  submissionMode: 'group' | 'individual';
  /** Effective deadline (todo ?? phase), ISO (261004-03i). */
  deadline?: string | null;
  /** Server time, so the chip renders identically on server and client. */
  nowIso: string;
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
        <EntryBlock
          key={entry.key}
          entry={entry}
          showOwner={submissionMode === 'individual'}
          deadline={deadline}
          nowIso={nowIso}
        />
      ))}
    </div>
  );
}

function EntryBlock({
  entry,
  showOwner,
  deadline,
  nowIso,
}: {
  entry: TeacherWorkPageEntry;
  showOwner: boolean;
  deadline: string | null;
  nowIso: string;
}) {
  const { latestSubmission: sub, livePage, liveIsNewer } = entry;
  const nothing = !sub && !liveIsNewer;
  const deadlineState = getDeadlineStatus({
    deadline: deadline ? new Date(deadline) : null,
    firstSubmittedAt: entry.firstSubmittedAt ? new Date(entry.firstSubmittedAt) : null,
    latestStatus: sub?.status ?? 'none',
    now: new Date(nowIso),
  });
  const chip = (
    <DeadlineChip
      status={deadlineState.status}
      lateMs={deadlineState.lateMs}
      overdueMs={deadlineState.overdueMs}
      remainingMs={deadlineState.remainingMs}
      size="md"
    />
  );
  const updatedAfterSubmit =
    !!sub && new Date(sub.updatedAt).getTime() - new Date(sub.createdAt).getTime() > 1000;

  return (
    <div className="space-y-3">
      {showOwner && <h3 className="text-[16px] leading-normal font-bold text-cocoon-ink lg:text-[18px]">{entry.ownerLabel}</h3>}
      {!sub && deadlineState.status !== 'none' && deadlineState.status !== 'upcoming' && <div>{chip}</div>}

      {sub && (
        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className={cn(CARD_TITLE, 'min-w-0 flex-1')}>งานที่ส่งล่าสุด · ครั้งที่ {sub.attempt}</h2>
            <StatusPill status={sub.status} size="lg" />
            {chip}
            <Link
              href={`/teacher/review/${sub.id}`}
              className={cn(
                sub.status === 'pending' ? BTN_INFO : BTN_TERTIARY,
                'inline-flex h-10 items-center justify-center text-[14px]',
              )}
            >
              {sub.status === 'pending' ? 'เช็คงาน' : 'ดูผลตรวจ'}
            </Link>
          </div>
          <p className={cn(CARD_META, 'mt-1')}>
            ส่งโดย {sub.submittedByName} · {formatSubmissionDate(sub.createdAt)}
            {updatedAfterSubmit && <> · อัปเดตเมื่อ {formatSubmissionDate(sub.updatedAt)}</>}
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
