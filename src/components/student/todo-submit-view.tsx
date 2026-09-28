'use client';
/* eslint-disable @next/next/no-img-element -- static Figma assets */

import { useId, useState, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { createSubmission, createSubmissionUploadUrl } from '@/server/actions/submission';
import { SUBMISSION_ACCEPT, validateSubmissionFile } from '@/lib/r2';
import { SubmissionFileRow } from './submission-file-row';
import { SubmissionConfirmDialog } from './submission-confirm-dialog';
import { DESKTOP_CARD, HistoryCard, PRIMARY_BUTTON_CLASS, type StudentSubmission } from './submission-status-view';

const MAX_FILES = 10;

// Some OS/browser combos report an empty File.type (notably .doc/.docx) — infer from extension.
const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  zip: 'application/zip',
  mp4: 'video/mp4',
};

function contentTypeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? '';
}

/** Local preview of a selected (not yet uploaded) file. */
function openLocal(file: File) {
  const url = URL.createObjectURL(file);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface TodoSubmitViewProps {
  todoId: string;
  title: string;
  mode: 'new' | 'resubmit';
  history: StudentSubmission[];
}

// Upload step. Mobile keeps the 260928-iwi markup (ref 03); lg follows design/mac home-2/3 and home-8.
// Both layouts share one state, one set of handlers and one confirm dialog.
export function TodoSubmitView({ todoId, title, mode, history }: TodoSubmitViewProps) {
  const router = useRouter();
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const resubmit = mode === 'resubmit';

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const rejectedNames: string[] = [];
    const next = [...files];
    for (const file of incoming) {
      if (!validateSubmissionFile(contentTypeOf(file), file.size)) {
        rejectedNames.push(file.name);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.length >= MAX_FILES) {
        toast.error(`เลือกได้สูงสุด ${MAX_FILES} ไฟล์`);
        break;
      }
      next.push(file);
    }
    setFiles(next);
    if (rejectedNames.length > 0) {
      toast.error(`ไฟล์ไม่รองรับหรือใหญ่เกิน 10 MB: ${rejectedNames.join(', ')}`);
    }
  }

  function removeAt(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file after removing it
  }

  function onDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (!submitting) setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    if (submitting) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function handleSubmit() {
    if (files.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const uploaded: { key: string; fileName: string; contentType: string; size: number }[] = [];
      for (const file of files) {
        const contentType = contentTypeOf(file);
        const presign = await createSubmissionUploadUrl({
          todoId,
          fileName: file.name,
          contentType,
          size: file.size,
        });
        if (!presign.ok) {
          toast.error(presign.error);
          return;
        }
        const res = await fetch(presign.url, {
          method: 'PUT',
          headers: { 'content-type': contentType },
          body: file,
        }).catch(() => null);
        if (!res || !res.ok) {
          toast.error(`อัปโหลดไม่สำเร็จ: ${file.name}`);
          return;
        }
        uploaded.push({ key: presign.key, fileName: file.name, contentType, size: file.size });
      }

      const result = await createSubmission({ todoId, files: uploaded });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      setFiles([]);
      toast.success('ส่งงานแล้ว');
      // Leave ?step=upload so the page shows the submitted view.
      router.replace(`/todo/${todoId}`);
      router.refresh();
    } catch {
      toast.error('ส่งงานไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  const confirmLabel = resubmit ? 'ยืนยันส่งอีกครั้ง' : 'ยืนยันส่งไฟล์';

  return (
    <>
      {/* ---------- Mobile (< lg): ref 03 ---------- */}
      <div className="space-y-5 px-[33px] lg:hidden">
        {resubmit && (
          <p className="rounded-[12px] border border-cocoon-yellow bg-[rgba(250,168,25,.2)] px-4 py-2 text-[12px] leading-normal font-medium text-[#c98200]">
            งานถูกส่งกลับให้แก้ไข — อัปโหลดไฟล์ใหม่
          </p>
        )}

        <label
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'flex h-[162px] cursor-pointer flex-col items-center justify-center rounded-[12px] border border-dashed border-cocoon-blue text-center transition-colors focus-within:ring-2 focus-within:ring-cocoon-blue/40',
            dragging ? 'bg-[rgba(73,188,255,.1)]' : 'bg-cocoon-blue-soft',
            submitting && 'pointer-events-none opacity-60',
          )}
        >
          <input
            type="file"
            multiple
            accept={SUBMISSION_ACCEPT}
            onChange={onInputChange}
            disabled={submitting}
            className="sr-only"
          />
          <img src="/figma/7b064.svg" alt="" width={60} height={60} className="size-[60px]" />
          <span className="text-[20px] leading-normal font-bold text-cocoon-blue">
            {resubmit ? 'เพิ่มไฟล์ฉบับแก้ไข' : 'เพิ่มไฟล์'}
          </span>
          <span className="text-[10px] leading-normal font-medium text-[rgba(0,105,166,.5)]">
            ลากไฟล์มาวางที่นี่ หรือกดเลือกไฟล์
          </span>
          <span className="text-[10px] leading-normal font-medium text-[rgba(0,105,166,.5)]">
            รองรับไฟล์ PDF, DOC, DOCX (ไม่เกิน 10 MB)
          </span>
        </label>

        {files.length > 0 && (
          <>
            <section className="rounded-[12px] border border-cocoon-line bg-white p-5">
              <h2 className="text-[16px] leading-normal font-bold text-black">ไฟล์ที่เลือก</h2>
              <div className="mt-3 space-y-[7px]">
                {files.map((file, index) => (
                  <SubmissionFileRow
                    key={`${file.name}-${file.size}`}
                    fileName={file.name}
                    fileSize={file.size}
                    disabled={submitting}
                    action={{ kind: 'local', onOpen: () => openLocal(file), onRemove: () => removeAt(index) }}
                  />
                ))}
              </div>
            </section>

            <div className="flex h-[45px] items-center gap-2 rounded-[12px] border border-cocoon-yellow bg-[rgba(250,168,25,.2)] px-4">
              <img src="/figma/a189d.svg" alt="" width={13} height={13} className="size-[13px]" />
              <span className="text-[14px] leading-normal font-medium text-[#c98200]">
                ตรวจสอบไฟล์ก่อนยืนยันส่ง
              </span>
            </div>
          </>
        )}

        <button
          type="button"
          disabled={files.length === 0 || submitting}
          onClick={() => setConfirmOpen(true)}
          className={cn(PRIMARY_BUTTON_CLASS, 'mt-8', resubmit && 'bg-cocoon-yellow')}
        >
          {confirmLabel}
        </button>

        {resubmit && <HistoryCard submissions={history} />}
      </div>

      {/* ---------- Desktop (lg+): design/mac home-2/3/8 ---------- */}
      <div className="mt-[35px] hidden lg:block">
        <div className="grid grid-cols-[552px_1fr] gap-8 max-xl:grid-cols-2">
          <label
            htmlFor={inputId}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              DESKTOP_CARD,
              'flex min-h-[380px] cursor-pointer flex-col items-center pt-[50px] text-center transition-colors focus-within:ring-2 focus-within:ring-cocoon-blue/40',
              dragging && 'border-cocoon-blue bg-cocoon-blue-soft',
              submitting && 'pointer-events-none opacity-60',
            )}
          >
            <input
              id={inputId}
              type="file"
              multiple
              accept={SUBMISSION_ACCEPT}
              onChange={onInputChange}
              disabled={submitting}
              className="sr-only"
            />
            <ArrowUp aria-hidden size={40} strokeWidth={3} className="text-cocoon-blue" />
            <span className="mt-[30px] text-[24px] leading-normal font-bold text-cocoon-blue">
              {resubmit ? 'เลือกไฟล์ฉบับแก้ไข' : 'อัปโหลดไฟล์งาน'}
            </span>
            <span className="text-[16px] leading-normal font-medium text-cocoon-muted">
              ลากไฟล์มาวาง หรือกดเลือกไฟล์จากเครื่อง
            </span>
            <span className="mt-[30px] flex h-[49px] w-[245px] items-center justify-center rounded-[10px] bg-cocoon-blue text-[16px] font-bold text-white">
              เลือกไฟล์
            </span>
            <span className="mt-[34px] text-[13px] leading-normal font-medium text-cocoon-muted">
              รองรับ PDF, DOC, DOCX · ไม่เกิน 10 MB ต่อไฟล์
            </span>
          </label>

          <section className={cn(DESKTOP_CARD, 'flex min-h-[380px] flex-col')}>
            <h2 className="text-[20px] leading-normal font-bold text-cocoon-blue">
              ไฟล์ที่เลือก{files.length > 0 && ` (${files.length} ไฟล์)`}
            </h2>
            {files.length === 0 ? (
              <p className="flex flex-1 items-center justify-center pb-10 text-[18px] leading-normal font-medium text-cocoon-muted">
                ยังไม่ได้เลือกไฟล์
              </p>
            ) : (
              <>
                <div className="mt-3 space-y-3">
                  {files.map((file, index) => (
                    <SubmissionFileRow
                      key={`${file.name}-${file.size}`}
                      fileName={file.name}
                      fileSize={file.size}
                      disabled={submitting}
                      action={{ kind: 'local', onOpen: () => openLocal(file), onRemove: () => removeAt(index) }}
                    />
                  ))}
                </div>
                <label
                  htmlFor={inputId}
                  className={cn(
                    'mt-[30px] w-fit cursor-pointer rounded-sm text-[16px] leading-normal font-bold text-cocoon-blue hover:underline',
                    submitting && 'pointer-events-none opacity-50',
                  )}
                >
                  เพิ่มไฟล์
                </label>
                <p className="mt-[30px] text-[14px] leading-normal font-medium text-cocoon-muted">
                  ตรวจสอบรายการไฟล์ให้ครบก่อนยืนยันส่งงาน
                </p>
              </>
            )}
          </section>
        </div>

        <div className="mt-9 flex justify-end">
          <button
            type="button"
            disabled={files.length === 0 || submitting}
            onClick={() => setConfirmOpen(true)}
            className={cn(
              'flex h-[49px] w-[293px] items-center justify-center rounded-[12px] text-[16px] font-bold text-white transition-colors disabled:bg-[#d5d7dc]',
              resubmit ? 'bg-cocoon-yellow' : 'bg-cocoon-orange',
            )}
          >
            {resubmit ? 'ยืนยันส่งอีกครั้ง' : 'ยืนยันส่งงาน'}
          </button>
        </div>
      </div>

      <SubmissionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        todoTitle={title}
        files={files.map((f) => ({ name: f.name, size: f.size }))}
        submitting={submitting}
        onConfirm={handleSubmit}
      />
    </>
  );
}
