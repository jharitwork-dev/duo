'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { submissions, submissionFiles } from '@/db/schema/submissions';
import { eq, desc } from 'drizzle-orm';
import { requireRole, getCurrentUserId } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { presignGet, presignPut, submissionKey, validateSubmissionFile } from '@/lib/r2';
import { isPhaseViewable } from '@/lib/node-path';
import { isInSubmissionScope, resolveStudentTodoAccess } from '@/server/queries/submission';

type Fail = { ok: false; error: string };

const ERR_FILE = 'ไฟล์ไม่รองรับหรือใหญ่เกิน 10 MB';
const ERR_ACCESS = 'ไม่มีสิทธิ์ส่งงานนี้';
const ERR_LOCKED = 'Phase นี้ยังไม่ปลดล็อค';
const ERR_DUPLICATE = 'มีงานที่ส่งแล้วรอตรวจหรือผ่านแล้ว';
const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';

const uploadUrlSchema = z.object({
  todoId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

export async function createSubmissionUploadUrl(
  input: z.infer<typeof uploadUrlSchema>,
): Promise<{ ok: true; key: string; url: string } | Fail> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = uploadUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERR_INPUT };
  const data = parsed.data;

  if (!validateSubmissionFile(data.contentType, data.size)) return { ok: false, error: ERR_FILE };

  const access = await resolveStudentTodoAccess(data.todoId, userId);
  if (!access) return { ok: false, error: ERR_ACCESS };
  if (!isPhaseViewable(access.phase)) return { ok: false, error: ERR_LOCKED };

  const safeName = data.fileName.replace(/[^\w.\-]/g, '_').slice(-100);
  const key = submissionKey(userId, data.todoId, `${createId()}-${safeName}`);
  try {
    const url = await presignPut(key, data.contentType);
    return { ok: true, key, url };
  } catch {
    return { ok: false, error: 'ระบบจัดเก็บไฟล์ไม่พร้อมใช้งาน' };
  }
}

const createSubmissionSchema = z.object({
  todoId: z.string().min(1),
  files: z
    .array(
      z.object({
        key: z.string().min(1).max(512),
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(255),
        size: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(10),
});

export async function createSubmission(
  input: z.infer<typeof createSubmissionSchema>,
): Promise<{ ok: true; submissionId: string } | Fail> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = createSubmissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERR_INPUT };
  const data = parsed.data;

  const access = await resolveStudentTodoAccess(data.todoId, userId);
  if (!access) return { ok: false, error: ERR_ACCESS };
  if (!isPhaseViewable(access.phase)) return { ok: false, error: ERR_LOCKED };
  const { todo, groupId, classroomId } = access;

  const keyPrefix = `submissions/${userId}/${data.todoId}/`;
  for (const file of data.files) {
    if (!file.key.startsWith(keyPrefix) || file.key.includes('..')) {
      return { ok: false, error: ERR_ACCESS };
    }
    if (!validateSubmissionFile(file.contentType, file.size)) {
      return { ok: false, error: ERR_FILE };
    }
  }

  // Block a new submission while the latest in scope is pending or approved (SUB-06).
  const existing = await db
    .select({
      status: submissions.status,
      groupId: submissions.groupId,
      submittedBy: submissions.submittedBy,
    })
    .from(submissions)
    .where(eq(submissions.todoId, data.todoId))
    .orderBy(desc(submissions.createdAt));
  const latest = existing.find((row) =>
    isInSubmissionScope(row, todo.submissionMode, groupId, userId),
  );
  if (latest && (latest.status === 'pending' || latest.status === 'approved')) {
    return { ok: false, error: ERR_DUPLICATE };
  }

  const submissionId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(submissions)
      .values({ todoId: data.todoId, submittedBy: userId, groupId, status: 'pending' })
      .returning({ id: submissions.id });
    await tx.insert(submissionFiles).values(
      data.files.map((file) => ({
        submissionId: inserted.id,
        fileName: file.fileName,
        fileKey: file.key,
        contentType: file.contentType,
        fileSize: file.size,
      })),
    );
    return inserted.id;
  });

  revalidatePath(`/todo/${data.todoId}`);
  revalidatePath(`/student/classroom/${classroomId}/group/${groupId}`);
  return { ok: true, submissionId };
}

const fileUrlSchema = z.object({ fileId: z.string().min(1) });

export async function getSubmissionFileUrl(
  input: z.infer<typeof fileUrlSchema>,
): Promise<{ ok: true; url: string } | Fail> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = fileUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERR_INPUT };

  const file = await db.query.submissionFiles.findFirst({
    where: eq(submissionFiles.id, parsed.data.fileId),
    with: { submission: true },
  });
  if (!file) return { ok: false, error: 'ไม่พบไฟล์' };

  const access = await resolveStudentTodoAccess(file.submission.todoId, userId);
  if (!access) return { ok: false, error: ERR_ACCESS };
  if (!isInSubmissionScope(file.submission, access.todo.submissionMode, access.groupId, userId)) {
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
    return { ok: false, error: 'ระบบจัดเก็บไฟล์ไม่พร้อมใช้งาน' };
  }
}
