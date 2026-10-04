// Task discussion thread (quick task 261004-fgj) — pure helpers shared by server actions,
// queries and client UI. Framework-free: no DB / React / server-only imports.

import { formatSubmissionDate } from '@/lib/format';

export const COMMENT_MAX = 2000;
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const COMMENT_POLL_MS = 30_000;
/** Newest comments returned per thread (oldest first). */
export const COMMENT_LIST_LIMIT = 200;

export const COMMENT_ROLES = ['teacher', 'student'] as const;
export type CommentRole = (typeof COMMENT_ROLES)[number];

const UNKNOWN_NAME = 'ไม่ระบุชื่อ';

export type CommentView = {
  id: string;
  authorName: string;
  authorImageUrl: string | null;
  authorRole: CommentRole;
  isMine: boolean;
  /** null when the comment was deleted (the body is never sent to clients). */
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  /** "ส่งครั้งที่ n": the submission round the comment was written after, if any. */
  round: number | null;
  canEdit: boolean;
  canDelete: boolean;
};

export type CommentThreadData = { comments: CommentView[]; count: number; nowIso: string };

// ---------------------------------------------------------------------------------------------
// Body

// C0 controls except \t (0x09) and \n (0x0A), plus DEL.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

export function normalizeCommentBody(raw: string): { ok: true; body: string } | { ok: false } {
  if (typeof raw !== 'string') return { ok: false };
  const body = raw.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').trim();
  if (body.length === 0 || body.length > COMMENT_MAX) return { ok: false };
  return { ok: true, body };
}

export type LinkSegment = { type: 'text'; text: string } | { type: 'link'; href: string; label: string };

// http(s):// or www. not glued to a preceding word / path / email character.
const URL_RE = /(?<![\w.@/:-])(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCT = /[.,!?)\]'"]+$/;

function safeHref(candidate: string): string | null {
  const href = /^www\./i.test(candidate) ? `https://${candidate}` : candidate;
  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return href;
  } catch {
    return null;
  }
}

/**
 * Splits plain text into text / link segments. Only http(s) and www. URLs become links;
 * everything else (including HTML and javascript:/data: strings) stays literal text.
 * Joining every segment's text / label reproduces the input exactly.
 */
