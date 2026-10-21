// Client helper (no JSX): uploads ONE file for a form file question to R2 via a presigned PUT and
// returns the FileAnswer to store in the response (quick task 261021-r1c).
import { SUBMISSION_ACCEPT, validateSubmissionFile } from '@/lib/r2';
import { inferAttachmentContentType } from '@/lib/todo-attachments';
import { actionError, type ActionResult } from '@/lib/action-result';
import type { FileAnswer } from '@/lib/forms';
import { createFormUploadUrl } from '@/server/actions/form-response';

export const FORM_FILE_ACCEPT = SUBMISSION_ACCEPT;

const ERR_INVALID = 'ไฟล์ไม่รองรับหรือใหญ่เกิน 10 MB';
const ERR_UPLOAD = 'อัปโหลดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง';

/** Client-side pre-check mirroring the server rule; returns the Thai error or null. */
export function checkFormFile(file: File): string | null {
  const contentType = inferAttachmentContentType(file.name, file.type);
  return validateSubmissionFile(contentType, file.size) ? null : ERR_INVALID;
}

export async function uploadFormFile(
  formId: string,
  questionId: string,
  file: File,
): Promise<ActionResult<{ answer: Extract<FileAnswer, { kind: 'file' }> }>> {
  const contentType = inferAttachmentContentType(file.name, file.type);
  if (!validateSubmissionFile(contentType, file.size)) return actionError(ERR_INVALID);

  try {
    const presigned = await createFormUploadUrl({
      formId,
      questionId,
      fileName: file.name,
      contentType,
      size: file.size,
    });
    if (!presigned.success) return presigned;

    const put = await fetch(presigned.url, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: file,
    });
    if (!put.ok) return actionError(ERR_UPLOAD);

    return {
      success: true,
      answer: { kind: 'file', key: presigned.key, name: file.name.slice(0, 255), size: file.size, contentType },
    };
  } catch {
    return actionError(ERR_UPLOAD);
  }
}
