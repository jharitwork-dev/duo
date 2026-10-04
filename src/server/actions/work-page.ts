'use server';

// Work page server actions (quick task 261004-01i). Every export authorizes via
// resolveWorkPageAccess( (student page owner) or authorizeTodoViewer( (file viewers).

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { submissions, submissionFiles } from '@/db/schema/submissions';
import { workPages, workPageFiles } from '@/db/schema/workPages';
import { count, eq } from 'drizzle-orm';
import { getCurrentUserId, requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { getR2Config, presignGet, presignPut, validateSubmissionFile } from '@/lib/r2';
import { cleanupR2Objects } from '@/lib/r2-cleanup';
import { getUserDirectory } from '@/lib/user-directory';
import { actionError, type ActionResult } from '@/lib/action-result';
import {
  canEditWorkPage,
  canSubmitWorkPage,
  hasPageContent,
  isSaveConflict,
  plainTextFromDoc,
  validateWorkPageContent,
  workPageOwnerKey,
  type WorkPageDoc,
} from '@/lib/work-page';
import {
  authorizeTodoViewer,
  findPage,
  getOrCreatePage,
  isPageOwnedBy,
  latestScopedStatus,
  resolveWorkPageAccess,
  type WorkPageAccess,
  type WorkPageRow,
} from '@/server/work-page-access';

const ERR_INPUT = 'ข้อมูลไม่ถูกต้อง';
const ERR_CONTENT = 'เนื้อหายาวเกินไปหรือไม่ถูกต้อง';
const ERR_SUBMITTED = 'งานนี้ส่งแล้ว แก้ไขไม่ได้';
const ERR_LOCKED = 'Phase นี้ยังไม่ปลดล็อค';
const ERR_STALE = 'มีการแก้ไขใหม่ กรุณาตรวจสอบก่อนส่ง';
const ERR_NO_STORAGE = 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์';
const ERR_NO_FILES = 'งานนี้ไม่ต้องแนบไฟล์';
const ERR_FILE = 'ไฟล์ไม่รองรับหรือใหญ่เกิน 10 MB';
const ERR_TOO_MANY = 'แนบไฟล์ได้สูงสุด 10 ไฟล์';
const ERR_NOT_FOUND = 'ไม่พบไฟล์';
const MAX_FILES = 10;

export interface WorkPageConflict {
  content: WorkPageDoc;
  updatedAt: string;
  updatedByName: string;
}

export interface WorkPageFileDTO {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

type ConflictFail = { success: false; error: string; conflict?: WorkPageConflict };

function blockedEditMessage(access: Pick<WorkPageAccess, 'phaseViewable'>): string {
  return access.phaseViewable ? ERR_SUBMITTED : ERR_LOCKED;
}

async function toConflict(page: WorkPageRow): Promise<WorkPageConflict> {
  const directory = await getUserDirectory(page.updatedBy ? [page.updatedBy] : []);
  return {
    content: (page.content as WorkPageDoc) ?? null,
    updatedAt: page.updatedAt.toISOString(),
    updatedByName: (page.updatedBy && directory.get(page.updatedBy)?.name) || 'สมาชิกในกลุ่ม',
  };
}

function toFileDTO(row: typeof workPageFiles.$inferSelect): WorkPageFileDTO {
  return { id: row.id, fileName: row.fileName, contentType: row.contentType, fileSize: row.fileSize };
}

// ---------------------------------------------------------------------------------------------
// Autosave

const saveSchema = z.object({
  todoId: z.string().min(1),
  content: z.unknown(),
  baseUpdatedAt: z.string().max(64).nullable(),
});

export async function saveWorkPage(
  input: z.infer<typeof saveSchema>,
): Promise<{ success: true; updatedAt: string } | ConflictFail> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { todoId, baseUpdatedAt } = parsed.data;

  const access = await resolveWorkPageAccess(todoId, userId);
  const valid = validateWorkPageContent(parsed.data.content);
  if (!valid.ok) return actionError(ERR_CONTENT);

  const result = await db.transaction(async (tx) => {
    const page = await findPage(tx, todoId, access.owner, { lock: true });
    const latest = await latestScopedStatus(tx, todoId, access.todo.submissionMode, access.groupId, userId);
    if (!canEditWorkPage(latest, access.phaseViewable)) return { kind: 'blocked' as const };
    if (isSaveConflict(baseUpdatedAt, page)) return { kind: 'conflict' as const, page: page! };

    const now = new Date();
    if (!page) {
      const inserted = await tx
        .insert(workPages)
        .values({
          todoId,
          groupId: access.owner.groupId,
          userId: access.owner.userId,
          content: valid.doc,
          updatedAt: now,
          updatedBy: userId,
        })
        .onConflictDoNothing()
        .returning({ id: workPages.id });
      if (inserted.length === 0) {
        // Another member created the page concurrently: treat as a conflict.
        const fresh = await findPage(tx, todoId, access.owner);
        if (fresh) return { kind: 'conflict' as const, page: fresh };
        return { kind: 'blocked' as const };
      }
    } else {
      await tx
        .update(workPages)
        .set({ content: valid.doc, updatedAt: now, updatedBy: userId })
        .where(eq(workPages.id, page.id));
    }
    return { kind: 'ok' as const, updatedAt: now };
  });

  if (result.kind === 'blocked') return actionError(blockedEditMessage(access));
  if (result.kind === 'conflict') {
    return { success: false, error: 'มีการแก้ไขจากสมาชิกคนอื่น', conflict: await toConflict(result.page) };
  }
  // No revalidatePath on autosave: re-rendering the page on every keystroke would reset the editor.
  return { success: true, updatedAt: result.updatedAt.toISOString() };
}

// ---------------------------------------------------------------------------------------------
// Submit (snapshot page + files into a pending submission)

const submitSchema = z.object({
  todoId: z.string().min(1),
  baseUpdatedAt: z.string().max(64).nullable(),
});

export async function submitWorkPage(
  input: z.infer<typeof submitSchema>,
): Promise<{ success: true; submissionId: string } | ConflictFail> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const { todoId, baseUpdatedAt } = parsed.data;

  const access = await resolveWorkPageAccess(todoId, userId);
  const { todo, groupId, classroomId } = access;
  const fileRequirement = todo.fileRequirement;

  const result = await db.transaction(async (tx) => {
    // Row lock (SELECT ... FOR UPDATE) serialises concurrent submits by two members of the same group.
    const page = await findPage(tx, todoId, access.owner, { lock: true });
    if (page && isSaveConflict(baseUpdatedAt, page)) return { kind: 'conflict' as const, page };

    const latest = await latestScopedStatus(tx, todoId, todo.submissionMode, groupId, userId);
    const files = page ? await tx.select().from(workPageFiles).where(eq(workPageFiles.workPageId, page.id)) : [];
    const usableFiles = fileRequirement === 'none' ? [] : files;
    const content = (page?.content as WorkPageDoc | undefined) ?? null;

    const eligibility = canSubmitWorkPage({
      fileRequirement,
      fileCount: usableFiles.length,
      hasContent: hasPageContent(content),
      latestStatus: latest,
      phaseViewable: access.phaseViewable,
    });
    if (!eligibility.ok) {
      const storageHint =
        eligibility.reason === 'file_required' && !getR2Config() ? ` (${ERR_NO_STORAGE})` : '';
      return { kind: 'blocked' as const, message: eligibility.message + storageHint };
    }

    const [inserted] = await tx
      .insert(submissions)
      .values({
        todoId,
        submittedBy: userId,
        groupId,
        status: 'pending',
        content,
        textContent: plainTextFromDoc(content).slice(0, 20000) || null,
      })
      .returning({ id: submissions.id });
    if (usableFiles.length > 0) {
      // Same R2 keys: the objects are shared by the page and the submission snapshot.
      await tx.insert(submissionFiles).values(
        usableFiles.map((f) => ({
          submissionId: inserted.id,
          fileName: f.fileName,
          fileKey: f.fileKey,
          contentType: f.contentType,
          fileSize: f.fileSize,
        })),
      );
    }
    return { kind: 'ok' as const, submissionId: inserted.id };
  });

  if (result.kind === 'conflict') return { success: false, error: ERR_STALE, conflict: await toConflict(result.page) };
  if (result.kind === 'blocked') return actionError(result.message);

  revalidatePath(`/todo/${todoId}`);
  revalidatePath(`/student/classroom/${classroomId}/group/${groupId}`);
  return { success: true, submissionId: result.submissionId };
}

