---
phase: quick-261004-fgj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/schema/comments.ts
  - src/db/schema/relations.ts
  - src/db/__tests__/schema.test.ts
  - src/db/migrations/2026-10-04-comment-threads.ts
  - src/lib/comment-thread.ts
  - src/lib/__tests__/comment-thread.test.ts
  - src/lib/user-directory.ts
  - src/server/work-page-access.ts
  - src/server/comment-access.ts
  - src/server/actions/comment.ts
  - src/server/queries/comment.ts
  - src/server/__tests__/authz-coverage.test.ts
  - src/components/comment/comment-thread.tsx
  - src/components/comment/comment-message.tsx
  - src/components/comment/comment-composer.tsx
  - src/components/comment/comment-body.tsx
  - src/components/comment/comment-thread-section.tsx
  - src/components/student/student-todo-view.tsx
  - src/app/(dashboard)/todo/[todoId]/page.tsx
  - src/components/student/node-path.tsx
  - src/components/student/node-path-desktop.tsx
  - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
  - src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx
  - src/components/phase/group-phase-board.tsx
  - src/components/todo/todo-list.tsx
  - src/components/todo/todo-item.tsx
  - src/server/queries/submission.ts
  - src/server/queries/work-page.ts
  - src/server/actions/work-page.ts
autonomous: true
requirements: [QUICK-261004-fgj]

must_haves:
  truths:
    - "A student opening a to-do sees a 'ความคิดเห็น (n)' thread card under the work page and history, and can post a plain-text message (1-2000 chars) with Cmd/Ctrl+Enter or the 'ส่ง' button"
    - "A classroom teacher on /todo/[todoId] sees the same thread for that group (group to-do) or picks a student (individual to-do) and can post; teacher messages are tinted blue-soft with a blue 'ครู' badge"
    - "Students of another group, or another student on an individual to-do, cannot read or post in a thread: every comment action throws for them"
    - "Students never receive a classmate's or teacher's email: comment author names come from a public name that never falls back to email"
    - "A comment body containing <script> or javascript: renders as literal text; only http(s)/www URLs become links (rel=noopener noreferrer, target=_blank); no dangerouslySetInnerHTML"
    - "Authors can edit their own comment within 15 minutes ('แก้ไขแล้ว' marker); authors or classroom editors can soft-delete ('ข้อความถูกลบ' placeholder, no body sent to clients)"
    - "Comments written after submission n carry a 'ส่งครั้งที่ n' tag, and the thread persists across resubmissions because it is attached to the work page"
    - "The student home node path shows a small comment dot on to-dos with teacher comments the student has not seen; opening the to-do clears it"
    - "Each to-do row on the teacher group page shows a comment-count chip linking to /todo/<id>#comments when the count is > 0"
    - "'คำแนะนำจากผู้ตรวจ' (getSubmissionHistory.reviewerComment) is the latest non-deleted teacher comment tied to that submission"
    - "The migration script only runs with --dry-run / --apply; the executor ran --dry-run only and the output ended with 'DRY RUN — rolled back'"
  artifacts:
    - path: "src/db/migrations/2026-10-04-comment-threads.ts"
      provides: "Additive, idempotent migration: comments.work_page_id/author_role/edited_at/deleted_at, submission_id DROP NOT NULL, indexes, comment_reads table"
      contains: "DRY RUN — rolled back"
    - path: "src/lib/comment-thread.ts"
      provides: "Pure helpers: normalizeCommentBody, linkifySegments, canEditComment, canDeleteComment, roundForSubmission, resolveThreadOwner, formatCommentTime, hasUnreadTeacherComments, publicDisplayName"
    - path: "src/server/comment-access.ts"
      provides: "resolveCommentThread(todoId, userId, { groupId?, studentId? }), built on authorizeTodoViewer"
      exports: ["resolveCommentThread"]
    - path: "src/server/actions/comment.ts"
      provides: "postComment, editComment, deleteComment, listComments, markCommentsSeen"
      exports: ["postComment", "editComment", "deleteComment", "listComments", "markCommentsSeen"]
    - path: "src/components/comment/comment-thread.tsx"
      provides: "Client thread card with messages, composer, 30 s visible-only polling, empty/loading/error states"
  key_links:
    - from: "src/server/actions/comment.ts"
      to: "src/server/comment-access.ts"
      via: "every export calls resolveCommentThread("
      pattern: "resolveCommentThread\\("
    - from: "src/server/comment-access.ts"
      to: "src/server/work-page-access.ts"
      via: "authorizeTodoViewer + findPage/getOrCreatePage"
      pattern: "authorizeTodoViewer\\("
    - from: "src/components/comment/comment-thread.tsx"
      to: "src/server/actions/comment.ts"
      via: "listComments polling, postComment/editComment/deleteComment, markCommentsSeen"
      pattern: "listComments\\("
    - from: "src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx"
      to: "src/server/queries/comment.ts"
      via: "getUnreadTeacherCommentTodoIds -> NodePath unreadTodoIds"
      pattern: "getUnreadTeacherCommentTodoIds"
    - from: "src/server/queries/submission.ts"
      to: "comments.author_role"
      via: "reviewerComment = latest teacher, non-deleted comment per submission"
      pattern: "authorRole"
