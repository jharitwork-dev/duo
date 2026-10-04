// Work page (Notion-like to-do page) — pure helpers shared by server actions, queries and client UI.
// Framework-free: no DB / React imports.
import { z } from 'zod';
import type { SubmissionStatus } from '@/lib/node-path';

/** Tiptap JSON node (subset we store). */
export interface WorkPageNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: WorkPageNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export type WorkPageDoc = WorkPageNode & { type: 'doc' };

export const EMPTY_DOC: WorkPageDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export const FILE_REQUIREMENTS = ['none', 'optional', 'required'] as const;
export type FileRequirement = (typeof FILE_REQUIREMENTS)[number];

export const FILE_REQUIREMENT_LABEL: Record<FileRequirement, string> = {
  none: 'ไม่ต้องแนบไฟล์',
  optional: 'แนบไฟล์ได้ (ไม่บังคับ)',
  required: 'ต้องแนบไฟล์อย่างน้อย 1 ไฟล์',
};

// ---------------------------------------------------------------------------------------------
// Allow-lists (must cover every node / mark produced by workPageExtensions(); see the schema-sync test)

export const WORK_PAGE_NODE_TYPES = [
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'horizontalRule',
  'hardBreak',
] as const;

export const WORK_PAGE_MARK_TYPES = ['bold', 'italic', 'strike', 'code', 'underline', 'link'] as const;

export const MAX_CONTENT_BYTES = 200_000;
export const MAX_CONTENT_DEPTH = 32;

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const markSchema = z.object({
  type: z.enum(WORK_PAGE_MARK_TYPES),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

const nodeSchema: z.ZodType<WorkPageNode> = z.lazy(() =>
  z.object({
    type: z.enum(WORK_PAGE_NODE_TYPES),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(nodeSchema).optional(),
    marks: z.array(markSchema).optional(),
    text: z.string().optional(),
  }),
);

function maxDepth(node: unknown, depth = 1): number {
  if (depth > MAX_CONTENT_DEPTH) return depth;
  if (!node || typeof node !== 'object') return depth;
  const content = (node as { content?: unknown }).content;
  if (!Array.isArray(content)) return depth;
  let deepest = depth;
  for (const child of content) {
    deepest = Math.max(deepest, maxDepth(child, depth + 1));
    if (deepest > MAX_CONTENT_DEPTH) break;
  }
  return deepest;
}

/** True when a link href parses to an allowed protocol (http/https/mailto). */
export function isSafeLinkHref(href: unknown): boolean {
  if (typeof href !== 'string' || href.length === 0 || href.length > 2048) return false;
  try {
    return LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

function linksAreSafe(node: WorkPageNode): boolean {
  for (const mark of node.marks ?? []) {
    if (mark.type === 'link' && !isSafeLinkHref(mark.attrs?.href)) return false;
  }
  return (node.content ?? []).every(linksAreSafe);
}

/**
 * Shape validation for Tiptap JSON from the client: root 'doc', allow-listed node / mark types,
 * ≤ MAX_CONTENT_BYTES (UTF-8 JSON), nesting ≤ MAX_CONTENT_DEPTH, safe link protocols.
 * No HTML sanitising is needed — content is only ever rendered through Tiptap.
 */
export function validateWorkPageContent(
  input: unknown,
): { ok: true; doc: WorkPageDoc } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'not an object' };
  let json: string;
  try {
    json = JSON.stringify(input);
  } catch {
    return { ok: false, error: 'not serialisable' };
  }
  if (new TextEncoder().encode(json).length > MAX_CONTENT_BYTES) return { ok: false, error: 'too large' };
  if (maxDepth(input) > MAX_CONTENT_DEPTH) return { ok: false, error: 'too deep' };
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid shape' };
  if (parsed.data.type !== 'doc') return { ok: false, error: 'root must be doc' };
  if (!linksAreSafe(parsed.data)) return { ok: false, error: 'unsafe link' };
  return { ok: true, doc: parsed.data as WorkPageDoc };
}

// ---------------------------------------------------------------------------------------------
// Content helpers

function walk(node: WorkPageNode | null | undefined, visit: (n: WorkPageNode) => void) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node.content)) for (const child of node.content) walk(child, visit);
}

