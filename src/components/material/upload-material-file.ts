// Client helper (no JSX): uploads ONE file to R2 via a presigned PUT and attaches it to a learning
// material ("สื่อการเรียน", 261113-lz7).
import { validateAttachmentFile } from '@/lib/r2';
import { ATTACHMENT_ERRORS, inferAttachmentContentType } from '@/lib/todo-attachments';
import { actionError, type ActionResult } from '@/lib/action-result';
import { addMaterialFile, createMaterialUploadUrl, type MaterialFileDTO } from '@/server/actions/material';

export async function uploadMaterialFile(
  file: File,
  materialId: string,
): Promise<ActionResult<{ file: MaterialFileDTO }>> {
  const contentType = inferAttachmentContentType(file.name, file.type);
  if (!validateAttachmentFile(contentType, file.size)) return actionError(ATTACHMENT_ERRORS.invalidFile);

  try {
    const presigned = await createMaterialUploadUrl({
      materialId,
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

    return await addMaterialFile({
      materialId,
      key: presigned.key,
      fileName: file.name,
      contentType,
      size: file.size,
    });
  } catch {
    return actionError(ATTACHMENT_ERRORS.uploadFailed);
  }
}