---

<objective>
Add one discussion thread at the bottom of each to-do, scoped like the work page: per (to-do, group) for group to-dos and per (to-do, student) for individual ones. Classroom teachers (editors) and the members of that thread's group (or that student) can read and post at any time. The existing 0-row `comments` table is evolved additively and attached to `work_pages`. A new `comment_reads` table drives the student's unread dot. The teacher group page shows per-to-do comment counts.

Purpose: teachers and students can talk about a task in context, before and after submitting, and Phase 4 review dialogs can later post their คำแนะนำ as a teacher comment.
Output: a dry-run-verified migration, pure helpers with tests, comment server actions and queries with static authz coverage, a Cocoon thread UI on the student and teacher to-do pages, unread dots, and count chips.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./AGENTS.md
@.planning/quick/261004-fgj-task-discussion-thread-for-teachers-and-/261004-fgj-CONTEXT.md
@.planning/quick/261004-01i-notion-like-work-page-submissions-with-s/261004-01i-SUMMARY.md
@src/db/migrations/2026-10-04-work-pages.ts
@src/server/work-page-access.ts
@src/server/__tests__/authz-coverage.test.ts

<hard_safety_rules>
- DATABASE_URL is shared with the LIVE site. Run the migration with `--dry-run` ONLY. Never run `--apply`, `drizzle-kit push/generate/migrate`, seeds, or any script or ad-hoc query that writes to the DB. Do not start the dev server against the DB to click through posting.
- Lint baseline: 10 errors / 5 warnings (use-mobile.ts, auth.test.ts). Add none.
- Next.js here is 16.x with breaking changes (AGENTS.md). Before using `searchParams`, `Suspense` streaming, or server-action patterns you are unsure about, read the relevant guide in `node_modules/next/dist/docs/`.
- Do NOT implement 261004-03i (edit after submit before the deadline). To avoid conflicts with it: comment permissions must NOT depend on `canEditWorkPage`, `latestStatus`, or deadlines (03i says students can still comment when the page is locked). Add the thread to the student to-do page as one self-contained block, keeping edits to `StudentTodoScreen` minimal.
</hard_safety_rules>

<interfaces>
Existing code to build on. Use these directly.

