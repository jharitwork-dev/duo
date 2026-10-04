// Work page read models for the student and teacher to-do pages (261004-01i).

import { db } from '@/db';
import { groupMembers } from '@/db/schema/groups';
import { submissions } from '@/db/schema/submissions';
import { workPages, workPageFiles } from '@/db/schema/workPages';
import { asc, desc, eq } from 'drizzle-orm';
import { getR2Config } from '@/lib/r2';
import { getUserDirectory } from '@/lib/user-directory';
import { hasPageContent, type FileRequirement, type WorkPageDoc, type WorkPageLock } from '@/lib/work-page';
import type { SubmissionStatus } from '@/lib/node-path';
import { authorizeTodoViewer, loadWorkPageAccess } from '@/server/work-page-access';

export interface WorkPageFileView {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface StudentWorkPageData {
  page: { content: WorkPageDoc; updatedAt: string; updatedByName: string | null } | null;
  files: WorkPageFileView[];
  fileRequirement: FileRequirement;
  canEdit: boolean;
  latestStatus: SubmissionStatus;
  phaseViewable: boolean;
  storageReady: boolean;
  /** Effective deadline (todo ?? phase), ISO; null = no deadline (261004-03i). */
  deadline: string | null;
  /** Why the page is read-only right now (null = editable). */
  lock: WorkPageLock | null;
  /** Latest in-scope submission (the one "อัปเดตงานที่ส่ง" rewrites while pending). ISO strings. */
  latestSubmission: { id: string; createdAt: string; updatedAt: string } | null;
  /** Server time when this was computed (seed for the client clock). */
  serverNow: string;
}

function fileView(f: { id: string; fileName: string; contentType: string; fileSize: number }): WorkPageFileView {
  return { id: f.id, fileName: f.fileName, contentType: f.contentType, fileSize: f.fileSize };
}

/** Student view of their (group's) page. Null when the student has no access. */
export async function getStudentWorkPage(todoId: string, userId: string): Promise<StudentWorkPageData | null> {
  const access = await loadWorkPageAccess(todoId, userId);
  if (!access) return null;
  const { page } = access;

  const files = page
    ? await db.select().from(workPageFiles).where(eq(workPageFiles.workPageId, page.id)).orderBy(asc(workPageFiles.createdAt))
    : [];
  const directory = await getUserDirectory(page?.updatedBy ? [page.updatedBy] : []);

  return {
    page: page
      ? {
          content: page.content as WorkPageDoc,
          updatedAt: page.updatedAt.toISOString(),
          // Student-facing: publicName never falls back to a classmate's email (261004-fgj).
          updatedByName: page.updatedBy ? (directory.get(page.updatedBy)?.publicName ?? null) : null,
        }
      : null,
    files: files.map(fileView),
    fileRequirement: access.todo.fileRequirement,
    canEdit: access.canEdit,
    latestStatus: access.latestStatus,
    phaseViewable: access.phaseViewable,
    storageReady: getR2Config() !== null,
    deadline: access.deadline ? access.deadline.toISOString() : null,
    lock: access.lock,
    latestSubmission: access.latestSubmission
      ? {
          id: access.latestSubmission.id,
          createdAt: access.latestSubmission.createdAt.toISOString(),
          updatedAt: access.latestSubmission.updatedAt.toISOString(),
        }
      : null,
    serverNow: new Date().toISOString(),
  };
}

export interface TeacherWorkPageEntry {
  key: string;
  ownerLabel: string;
  latestSubmission: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    attempt: number;
    createdAt: string;
    /** Bumped by "อัปเดตงานที่ส่ง" while pending (261004-03i). */
    updatedAt: string;
    content: WorkPageDoc | null;
    files: WorkPageFileView[];
    submittedByName: string;
  } | null;
  livePage: {
    content: WorkPageDoc;
    updatedAt: string;
    updatedByName: string | null;
    files: WorkPageFileView[];
  } | null;
  liveIsNewer: boolean;
  /** Oldest in-scope submission (drives on_time / late, 261004-03i); ISO. */
  firstSubmittedAt: string | null;
}

