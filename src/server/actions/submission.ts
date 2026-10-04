'use server';

// Submissions are created by submitWorkPage (src/server/actions/work-page.ts, 261004-01i);
// the old file-only submit + upload-URL actions were removed so file_requirement cannot be
// bypassed. Only the signed-URL action for submitted files remains here.

import { z } from 'zod';
import { db } from '@/db';
import { submissionFiles } from '@/db/schema/submissions';
import { eq } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { presignGet } from '@/lib/r2';
import { isInSubmissionScope } from '@/server/queries/submission';
import { authorizeTodoViewer } from '@/server/work-page-access';

type Fail = { ok: false; error: string };

const ERR_ACCESS = 'ไม่มีสิทธิ์ส่งงานนี้';
const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';

const fileUrlSchema = z.object({ fileId: z.string().min(1) });

/**
 * Signed URL for a submitted file. Classroom editors may open any file of the classroom's to-dos;
 * students only files in their own submission scope (group / own). Unrelated users → throws.
 */
export async function getSubmissionFileUrl(
  input: z.infer<typeof fileUrlSchema>,
): Promise<{ ok: true; url: string } | Fail> {
  const userId = await getCurrentUserId();
  const parsed = fileUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERR_INPUT };

  const file = await db.query.submissionFiles.findFirst({
    where: eq(submissionFiles.id, parsed.data.fileId),
    with: { submission: true },
  });
  if (!file) return { ok: false, error: 'ไม่พบไฟล์' };

  const viewer = await authorizeTodoViewer(file.submission.todoId, userId);
  if (
    viewer.kind === 'student' &&
    !isInSubmissionScope(file.submission, viewer.todo.submissionMode, viewer.groupId, userId)
  ) {
    return { ok: false, error: ERR_ACCESS };
  }

  try {
    const url = await presignGet(
      file.fileKey,
      3600,
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์' };
  }
}