src/server/work-page-access.ts:
```ts
export type WorkPageOwner = { groupId: string; userId: string | null };
export async function authorizeTodoViewer(todoId: string, userId: string):
  Promise<{ kind: 'editor'; todo; classroomId } | { kind: 'student'; todo; classroomId; groupId }>;
  // todo is loaded with { group, phase }; throws 'To-do not found or not authorized' otherwise
export async function findPage(tx: DbLike, todoId: string, owner: WorkPageOwner, opts?: { lock?: boolean }): Promise<WorkPageRow | null>;
export async function getOrCreatePage(tx: DbLike, todoId: string, owner: WorkPageOwner, userId: string, opts?: { lock?: boolean }): Promise<WorkPageRow>;
```
src/lib/work-page.ts: `workPageOwnerKey(mode: 'group'|'individual', groupId, userId) -> WorkPageOwner` (group -> userId null).
src/server/queries/submission.ts: `isInSubmissionScope(row:{groupId, submittedBy}, mode, groupId, userId)`; `getSubmissionHistory` currently does
`with: { comments: { orderBy: [desc(comments.createdAt)], limit: 1, columns: { content: true } } }` -> `reviewerComment`.
src/lib/action-result.ts: `ActionResult<T>`, `actionError(msg)`. Expected errors are returned; authz failures throw.
src/lib/user-directory.ts: `getUserDirectory(ids) -> Map<id, { name, email, imageUrl }>`. NOTE: `name` falls back to email, so it is unsafe for students.
src/lib/format.ts: `formatSubmissionDate(d)` -> "18 ต.ค. 13.59" (Asia/Bangkok).
src/components/cocoon/member-identity.tsx: `MemberAvatar({ name, imageUrl, className })`.
src/components/cocoon/ui.ts: `CARD`, `CARD_TITLE`, `CARD_META`, `TEXTAREA`, `BTN_INFO`, `BTN_TERTIARY`; ConfirmDialog in src/components/cocoon/confirm-dialog.tsx.
Current comments table (0 rows): id, submission_id NOT NULL FK submissions cascade, user_id, content, created_at, updated_at.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migration (dry-run), pure comment helpers + tests, comment access/actions/queries + authz coverage</name>
  <files>src/db/schema/comments.ts, src/db/schema/relations.ts, src/db/__tests__/schema.test.ts, src/db/migrations/2026-10-04-comment-threads.ts, src/lib/comment-thread.ts, src/lib/__tests__/comment-thread.test.ts, src/lib/user-directory.ts, src/server/work-page-access.ts, src/server/comment-access.ts, src/server/actions/comment.ts, src/server/queries/comment.ts, src/server/__tests__/authz-coverage.test.ts</files>
  <behavior>
    src/lib/__tests__/comment-thread.test.ts (write first, RED, then GREEN):
    - normalizeCommentBody: converts \r\n to \n, strips control characters except \n and \t, trims; "" or whitespace-only -> { ok:false }; 2001 chars -> { ok:false }; 2000 chars -> ok; Thai text and newlines are kept.
    - linkifySegments("ดู https://a.com/x?y=1. ต่อ") -> [text "ดู ", link {href "https://a.com/x?y=1", label same}, text ". ต่อ"] (trailing .,!?)]'" are not part of the link); "www.b.org" -> href "https://www.b.org"; "javascript:alert(1)", "data:text/html,..", "<script>x</script>" -> one text segment with the exact input; joining every segment's text/label reproduces the input.
    - canEditComment: author && !deleted && now - createdAt <= 15 min -> true; at 15 min + 1 s, non-author, or deleted -> false.
    - canDeleteComment: author or viewerIsEditor, and not deleted.
    - roundForSubmission(submissionId, scopedIdsOldestFirst) -> 1-based index, or null for null/unknown id.
    - resolveThreadOwner: student viewer on a group to-do -> {groupId: todoGroupId, userId: null}; student on an individual to-do -> {groupId, userId: viewer}; a student passing groupId/studentId for another thread -> error 'forbidden'; editor on a group to-do with groupId omitted or equal -> ok, mismatch -> 'forbidden'; editor on an individual to-do without studentId -> 'student_required'; with studentId and isKnownStudent=false -> 'forbidden'.
    - formatCommentTime(createdAt, now): < 1 min "เมื่อสักครู่", < 60 min "n นาทีที่แล้ว", < 24 h "n ชม.ที่แล้ว", otherwise formatSubmissionDate output "18 ต.ค. 13.59".
    - hasUnreadTeacherComments(comments[{authorRole, createdAt, deletedAt}], lastSeenAt|null): true only for a non-deleted teacher comment newer than lastSeenAt (null lastSeenAt = never seen); student-only comments -> false.
    - publicDisplayName({firstName,lastName,username}) never returns an email; empty -> 'ไม่ระบุชื่อ'.
    Schema test: comments has workPageId, authorRole, editedAt, deletedAt; commentReads and commentReadsRelations are exported.
  </behavior>
  <action>
    1. **Schema** (`src/db/schema/comments.ts`). Make `submissionId` nullable, keeping the FK to submissions with cascade unchanged. Add:
       - `workPageId: text('work_page_id').references(() => workPages.id, { onDelete: 'cascade' })` (nullable in the DB, required by code)
       - `authorRole: text('author_role', { enum: ['teacher','student'] }).notNull().default('student')`
       - `editedAt`, `deletedAt` timestamps (nullable)
       - indexes `comments_work_page_created_idx (work_page_id, created_at)` and `comments_submission_id_idx`
       Add a `commentReads` table `comment_reads` with: id text PK (createId), user_id text NOT NULL, work_page_id NOT NULL FK work_pages cascade, last_seen_at timestamp NOT NULL defaultNow, and uniqueIndex `comment_reads_user_page_unique (user_id, work_page_id)`. Keep the DB column `content` as the body.
       `authorRole` is an extra additive column (Claude's discretion). It is stored at write time: editor -> 'teacher', otherwise 'student'. The role badge, the unread dot ("comments from a teacher") and reviewerComment all need it, and recomputing roles at read time breaks when teachers leave the classroom.
       Relations: commentsRelations gains `workPage: one(workPages)`; workPagesRelations gains `comments: many(comments)`; add commentReadsRelations. Extend schema.test.ts.
    2. **Migration** `src/db/migrations/2026-10-04-comment-threads.ts`. Copy the structure of 2026-10-04-work-pages.ts: dotenv, Neon Pool + ws, USAGE with exit 1 when there is no flag, ONE transaction, `SET LOCAL lock_timeout='5s'`, `statement_timeout='60s'`, BEFORE/AFTER printSchema for comments + comment_reads (columns, indexes, FKs), and COMMIT only on `--apply`.
       - **Idempotent:** when every new column, the comment_reads table, the unique index, and nullable submission_id are already in place, print "already migrated" and exit 0.
       - **If `comments` does not exist**, CREATE it with the full new definition.
       - **If it exists**, run:
         - `ADD COLUMN IF NOT EXISTS` work_page_id text; author_role text NOT NULL DEFAULT 'student'; edited_at timestamp; deleted_at timestamp
         - `ALTER COLUMN submission_id DROP NOT NULL`
         - FK `comments_work_page_id_work_pages_id_fk` ON DELETE CASCADE, added only when it is missing from pg_constraint
         - `CREATE INDEX IF NOT EXISTS` for both indexes
       - Then `CREATE TABLE IF NOT EXISTS comment_reads` with FK `comment_reads_work_page_id_work_pages_id_fk` cascade, plus the unique index.
       - Use Drizzle-style constraint names so a later push shows no diff.
       - Assert that counts of comments, work_pages and submissions are unchanged, otherwise throw.
       - Header comment: apply BEFORE deploying (the new code selects the new columns), never drizzle-kit push.
       - Run `npx tsx src/db/migrations/2026-10-04-comment-threads.ts --dry-run` and the no-flag case. Paste the exact dry-run output into the SUMMARY.
    3. **Pure helpers** `src/lib/comment-thread.ts`, per the behavior block. Export:
       - constants: `COMMENT_MAX = 2000`, `COMMENT_EDIT_WINDOW_MS = 15*60*1000`, `COMMENT_POLL_MS = 30_000`
       - type `CommentView = { id; authorName; authorImageUrl; authorRole; isMine; body: string|null; createdAt: string; editedAt: string|null; deleted: boolean; round: number|null; canEdit; canDelete }`
       - `toCommentView(row, ctx)`, which sets body to null when deleted
       Plain module with no server-only imports, so client components can import the types and linkify. `formatCommentTime` reuses `formatSubmissionDate`.
    4. **Public names** (`src/lib/user-directory.ts`): add `publicName` to `UserDisplay`, using `publicDisplayName` (fullName || username || 'ไม่ระบุชื่อ', never email). Comment DTOs use only `publicName` + `imageUrl` for every viewer.
    5. **`getOrCreatePage`**: add an optional `opts.markAuthor?: boolean` (default true). When false, insert with `updatedBy: null`, so a page created only to hold a comment does not show the commenter as the page's last editor. Existing callers are unchanged.
    6. **`src/server/comment-access.ts`** (plain module): `resolveCommentThread(todoId, userId, { groupId?, studentId? } = {})`.
       - Calls `authorizeTodoViewer`, which throws for outsiders.
       - Students are rejected when the to-do or its phase is archived.
       - For an editor with an individual to-do, `isKnownStudent` = studentId is a group_members row of todo.groupId OR has a work page/submission for this to-do.
       - Calls the pure `resolveThreadOwner` and throws on 'forbidden'.
       - Returns `{ viewerKind, isEditor, todo, owner, page: await findPage(db, todoId, owner) }`, or a `{ needsStudent: true }` result for 'student_required'.
    7. **`src/server/actions/comment.ts`** ('use server'). Every export first calls `getCurrentUserId()` and then `resolveCommentThread(`. Validate with zod and return `ActionResult`.
       - `listComments({ todoId, groupId?, studentId? })` -> `{ comments: CommentView[], count, nowIso }`. Empty when there is no page yet; never creates one. Returns the latest 200, oldest first.
       - `postComment({ todoId, groupId?, studentId?, body })`: normalize the body; in `db.transaction`, `getOrCreatePage(tx, ..., { markAuthor: false })`, set `submissionId` = latest in-scope submission id (desc createdAt, filtered with `isInSubmissionScope`, else null), set `authorRole` from viewerKind, insert. Then return the refreshed list.
       - `editComment({ commentId, body })`: load the comment with its work page, then call `resolveCommentThread(page.todoId, userId, ownerHints from page)`. Also verify the comment's page equals the resolved thread page. Check `canEditComment`, then set content + editedAt.
       - `deleteComment({ commentId })`: same loading and verification, check `canDeleteComment`, then set deletedAt.
       - `markCommentsSeen({ todoId, groupId?, studentId? })`: when the page exists, upsert comment_reads (onConflictDoUpdate on user_id+work_page_id, last_seen_at = now()).
       Expected errors are Thai strings: 'ข้อความต้องมี 1–2000 ตัวอักษร', 'แก้ไขได้ภายใน 15 นาทีหลังส่ง', 'ไม่พบความคิดเห็น'.
    8. **`src/server/queries/comment.ts`**: `getCommentThread(todoId, userId, opts)` for server-rendered initial data. It has the same shape as listComments and shares one internal builder exported from the same module (import it in the action; do not duplicate the logic).
    9. **authz-coverage.test.ts**: add a describe for comment.ts. It asserts the export set equals the 5 actions, each body matches `/resolveCommentThread\(/`, and postComment uses `db.transaction(`.
  </action>
  <verify>
    <automated>npx vitest run src/lib/__tests__/comment-thread.test.ts src/db/__tests__/schema.test.ts src/server/__tests__/authz-coverage.test.ts && npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && npx tsx src/db/migrations/2026-10-04-comment-threads.ts --dry-run 2>&1 | tail -20</automated>
  </verify>
  <done>Helper, schema and authz tests pass (RED commit, then GREEN). tsc is clean. Lint is at 10 errors / 5 warnings. The full suite passes. The dry-run ends with "DRY RUN — rolled back" with unchanged counts, and running with no flag exits 1. No --apply was run.</done>
</task>

<task type="auto">
  <name>Task 2: Thread UI on the student and teacher to-do pages</name>
  <files>src/components/comment/comment-thread.tsx, src/components/comment/comment-message.tsx, src/components/comment/comment-composer.tsx, src/components/comment/comment-body.tsx, src/components/comment/comment-thread-section.tsx, src/components/student/student-todo-view.tsx, src/app/(dashboard)/todo/[todoId]/page.tsx</files>
  <action>
    1. **`comment-body.tsx`**: renders `linkifySegments(body)` as React text nodes and `<a href target="_blank" rel="noopener noreferrer" className="underline text-cocoon-blue break-all">`, inside `whitespace-pre-wrap break-words`. Never use `dangerouslySetInnerHTML`.
    2. **`comment-message.tsx`**: chat-like row with:
       - `MemberAvatar` (size-8), bold name, role badge (teacher: `bg-cocoon-blue text-white` "ครู"; student: `border border-cocoon-line text-cocoon-subtle` "นักเรียน")
       - time from `formatCommentTime(createdAt, now)`, with a `title` attribute holding the full date
       - a "ส่งครั้งที่ n" tag when `round` is set, and "แก้ไขแล้ว" when `editedAt` is set
       Bubble colors: teacher `bg-cocoon-blue-soft`, student `bg-white border border-[#f1ece5]`, rounded-[12px]. A deleted comment shows italic muted "ข้อความถูกลบ".
       When canEdit/canDelete, show an `OverflowMenu` (แก้ไข / ลบ). Edit happens inline: textarea + "บันทึก" / "ยกเลิก". Delete goes through the shared `ConfirmDialog` ("ลบความคิดเห็นนี้?").
    3. **`comment-composer.tsx`**: an auto-growing textarea using the TEXTAREA style, sized via scrollHeight with a max of about 8 lines.
       - Enter inserts a newline. Cmd/Ctrl+Enter sends. The "ส่ง" button uses BTN_INFO with a Send icon.
       - Show a counter when the text is over 1800 characters. Disable when empty or busy. Placeholder "เขียนความคิดเห็น…".
       - Keep the text when the post fails, and show the error with sonner toast.
    4. **`comment-thread.tsx`** ('use client'): props `{ todoId, groupId?, studentId?, initial: { comments, nowIso } | null, initialError?: string, viewerIsStudent }`.
       - Section with `id="comments"`, CARD, title "ความคิดเห็น (n)" where n counts non-deleted comments. Messages are in a list with aria-live="polite", followed by the composer.
       - **Empty state:** "ยังไม่มีความคิดเห็น เริ่มคุยกับครูหรือเพื่อนในกลุ่มได้เลย" (teacher wording: "…เริ่มคุยกับนักเรียนได้เลย").
       - **Error state:** a message plus a "ลองอีกครั้ง" button that calls listComments.
       - **Polling:** while `document.visibilityState === 'visible'`, call `listComments` every `COMMENT_POLL_MS` and also on visibilitychange to visible. Update local state only; keep the composer draft; clear the interval on unmount.
       - Deliberately poll listComments instead of `router.refresh()`. A full refresh re-renders the autosaving Tiptap work page on the same screen and could disturb typing or conflict handling. Polling interval is Claude's discretion per CONTEXT. Record this as a deviation in the SUMMARY.
       - After post, edit or delete, replace state with the returned/refetched list and scroll to the newest message.
       - Students call `markCommentsSeen` on mount and after any refresh that brings new comments, and only while the page is visible.
       - Render times against `nowIso` from the server for the first render (avoids a hydration mismatch). After that, use a client `now` updated each poll.
    5. **`comment-thread-section.tsx`**: an async server component that calls `getCommentThread` in try/catch (errors become `initialError`) and renders `<CommentThread>`. Also export a `CommentThreadSkeleton` (CARD with 2–3 pulse rows) for use as the `<Suspense>` fallback, which is the loading state.
    6. **Student page** (`student-todo-view.tsx`): pass `todoId` into the screen. After the existing grid (work page + history), append one block: `<div className="mt-4 px-[33px] lg:mt-8 lg:max-w-[664px] lg:px-0 max-xl:lg:max-w-none"><Suspense fallback={<CommentThreadSkeleton/>}><CommentThreadSection todoId=… viewer="student"/></Suspense></div>`, so it sits under the work page and history. Leave the rest of StudentTodoScreen untouched (03i will edit it).
       Check that the sticky mobile submit bar does not overlap the composer. If it does, add bottom padding (pb) to the block.
    7. **Teacher page** (`todo/[todoId]/page.tsx`): only when `workView` exists (the viewer is a classroom editor), render the thread under "งานของนักเรียน".
       - **Group to-do:** `groupId = todo.group.id`.
       - **Individual to-do:** read `searchParams` (a Promise in this Next version; check node_modules/next/dist/docs) for `student`. Render a row of Link chips (one per `workView.entries` entry: ownerLabel, key = student id, `?student=<id>#comments`) to choose the thread. Default to the first entry. When there are no entries, show "ยังไม่มีนักเรียนในกลุ่มนี้".
       - Heading "ความคิดเห็น".
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && ! grep -rn "dangerouslySetInnerHTML" src/components/comment && grep -rn "listComments(" src/components/comment/comment-thread.tsx && ! grep -rn "router.refresh" src/components/comment</automated>
  </verify>
  <done>Both to-do pages render the thread inside Suspense with skeleton, empty and error states. The composer supports Cmd/Ctrl+Enter, edit/delete menus appear only when allowed, and teacher individual to-dos have a student switcher. There is no dangerouslySetInnerHTML. tsc is clean, lint stays at baseline, and tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Unread dots, teacher count chips, reviewerComment compatibility, public names, regression + build</name>
  <files>src/server/queries/comment.ts, src/components/student/node-path.tsx, src/components/student/node-path-desktop.tsx, src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx, src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx, src/components/phase/group-phase-board.tsx, src/components/todo/todo-list.tsx, src/components/todo/todo-item.tsx, src/server/queries/submission.ts, src/server/queries/work-page.ts, src/server/actions/work-page.ts</files>
  <action>
    1. **`getUnreadTeacherCommentTodoIds(groupId, userId, todoList: {id, submissionMode}[]) -> string[]`** in queries/comment.ts.
       - Return [] when the user is not a group member.
       - Load the student's pages for these to-dos in one query: group to-dos `group_id = groupId AND user_id IS NULL`, individual to-dos `user_id = userId`.
       - Then load their non-deleted teacher comments (created_at only) and the user's comment_reads rows.
       - Decide with the pure `hasUnreadTeacherComments`. Use a fixed number of queries, not one per to-do.
    2. **`getGroupCommentCounts(groupId, userId) -> Record<todoId, number>`**: first `assertGroupEditor(groupId, userId)` (throws), then one grouped count of non-deleted comments joined through work_pages for the group's to-dos.
    3. **Student group page:** fetch the unread ids next to `getTodoSubmissionStatuses`, and pass `unreadTodoIds` to `NodePath` and `NodePathDesktop`.
       In both, render a small dot at the node's top-right for those ids: absolute, size about 16 px, `bg-cocoon-blue` with a white ring, lucide `MessageCircle` at size 10 in white. Add `aria-label`/sr-only "มีความคิดเห็นใหม่จากครู". Do not change node status, lock or current logic.
    4. **Teacher group page:** call `getGroupCommentCounts` (wrap in `.catch(() => ({}))`) and pass `commentCounts` through GroupPhaseBoard -> TodoList -> TodoItem.
       TodoItem shows a chip next to the mode/file badges when count > 0: a `Link href={/todo/${id}#comments}` with `MessageCircle` size 12 + count, styled `h-[20px] rounded-full bg-cocoon-blue-soft px-2 text-[11px] font-bold text-cocoon-blue`, aria-label "ความคิดเห็น n รายการ". Stop click propagation so it does not toggle the row or drag.
    5. **reviewerComment** (queries/submission.ts): the nested `comments` relation now uses `where: and(eq(comments.authorRole, 'teacher'), isNull(comments.deletedAt))`, ordered by desc createdAt, limit 1. `SubmissionHistoryEntry` is unchanged, so `ReviewerNoteCard` keeps reading `latest.reviewerComment` for the latest rejected submission. Add a one-line comment saying that Phase 4 review dialogs must post via the comment insert path with `submissionId` = the reviewed submission and `authorRole = 'teacher'`.
    6. **Privacy fix on the same student page:** in `getStudentWorkPage` (queries/work-page.ts) and `toConflict` (actions/work-page.ts), use `publicName` instead of `name` for `updatedByName`, because `name` can fall back to a classmate's email. Teacher-only views keep `name`.
    7. **Regression sweep.** Record each result in the SUMMARY:
       - (a) grep proves every comment.ts export calls `resolveCommentThread(`.
       - (b) A student of group B calling listComments/postComment for group A's to-do is rejected via authorizeTodoViewer, and a student passing another studentId gets 'forbidden' (unit-tested in resolveThreadOwner).
       - (c) Grep the comment DTO builder: no `email` field reaches CommentView.
       - (d) `getTodoSubmissionStatuses` and the work page conflict tests are unchanged and passing.
       - (e) Deleting a to-do cascades to work_pages -> comments/comment_reads (schema FK review only).
       - (f) No comment permission references canEditWorkPage, latestStatus or deadline (03i compatibility).
       Then run `npm run build`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -15 && grep -n "authorRole" src/server/queries/submission.ts && ! grep -n "email" src/lib/comment-thread.ts src/server/actions/comment.ts</automated>
  </verify>
  <done>The node path shows unread teacher-comment dots, and teacher to-do rows show count chips linking to #comments. reviewerComment reads the latest non-deleted teacher comment per submission. Work page names shown to students use publicName. tsc is clean, lint is at 10 errors / 5 warnings, all tests pass, and `npm run build` succeeds. The SUMMARY lists the regression sweep, the exact dry-run output, and the apply-then-deploy steps for the orchestrator.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` is clean. `npx eslint .` stays at 10 errors / 5 warnings. `npm test` passes, including new comment-thread, schema and authz-coverage tests. `npm run build` succeeds.
- `npx tsx src/db/migrations/2026-10-04-comment-threads.ts --dry-run` ends with "DRY RUN — rolled back" and unchanged counts. Running with no flag exits 1. `--apply` was never run.
- `grep -rn dangerouslySetInnerHTML src/components/comment` is empty.
- Orchestrator (not the executor) afterwards: dry-run -> `--apply` -> deploy immediately. The new code selects comments.author_role/work_page_id/deleted_at and comment_reads; the old code ignores them.
</verification>

<success_criteria>
- One thread per (to-do, group) or (to-do, student), attached to the work page and surviving resubmissions, visible only to classroom editors plus that group or student.
- Post/edit (author, 15 min)/soft-delete (author or editor)/list/mark-seen actions are all gated by resolveCommentThread, with static test coverage.
- Safe plain-text rendering with autolinks; no emails reach students.
- Student unread dot, teacher count chips, and Phase 4-compatible reviewerComment.
- Additive migration verified by dry-run only.
</success_criteria>

<output>
After completion, create `.planning/quick/261004-fgj-task-discussion-thread-for-teachers-and-/261004-fgj-SUMMARY.md` with the commits, the verification table, the exact migration dry-run output, the regression sweep, deviations (author_role column, listComments polling instead of router.refresh, publicName fix) and the orchestrator apply/deploy steps.
</output>