export function linkifySegments(input: string): LinkSegment[] {
  const out: LinkSegment[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += text;
    else out.push({ type: 'text', text });
  };

  let cursor = 0;
  for (const match of input.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const label = raw.replace(TRAILING_PUNCT, '');
    const href = label.length > 0 ? safeHref(label) : null;
    pushText(input.slice(cursor, start));
    if (href) {
      out.push({ type: 'link', href, label });
      pushText(raw.slice(label.length));
    } else {
      pushText(raw);
    }
    cursor = start + raw.length;
  }
  pushText(input.slice(cursor));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Permissions

type CommentPermRow = { userId: string; createdAt: Date; deletedAt: Date | null };

export function canEditComment(comment: CommentPermRow, viewerId: string, now: Date): boolean {
  if (comment.deletedAt) return false;
  if (comment.userId !== viewerId) return false;
  return now.getTime() - comment.createdAt.getTime() <= COMMENT_EDIT_WINDOW_MS;
}

export function canDeleteComment(
  comment: Pick<CommentPermRow, 'userId' | 'deletedAt'>,
  viewerId: string,
  viewerIsEditor: boolean,
): boolean {
  if (comment.deletedAt) return false;
  return comment.userId === viewerId || viewerIsEditor;
}

/** 1-based round of a submission among the thread's in-scope submissions (oldest first). */
export function roundForSubmission(submissionId: string | null, scopedIdsOldestFirst: string[]): number | null {
  if (!submissionId) return null;
  const index = scopedIdsOldestFirst.indexOf(submissionId);
  return index === -1 ? null : index + 1;
}

// ---------------------------------------------------------------------------------------------
// Thread key

export type ThreadOwner = { groupId: string; userId: string | null };
export type ThreadOwnerError = 'forbidden' | 'student_required';

/**
 * Which thread (work page owner key) the viewer may open.
 * - students: always their own thread (group page, or their own page for individual to-dos);
 *   asking for any other group / student is 'forbidden'
 * - editors: group to-do → the to-do's group; individual → the requested student, who must be
 *   known to the to-do's group ('student_required' when none was given)
 */
export function resolveThreadOwner(input: {
  viewerKind: 'editor' | 'student';
  viewerId: string;
  mode: 'group' | 'individual';
  todoGroupId: string;
  groupId?: string | null;
  studentId?: string | null;
  isKnownStudent?: boolean;
}): { ok: true; owner: ThreadOwner } | { ok: false; error: ThreadOwnerError } {
  const { viewerKind, viewerId, mode, todoGroupId } = input;
  if (input.groupId && input.groupId !== todoGroupId) return { ok: false, error: 'forbidden' };

  if (viewerKind === 'student') {
    if (input.studentId && input.studentId !== viewerId) return { ok: false, error: 'forbidden' };
    return { ok: true, owner: { groupId: todoGroupId, userId: mode === 'group' ? null : viewerId } };
  }

  if (mode === 'group') return { ok: true, owner: { groupId: todoGroupId, userId: null } };
  if (!input.studentId) return { ok: false, error: 'student_required' };
  if (!input.isKnownStudent) return { ok: false, error: 'forbidden' };
  return { ok: true, owner: { groupId: todoGroupId, userId: input.studentId } };
}

// ---------------------------------------------------------------------------------------------
// Display

export function formatCommentTime(createdAt: Date | string, now: Date | string): string {
  const created = new Date(createdAt);
  const diff = new Date(now).getTime() - created.getTime();
  if (diff < 60_000) return 'เมื่อสักครู่';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} นาทีที่แล้ว`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชม.ที่แล้ว`;
  return formatSubmissionDate(created);
}

/** Name safe to show to any viewer: full name, then username, never an email. */
export function publicDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  const fullName = [user.firstName, user.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return fullName || (user.username ?? '').trim() || UNKNOWN_NAME;
}

/** True when a non-deleted teacher comment is newer than lastSeenAt (null = never seen). */
export function hasUnreadTeacherComments(
  comments: { authorRole: CommentRole; createdAt: Date; deletedAt: Date | null }[],
  lastSeenAt: Date | null,
): boolean {
  return comments.some(
    (c) =>
      c.authorRole === 'teacher' &&
      !c.deletedAt &&
      (lastSeenAt === null || c.createdAt.getTime() > lastSeenAt.getTime()),
  );
}

export type CommentRowForView = {
  id: string;
  userId: string;
  content: string;
  authorRole: CommentRole;
  submissionId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
};

export type CommentViewContext = {
  viewerId: string;
  viewerIsEditor: boolean;
  now: Date;
  /** Public identity only (no email). */
  directory: Map<string, { publicName: string; imageUrl: string | null }>;
  submissionIdsOldestFirst: string[];
};

export function toCommentView(row: CommentRowForView, ctx: CommentViewContext): CommentView {
  const author = ctx.directory.get(row.userId);
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    authorName: author?.publicName ?? UNKNOWN_NAME,
    authorImageUrl: author?.imageUrl ?? null,
    authorRole: row.authorRole,
    isMine: row.userId === ctx.viewerId,
    body: deleted ? null : row.content,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    deleted,
    round: roundForSubmission(row.submissionId, ctx.submissionIdsOldestFirst),
    canEdit: canEditComment(row, ctx.viewerId, ctx.now),
    canDelete: canDeleteComment(row, ctx.viewerId, ctx.viewerIsEditor),
  };
}

/** Thread count shown in the "ความคิดเห็น (n)" title: non-deleted comments. */
export function visibleCommentCount(comments: Pick<CommentView, 'deleted'>[]): number {
  return comments.filter((c) => !c.deleted).length;
}