// ---------------------------------------------------------------------------------------------
// Files

const uploadUrlSchema = z.object({
  todoId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

function fileGate(access: WorkPageAccess): string | null {
  if (!access.canEdit) return blockedEditMessage(access);
  if (access.todo.fileRequirement === 'none') return ERR_NO_FILES;
  return null;
}

export async function createWorkPageUploadUrl(
  input: z.infer<typeof uploadUrlSchema>,
): Promise<ActionResult<{ key: string; url: string }>> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = uploadUrlSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const data = parsed.data;

  const access = await resolveWorkPageAccess(data.todoId, userId);
  if (!getR2Config()) return actionError(ERR_NO_STORAGE);
  const gate = fileGate(access);
  if (gate) return actionError(gate);
  if (!validateSubmissionFile(data.contentType, data.size)) return actionError(ERR_FILE);

  // Creating the page does NOT bump updatedAt of an existing page (content-only versioning).
  const page = await db.transaction((tx) => getOrCreatePage(tx, data.todoId, access.owner, userId));
  const [{ n }] = await db.select({ n: count() }).from(workPageFiles).where(eq(workPageFiles.workPageId, page.id));
  if (n >= MAX_FILES) return actionError(ERR_TOO_MANY);

  const safeName = data.fileName.replace(/[^\w.\-]/g, '_').slice(-100);
  const key = `workpages/${data.todoId}/${page.id}/${createId()}-${safeName}`;
  try {
    const url = await presignPut(key, data.contentType);
    return { success: true, key, url };
  } catch {
    return actionError(ERR_NO_STORAGE);
  }
}

const attachSchema = z.object({
  todoId: z.string().min(1),
  key: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

export async function attachWorkPageFile(
  input: z.infer<typeof attachSchema>,
): Promise<ActionResult<{ file: WorkPageFileDTO }>> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);
  const data = parsed.data;

  const access = await resolveWorkPageAccess(data.todoId, userId);
  const gate = fileGate(access);
  if (gate) return actionError(gate);
  if (!validateSubmissionFile(data.contentType, data.size)) return actionError(ERR_FILE);

  const result = await db.transaction(async (tx) => {
    const page = await findPage(tx, data.todoId, access.owner, { lock: true });
    if (!page) return { error: ERR_INPUT };
    if (!data.key.startsWith(`workpages/${data.todoId}/${page.id}/`) || data.key.includes('..')) {
      return { error: ERR_INPUT };
    }
    const latest = await latestScopedStatus(tx, data.todoId, access.todo.submissionMode, access.groupId, userId);
    if (!canEditWorkPage(latest, access.phaseViewable)) return { error: blockedEditMessage(access) };
    const [{ n }] = await tx.select({ n: count() }).from(workPageFiles).where(eq(workPageFiles.workPageId, page.id));
    if (n >= MAX_FILES) return { error: ERR_TOO_MANY };
    const [row] = await tx
      .insert(workPageFiles)
      .values({
        workPageId: page.id,
        fileName: data.fileName,
        fileKey: data.key,
        contentType: data.contentType,
        fileSize: data.size,
        uploadedBy: userId,
      })
      .returning();
    return { file: toFileDTO(row) };
  });

  if ('error' in result) return actionError(result.error ?? ERR_INPUT);
  return { success: true, file: result.file };
}

const fileIdSchema = z.object({ fileId: z.string().min(1) });

export async function removeWorkPageFile(input: z.infer<typeof fileIdSchema>): Promise<ActionResult> {
  await requireRole(ROLES.STUDENT);
  const userId = await getCurrentUserId();
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);

  const file = await db.query.workPageFiles.findFirst({
    where: eq(workPageFiles.id, parsed.data.fileId),
    with: { workPage: true },
  });
  if (!file) return actionError(ERR_NOT_FOUND);

  const access = await resolveWorkPageAccess(file.workPage.todoId, userId);
  if (!isPageOwnedBy(file.workPage, access.owner)) throw new Error('To-do not found or not authorized');

  const removed = await db.transaction(async (tx) => {
    const page = await findPage(tx, file.workPage.todoId, access.owner, { lock: true });
    if (!page || page.id !== file.workPageId) return { error: ERR_NOT_FOUND };
    const latest = await latestScopedStatus(
      tx,
      page.todoId,
      access.todo.submissionMode,
      access.groupId,
      userId,
    );
    if (!canEditWorkPage(latest, access.phaseViewable)) return { error: blockedEditMessage(access) };
    await tx.delete(workPageFiles).where(eq(workPageFiles.id, file.id));
    const [{ n }] = await tx
      .select({ n: count() })
      .from(submissionFiles)
      .where(eq(submissionFiles.fileKey, file.fileKey));
    return { referenced: n > 0 };
  });

  if ('error' in removed) return actionError(removed.error ?? ERR_INPUT);
  // Never delete an object still referenced by a submission snapshot.
  if (!removed.referenced) await cleanupR2Objects([file.fileKey]);
  return { success: true };
}

export async function getWorkPageFileUrl(input: z.infer<typeof fileIdSchema>): Promise<ActionResult<{ url: string }>> {
  const userId = await getCurrentUserId();
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return actionError(ERR_INPUT);

  const file = await db.query.workPageFiles.findFirst({
    where: eq(workPageFiles.id, parsed.data.fileId),
    with: { workPage: true },
  });
  if (!file) return actionError(ERR_NOT_FOUND);

  const viewer = await authorizeTodoViewer(file.workPage.todoId, userId);
  if (viewer.kind === 'student') {
    const owner = workPageOwnerKey(viewer.todo.submissionMode, viewer.groupId, userId);
    if (!isPageOwnedBy(file.workPage, owner)) throw new Error('To-do not found or not authorized');
  }

  try {
    const url = await presignGet(file.fileKey, 3600, `inline; filename="${encodeURIComponent(file.fileName)}"`);
    return { success: true, url };
  } catch {
    return actionError(ERR_NO_STORAGE);
  }
}
