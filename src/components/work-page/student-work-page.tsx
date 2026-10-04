'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Editor } from '@tiptap/react';
import { ChevronDown, ListChecks, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { formatBangkokTime } from '@/lib/format';
import type { SubmissionStatus } from '@/lib/node-path';
import {
  EMPTY_DOC,
  canSubmitWorkPage,
  checklistProgress,
  hasPageContent,
  type FileRequirement,
  type WorkPageDoc,
} from '@/lib/work-page';
import {
  saveWorkPage,
  submitWorkPage,
  type WorkPageConflict,
  type WorkPageFileDTO,
} from '@/server/actions/work-page';
import { SubmissionConfirmDialog } from '@/components/student/submission-confirm-dialog';
import { WorkPageEditor } from './work-page-editor';
import { WorkPageViewer } from './work-page-viewer';
import { WorkPageFiles } from './work-page-files';

const AUTOSAVE_DELAY_MS = 800;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface StudentWorkPageProps {
  todoId: string;
  todoTitle: string;
  submissionMode: 'group' | 'individual';
  initial: { content: WorkPageDoc; updatedAt: string; updatedByName: string | null } | null;
  files: WorkPageFileDTO[];
  fileRequirement: FileRequirement;
  storageReady: boolean;
  canEdit: boolean;
  phaseViewable: boolean;
  latestStatus: SubmissionStatus;
  /** Latest submission was rejected: the submit button becomes the yellow "ส่งอีกครั้ง". */
  resubmit: boolean;
}

const READ_ONLY_BANNER: Partial<Record<SubmissionStatus | 'locked', { text: string; className: string }>> = {
  pending: { text: 'ส่งแล้ว รอตรวจ', className: 'border-cocoon-blue/30 bg-cocoon-blue-soft text-cocoon-blue' },
  approved: { text: 'ผ่านแล้ว', className: 'border-cocoon-green/30 bg-[rgb(0_168_107/.08)] text-cocoon-green' },
  locked: {
    text: 'Phase นี้ยังไม่ปลดล็อค',
    className: 'border-cocoon-line bg-[rgba(15,23,42,.04)] text-cocoon-subtle',
  },
};

/**
 * Student work page: Tiptap editor + autosave (800 ms debounce, on blur, before submit) with
 * optimistic-concurrency conflicts, checklist chip, files, and the submit bar + confirm dialog.
 */
export function StudentWorkPage({
  todoId,
  todoTitle,
  submissionMode,
  initial,
  files: initialFiles,
  fileRequirement,
  storageReady,
  canEdit,
  phaseViewable,
  latestStatus,
  resubmit,
}: StudentWorkPageProps) {
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const [doc, setDoc] = useState<WorkPageDoc>(initial?.content ?? EMPTY_DOC);
  const [files, setFiles] = useState<WorkPageFileDTO[]>(initialFiles);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initial ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updatedAt ?? null);
  const [notice, setNotice] = useState<{ name: string; at: string } | null>(null);
  const [draft, setDraft] = useState<WorkPageDoc | null>(null);
  const [draftOpen, setDraftOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);

  // Autosave machinery (refs: never trigger re-renders of the editor).
  const baseRef = useRef<string | null>(initial?.updatedAt ?? null);
  const pendingRef = useRef<WorkPageDoc | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const okRef = useRef(true);

  // Server refresh (e.g. after submit) brings a new file list: adopt it.
  const [prevInitialFiles, setPrevInitialFiles] = useState(initialFiles);
  if (initialFiles !== prevInitialFiles) {
    setPrevInitialFiles(initialFiles);
    setFiles(initialFiles);
  }

  const editable = canEdit && !submitting;

  const applyConflict = useCallback((conflict: WorkPageConflict) => {
    const editor = editorRef.current;
    const mine = (editor?.getJSON() as WorkPageDoc | undefined) ?? null;
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    baseRef.current = conflict.updatedAt;
    const serverDoc = conflict.content && conflict.content.type === 'doc' ? conflict.content : EMPTY_DOC;
    editor?.commands.setContent(serverDoc, { emitUpdate: false });
    setDoc(serverDoc);
    setSavedAt(conflict.updatedAt);
    setSaveStatus('saved');
    setNotice({ name: conflict.updatedByName, at: conflict.updatedAt });
    if (mine && hasPageContent(mine)) {
      setDraft(mine);
      setDraftOpen(true);
    }
    // The editor now shows the server version, so it is in sync again; the caller's own
    // save/submit still reports failure so nothing is submitted without the user seeing this.
    okRef.current = true;
  }, []);

  /** Sends the latest pending content (if any). Resolves true when the server has our content. */
  const runSave = useCallback(async (): Promise<boolean> => {
    const content = pendingRef.current;
    if (!content) return okRef.current;
    pendingRef.current = null;
    setSaveStatus('saving');
    try {
      const result = await saveWorkPage({ todoId, content, baseUpdatedAt: baseRef.current });
      if (result.success) {
        baseRef.current = result.updatedAt;
        setSavedAt(result.updatedAt);
        okRef.current = true;
        setSaveStatus(pendingRef.current ? 'saving' : 'saved');
        return true;
      }
      if (result.conflict) {
        applyConflict(result.conflict);
        return false;
      }
      pendingRef.current = pendingRef.current ?? content;
      okRef.current = false;
      setSaveStatus('error');
      toast.error(result.error);
      return false;
    } catch {
      pendingRef.current = pendingRef.current ?? content;
      okRef.current = false;
      setSaveStatus('error');
      return false;
    }
  }, [todoId, applyConflict]);

  /** Queues a save behind any in-flight one (one request at a time). */
  const flush = useCallback((): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    chainRef.current = chainRef.current.then(runSave, runSave);
    return chainRef.current;
  }, [runSave]);

  const handleChange = useCallback(
    (next: WorkPageDoc) => {
      setDoc(next);
      pendingRef.current = next;
      setSaveStatus('saving');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  // Warn before leaving with unsaved edits, and try to flush them.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!pendingRef.current && saveStatus !== 'saving' && saveStatus !== 'error') return;
      void flush();
      e.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flush, saveStatus]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function retrySave() {
    if (!pendingRef.current) pendingRef.current = (editorRef.current?.getJSON() as WorkPageDoc) ?? doc;
    okRef.current = true;
    void flush();
  }

  function restoreMine() {
    if (!draft) return;
    editorRef.current?.commands.setContent(draft, { emitUpdate: false });
    setDoc(draft);
    pendingRef.current = draft;
    setDraft(null);
    setNotice(null);
    okRef.current = true;
    void flush();
  }

  const progress = checklistProgress(doc);
  const usableFileCount = fileRequirement === 'none' ? 0 : files.length;
  const eligibility = canSubmitWorkPage({
    fileRequirement,
    fileCount: usableFileCount,
    hasContent: hasPageContent(doc),
    latestStatus,
    phaseViewable,
  });

  async function openConfirm() {
    if (!eligibility.ok || preparing) return;
    setPreparing(true);
    try {
      const saved = await flush();
      if (!saved) {
        if (saveStatus === 'error' || pendingRef.current) toast.error('บันทึกไม่สำเร็จ ลองอีกครั้งก่อนส่งงาน');
        return;
      }
      setConfirmOpen(true);
    } finally {
      setPreparing(false);
    }
  }

  async function confirmSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const saved = await flush();
      if (!saved) {
        setConfirmOpen(false);
        return;
      }
      const result = await submitWorkPage({ todoId, baseUpdatedAt: baseRef.current });
      if (!result.success) {
        if (result.conflict) {
          applyConflict(result.conflict);
          setConfirmOpen(false);
        }
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      toast.success('ส่งงานแล้ว');
      router.refresh();
    } catch {
      toast.error('ส่งงานไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  const banner = !canEdit
    ? READ_ONLY_BANNER[!phaseViewable ? 'locked' : latestStatus === 'approved' ? 'approved' : 'pending']
    : undefined;
  const title = submissionMode === 'group' ? 'หน้างานของกลุ่ม · แก้ไขได้ทุกคน' : 'หน้างานของฉัน';
  const showSubmitBar = canEdit;
  const submitLabel = resubmit ? 'ส่งอีกครั้ง' : 'ส่งงาน';

  return (
    <div className={cn('space-y-4 lg:space-y-6', showSubmitBar && 'pb-4')}>
      <section className="rounded-[16px] border border-[#f1ece5] bg-white p-5 lg:p-7" aria-label="หน้างาน">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="min-w-0 flex-1 text-[18px] leading-normal font-bold text-cocoon-blue lg:text-[20px]">{title}</h2>
          {progress.total > 0 && (
            <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-cocoon-blue-soft px-3 text-[12px] font-bold text-cocoon-blue">
              <ListChecks className="size-3.5" aria-hidden />
              to-do {progress.done}/{progress.total}
            </span>
          )}
          {canEdit && <SaveIndicator status={saveStatus} savedAt={savedAt} onRetry={retrySave} />}
        </div>

        {banner && (
          <p className={cn('mb-3 rounded-[12px] border px-4 py-2 text-[14px] leading-normal font-bold', banner.className)}>
            {banner.text}
          </p>
        )}

        {notice && (
          <div className="mb-3 rounded-[12px] border border-cocoon-yellow bg-[rgba(250,168,25,.12)] px-4 py-3" role="status">
            <p className="text-[14px] leading-normal font-bold text-[#a86a00]">
              มีการแก้ไขจาก {notice.name} เมื่อ {formatBangkokTime(notice.at)} — โหลดฉบับล่าสุดแล้ว
            </p>
            {draft ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setDraftOpen((v) => !v)}
                  aria-expanded={draftOpen}
                  className="flex min-h-10 items-center gap-1 text-[14px] font-bold text-cocoon-ink"
                >
                  <ChevronDown className={cn('size-4 transition-transform', !draftOpen && '-rotate-90')} aria-hidden />
                  ข้อความของคุณที่ยังไม่บันทึก
                </button>
                {draftOpen && (
                  <div className="mt-1 rounded-[10px] border border-[#f1ece5] bg-white p-3">
                    <WorkPageViewer content={draft} />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={restoreMine}
                    disabled={!canEdit}
                    className="h-10 rounded-[10px] bg-cocoon-blue px-4 text-[14px] font-bold text-white disabled:opacity-50"
                  >
                    ใช้ฉบับของฉันแทน
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setNotice(null);
                    }}
                    className="h-10 rounded-[10px] border border-cocoon-line bg-white px-4 text-[14px] font-bold text-cocoon-subtle"
                  >
                    ทิ้งฉบับของฉัน
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="mt-1 min-h-10 text-[14px] font-bold text-cocoon-blue"
              >
                รับทราบ
              </button>
            )}
          </div>
        )}

        <WorkPageEditor
          initialContent={initial?.content ?? null}
          editable={editable}
          onChange={handleChange}
          onBlur={() => void flush()}
          onReady={(editor) => {
            editorRef.current = editor;
          }}
        />
      </section>

      <WorkPageFiles
        todoId={todoId}
        files={files}
        requirement={fileRequirement}
        storageReady={storageReady}
        editable={editable}
        onChange={setFiles}
      />

      {showSubmitBar && (
        <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 -mx-[33px] border-t border-cocoon-line bg-white px-[33px] pt-3 pb-3 md:bottom-[100px] md:mx-0 md:rounded-[16px] md:border lg:static lg:flex lg:items-center lg:justify-end lg:gap-4 lg:border-0 lg:bg-transparent lg:p-0">
          {!eligibility.ok && (
            <p className="mb-2 text-center text-[13px] leading-normal font-medium text-cocoon-subtle lg:mb-0 lg:text-right lg:text-[14px]">
              {eligibility.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => void openConfirm()}
            disabled={!eligibility.ok || preparing || submitting}
            className={cn(
              'flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:bg-[#d5d7dc] disabled:hover:opacity-100 lg:h-[49px] lg:w-[293px]',
              resubmit ? 'bg-cocoon-yellow' : 'bg-cocoon-orange',
            )}
          >
            {preparing && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      )}

      <SubmissionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        todoTitle={todoTitle}
        summary={{
          hasText: hasPageContent(doc),
          checklist: progress,
          files: fileRequirement === 'none' ? [] : files.map((f) => ({ name: f.fileName, size: f.fileSize })),
        }}
        submitting={submitting}
        onConfirm={() => void confirmSubmit()}
        resubmit={resubmit}
      />
    </div>
  );
}

function SaveIndicator({
  status,
  savedAt,
  onRetry,
}: {
  status: SaveStatus;
  savedAt: string | null;
  onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="min-h-10 text-[12px] leading-normal font-bold text-cocoon-orange underline-offset-2 hover:underline"
      >
        บันทึกไม่สำเร็จ · ลองอีกครั้ง
      </button>
    );
  }
  let text = '';
  if (status === 'saving') text = 'กำลังบันทึก…';
  else if (status === 'saved' && savedAt) text = `บันทึกแล้ว · ${formatBangkokTime(savedAt)}`;
  if (!text) return null;
  return (
    <span aria-live="polite" className="text-[12px] leading-normal font-medium text-cocoon-muted">
      {text}
    </span>
  );
}