/** Ticked / total taskItem nodes anywhere in the doc (nested included). */
export function checklistProgress(doc: WorkPageNode | null | undefined): { done: number; total: number } {
  let done = 0;
  let total = 0;
  walk(doc, (n) => {
    if (n.type === 'taskItem') {
      total += 1;
      if (n.attrs?.checked === true) done += 1;
    }
  });
  return { done, total };
}

/** True when the doc contains any non-whitespace text. */
export function hasPageContent(doc: WorkPageNode | null | undefined): boolean {
  let found = false;
  walk(doc, (n) => {
    if (!found && n.type === 'text' && typeof n.text === 'string' && n.text.trim().length > 0) found = true;
  });
  return found;
}

function inlineText(node: WorkPageNode): string {
  return (node.content ?? [])
    .map((c) => (c.type === 'text' ? (c.text ?? '') : c.type === 'hardBreak' ? '\n' : inlineText(c)))
    .join('');
}

const TEXT_BLOCKS = new Set(['paragraph', 'heading']);

function blockLines(node: WorkPageNode): string[] {
  if (TEXT_BLOCKS.has(node.type)) return [inlineText(node)];
  if (node.type === 'horizontalRule') return ['---'];
  return (node.content ?? []).flatMap((child, index) => {
    const lines = blockLines(child);
    if (lines.length === 0) return lines;
    let prefix = '';
    if (child.type === 'taskItem') prefix = child.attrs?.checked === true ? '[x] ' : '[ ] ';
    else if (child.type === 'listItem' && node.type === 'bulletList') prefix = '- ';
    else if (child.type === 'listItem' && node.type === 'orderedList') prefix = `${index + 1}. `;
    return prefix ? [prefix + lines[0], ...lines.slice(1)] : lines;
  });
}

