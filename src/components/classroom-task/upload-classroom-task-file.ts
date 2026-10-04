// Client helper (no JSX): uploads ONE file to R2 via a presigned PUT and attaches it to a
// classroom-level task; the server then pushes it to every non-overridden group copy (261004-j6h).
import { validateAttachmentFile } from '@/lib/r2';
import { ATTACHMENT_ERRORS, inferAttachmentContentType } from '@/lib/todo-attachments';
import { actionError, type ActionResult } from '@/lib/action-result';
import {
  addClassroomTaskFile,
  createClassroomTaskUploadUrl,
  type ClassroomTaskFileDTO,
} from '@/server/actions/classroom-task';

export async function uploadClassroomTaskFile(
  file: File,
  classroomTaskId: string,
): Promise<ActionResult<{ file: ClassroomTaskFileDTO }>> {
  const contentType = inferAttachmentContentType(file.name, file.type);
  if (!validateAttachmentFile(contentType, file.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);

  try {
    const presigned = await createClassroomTaskUploadUrl({
      classroomTaskId,
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

    return await addClassroomTaskFile({
      classroomTaskId,
      key: presigned.key,
      fileName: file.name,
      contentType,
      size: file.size,
    });
  } catch {
    return actionError(ATTACHMENT_ERRORS.uploadFailed);
  }
}