/**
 * Teacher (classroom editor) read-only view: latest submission snapshot + live page per owner
 * (one entry for a group to-do, one per student for an individual to-do). Throws for non-editors.
 */
export async function getTeacherWorkPageView(todoId: string, userId: string) {
  const viewer = await authorizeTodoViewer(todoId, userId);
  if (viewer.kind !== 'editor') throw new Error('To-do not found or not authorized');
  const { todo } = viewer;

  const [members, submissionRows, pageRows] = await Promise.all([
    db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, todo.groupId)),
    db.query.submissions.findMany({
      where: eq(submissions.todoId, todoId),
      orderBy: [desc(submissions.createdAt)],
      with: { files: true },
    }),
    db.query.workPages.findMany({
      where: eq(workPages.todoId, todoId),
      with: { files: { orderBy: [asc(workPageFiles.createdAt)] } },
    }),
  ]);

  const directory = await getUserDirectory([
    ...members.map((m) => m.userId),
    ...submissionRows.map((s) => s.submittedBy),
    ...pageRows.map((p) => p.updatedBy ?? '').filter(Boolean),
    ...pageRows.map((p) => p.userId ?? '').filter(Boolean),
  ]);
  const nameOf = (id: string | null | undefined) => (id ? (directory.get(id)?.name ?? 'ไม่ระบุชื่อ') : null);

  function buildEntry(
    key: string,
    ownerLabel: string,
    scoped: typeof submissionRows,
    page: (typeof pageRows)[number] | undefined,
  ): TeacherWorkPageEntry {
    const latest = scoped[0];
    const pageHasWork = !!page && (hasPageContent(page.content as WorkPageDoc) || page.files.length > 0);
    return {
      key,
      ownerLabel,
      latestSubmission: latest
        ? {
            id: latest.id,
            status: latest.status,
            attempt: scoped.length,
            createdAt: latest.createdAt.toISOString(),
            updatedAt: latest.updatedAt.toISOString(),
            content: (latest.content as WorkPageDoc | null) ?? null,
            files: latest.files.map(fileView),
            submittedByName: nameOf(latest.submittedBy) ?? 'ไม่ระบุชื่อ',
          }
        : null,
      livePage: page
        ? {
            content: page.content as WorkPageDoc,
            updatedAt: page.updatedAt.toISOString(),
            updatedByName: nameOf(page.updatedBy),
            files: page.files.map(fileView),
          }
        : null,
      // Compare with updatedAt: a student update re-snapshots the page into the same submission.
      liveIsNewer: pageHasWork && (!latest || page!.updatedAt.getTime() > latest.updatedAt.getTime()),
      // scoped is newest first → the last row is the first submission.
      firstSubmittedAt: scoped.length > 0 ? scoped[scoped.length - 1].createdAt.toISOString() : null,
    };
  }

  let entries: TeacherWorkPageEntry[];
  if (todo.submissionMode === 'group') {
    const scoped = submissionRows.filter((s) => s.groupId === todo.groupId);
    const page = pageRows.find((p) => p.userId === null && p.groupId === todo.groupId);
    entries = [buildEntry(todo.groupId, todo.group.name, scoped, page)];
  } else {
    // Current members first, then anyone who left but still has a submission or page.
    const ids = [
      ...new Set([
        ...members.map((m) => m.userId),
        ...submissionRows.map((s) => s.submittedBy),
        ...pageRows.map((p) => p.userId ?? '').filter(Boolean),
      ]),
    ];
    entries = ids.map((id) =>
      buildEntry(
        id,
        nameOf(id) ?? 'ไม่ระบุชื่อ',
        submissionRows.filter((s) => s.submittedBy === id),
        pageRows.find((p) => p.userId === id),
      ),
    );
  }

  return { todo: { id: todo.id, title: todo.title, submissionMode: todo.submissionMode, fileRequirement: todo.fileRequirement }, entries };
}

export type TeacherWorkPageView = Awaited<ReturnType<typeof getTeacherWorkPageView>>;