/** Plain-text rendering (blocks joined by "\n", task items prefixed "[x] " / "[ ] "). */
export function plainTextFromDoc(doc: WorkPageNode | null | undefined): string {
  if (!doc || typeof doc !== 'object') return '';
  return blockLines(doc)
    .join('\n')
    .replace(/^\s+$/gm, '')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Ownership, eligibility, conflicts

export type SubmissionMode = 'group' | 'individual';

/** Group to-do → one page per group (userId null); individual → one page per student. */
export function workPageOwnerKey(
  mode: SubmissionMode,
  groupId: string,
  userId: string,
): { groupId: string; userId: string | null } {
  return mode === 'group' ? { groupId, userId: null } : { groupId, userId };
}

export interface WorkPageRuleInput {
  latestStatus: SubmissionStatus;
  phaseViewable: boolean;
  /** Effective deadline (todo ?? phase), UTC instant; null = no deadline. */
  deadline: Date | null;
  now: Date;
}

export type WorkPageLock = 'locked' | 'approved' | 'deadline_passed';

export const WORK_PAGE_LOCK_MESSAGE: Record<WorkPageLock, string> = {
  locked: 'Phase นี้ยังไม่ปลดล็อค',
  approved: 'ผ่านแล้ว แก้ไขไม่ได้',
  deadline_passed: 'เลยกำหนดแก้ไขแล้ว',
};

function deadlinePassed(deadline: Date | null, now: Date): boolean {
  return deadline !== null && now.getTime() >= deadline.getTime();
}

/**
 * Why the page is read-only (null = editable):
 * - locked: phase not viewable
 * - approved: always locked
 * - deadline_passed: latest submission pending and now ≥ deadline (a pending page is editable
 *   until the deadline, or until the teacher reviews it when there is no deadline)
 * none / rejected stay editable at any time (late submissions are allowed but flagged).
 */
export function getWorkPageLock(input: WorkPageRuleInput): WorkPageLock | null {
  if (!input.phaseViewable) return 'locked';
  if (input.latestStatus === 'approved') return 'approved';
  if (input.latestStatus === 'pending' && deadlinePassed(input.deadline, input.now)) return 'deadline_passed';
  return null;
}

export function canEditWorkPage(input: WorkPageRuleInput): boolean {
  return getWorkPageLock(input) === null;
}

export type SubmitBlockReason =
  | 'locked'
  | 'already_submitted'
  | 'deadline_passed'
  | 'not_submitted'
  | 'file_required'
  | 'empty';

export const SUBMIT_BLOCK_MESSAGE: Record<SubmitBlockReason, string> = {
  locked: 'Phase นี้ยังไม่ปลดล็อค',
  already_submitted: 'ส่งงานแล้ว รอตรวจหรือผ่านแล้ว',
  deadline_passed: 'เลยกำหนดแก้ไขแล้ว',
  not_submitted: 'ยังไม่มีงานที่ส่งไว้ให้อัปเดต',
  file_required: 'งานนี้ต้องแนบไฟล์อย่างน้อย 1 ไฟล์',
  empty: 'เขียนรายละเอียดงานหรือแนบไฟล์ก่อนส่ง',
};

/** Shown when "ส่งงาน" is used while a submission is still pending (it must be updated instead). */
export const USE_UPDATE_MESSAGE = 'งานนี้ส่งแล้ว ใช้ "อัปเดตงานที่ส่ง"';

const EMPTY_TEXT_ONLY_MESSAGE = 'เขียนรายละเอียดงานก่อนส่ง';

/** submit = first round, resubmit = new round after ต้องแก้ไข, update = rewrite the pending round. */
export type SubmitMode = 'submit' | 'resubmit' | 'update';

export type SubmitEligibility =
  | { ok: true; mode: SubmitMode; late: boolean }
  | { ok: false; reason: SubmitBlockReason; message: string };

/**
 * Submit / update eligibility. Without `action` the mode is derived from the latest status
 * (none → submit, rejected → resubmit, pending → update). Server actions pass `action` so
 * submitWorkPage never creates a round while one is pending and updateSubmittedWorkPage only
 * rewrites a pending one. `late` = a new round after the deadline (never for an update).
 */
export function canSubmitWorkPage(
  input: WorkPageRuleInput & {
    fileRequirement: FileRequirement;
    fileCount: number;
    hasContent: boolean;
    action?: 'submit' | 'update';
  },
): SubmitEligibility {
  const block = (reason: SubmitBlockReason, message = SUBMIT_BLOCK_MESSAGE[reason]): SubmitEligibility => ({
    ok: false,
    reason,
    message,
  });
  if (!input.phaseViewable) return block('locked');
  if (input.latestStatus === 'approved') return block('already_submitted');
  if (input.latestStatus === 'pending' && deadlinePassed(input.deadline, input.now)) return block('deadline_passed');

  const mode: SubmitMode =
    input.latestStatus === 'pending' ? 'update' : input.latestStatus === 'rejected' ? 'resubmit' : 'submit';
  if (input.action === 'submit' && mode === 'update') return block('already_submitted', USE_UPDATE_MESSAGE);
  if (input.action === 'update' && mode !== 'update') return block('not_submitted');

  const late = mode !== 'update' && input.deadline !== null && input.now.getTime() > input.deadline.getTime();
  const ok: SubmitEligibility = { ok: true, mode, late };
  switch (input.fileRequirement) {
    case 'required':
      return input.fileCount >= 1 ? ok : block('file_required');
    case 'optional':
      return input.hasContent || input.fileCount >= 1 ? ok : block('empty');
    case 'none':
      return input.hasContent ? ok : block('empty', EMPTY_TEXT_ONLY_MESSAGE);
  }
}

/**
 * R2 keys that may be deleted: unique non-empty `oldKeys` that appear in none of the
 * `stillReferenced` sets (new snapshot, other submission_files rows, live work_page_files).
 */
export function computeOrphanFileKeys(oldKeys: readonly string[], ...stillReferenced: Iterable<string>[]): string[] {
  const keep = new Set<string>();
  for (const set of stillReferenced) for (const key of set) keep.add(key);
  return [...new Set(oldKeys.filter((k) => typeof k === 'string' && k.length > 0 && !keep.has(k)))];
}

/**
 * Optimistic-concurrency rule for saves. `baseUpdatedAt` is the server version (ISO, ms) the
 * client last loaded; null = the client never saw a page.
 * - no base: conflict only when someone already wrote real content
 * - base: conflict whenever the server version differs from the base
 */
export function isSaveConflict(
  baseUpdatedAt: string | null,
  server: { updatedAt: Date; content: WorkPageNode | null } | null,
): boolean {
  if (!server) return false;
  if (baseUpdatedAt === null) return hasPageContent(server.content);
  const base = Date.parse(baseUpdatedAt);
  if (Number.isNaN(base)) return true;
  return server.updatedAt.getTime() !== base;
}
