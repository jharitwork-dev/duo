// Client helper (no JSX): uploads ONE file to R2 via a presigned PUT and attaches it to every
// target to-do (multi-group copies share the single object). Quick 261004-gid.
import { validateAttachmentFile } from '@/lib/r2';
import { ATTACHMENT_ERRORS, inferAttachmentContentType } from '@/lib/todo-attachments';
import { actionError, type ActionResult } from '@/lib/action-result';
import {
  addTodoAttachment,
  createAttachmentUploadUrl,
  type TodoAttachmentDTO,
} from '@/server/actions/todo-attachment';

/** Client-side pre-check mirroring the server rules; returns the Thai error or null. */
export function checkAttachmentFile(file: File): string | null {
  const contentType = inferAttachmentContentType(file.name, file.type);
  return validateAttachmentFile(contentType, file.size) ? null : ATTACHMENT_ERRORS.invalidFile;
}

export async function uploadTodoAttachment(
  file: File,
  todoIds: string[],
): Promise<ActionResult<{ attachments: TodoAttachmentDTO[] }>> {
  const contentType = inferAttachmentContentType(file.name, file.type);
  if (!validateAttachmentFile(contentType, file.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);

  try {
    const presigned = await createAttachmentUploadUrl({
      todoIds,
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
    if (!put.ok) return actionError(ATTACHMENT_ERRORS.uploadFailed);

    return await addTodoAttachment({
      todoIds,
      key: presigned.key,
      fileName: file.name,
      contentType,
      size: file.size,
    });
  } catch {
    return actionError(ATTACHMENT_ERRORS.uploadFailed);
  }
}
