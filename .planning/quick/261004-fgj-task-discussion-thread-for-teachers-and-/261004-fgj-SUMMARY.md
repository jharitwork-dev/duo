---
phase: quick-261004-fgj
plan: 01
subsystem: comments / work pages / teacher group page
tags: [comments, discussion-thread, authz, migration, privacy, cocoon-ui]
requires: [261004-01i work pages (work_pages table, authorizeTodoViewer, getOrCreatePage)]
provides:
  - comments thread columns (work_page_id, author_role, edited_at, deleted_at) + comment_reads
  - resolveCommentThread (src/server/comment-access.ts)
  - postComment / editComment / deleteComment / listComments / markCommentsSeen
  - CommentThread UI (student + teacher to-do pages), unread dots, teacher count chips
  - teacher to-do rows link to /todo/<id> with "ดูงาน" + review status pill (orchestrator request)
affects: [getSubmissionHistory.reviewerComment, student work page updatedByName, teacher TodoItem row layout]
tech-stack:
  added: []
  patterns:
    - thread = work page owner key (per (to-do, group) or (to-do, student))
    - author_role stored at write time
    - visible-only polling of a server action instead of a full page re-render
key-files:
  created:
    - src/db/migrations/2026-10-04-comment-threads.ts
    - src/lib/comment-thread.ts
    - src/lib/__tests__/comment-thread.test.ts
    - src/lib/todo-review-status.ts
    - src/lib/__tests__/todo-review-status.test.ts
    - src/server/comment-access.ts
    - src/server/actions/comment.ts
    - src/server/queries/comment.ts
    - src/components/comment/comment-thread.tsx
    - src/components/comment/comment-message.tsx
    - src/components/comment/comment-composer.tsx
    - src/components/comment/comment-body.tsx
    - src/components/comment/comment-thread-section.tsx
  modified:
    - src/db/schema/comments.ts
    - src/db/schema/relations.ts
    - src/db/__tests__/schema.test.ts
    - src/lib/user-directory.ts
    - src/server/work-page-access.ts
    - src/server/__tests__/authz-coverage.test.ts
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
decisions:
  - "comments.author_role stored at write time (editor -> 'teacher'); badges, unread dot and reviewerComment depend on it"
  - "Thread refresh = 30 s visible-only listComments polling, not router.refresh() (protects the autosaving Tiptap editor)"
  - "Student-visible names use UserDisplay.publicName (full name -> username -> 'ไม่ระบุชื่อ', never email)"
  - "Comment permissions are independent of canEditWorkPage / submission status / deadlines (261004-03i compatible)"
  - "Teacher to-do row: title + 'ดูงาน' link to /todo/<id>; edit form moved to the chevron toggle"
metrics:
  duration: ~60min
  completed: 2026-10-04
  tasks: 3
  commits: 6
---

# Quick 261004-fgj: Task discussion thread for teachers and students — Summary

There is now one discussion thread per to-do. It is attached to the work page, so there is one thread per (to-do, group) for group to-dos and per (to-do, student) for individual ones. Classroom teachers and the thread's own group or student can post plain text with safe autolinks. Authors can edit for 15 minutes; authors and teachers can soft-delete. Students get an unread-teacher-comment dot on the node path. Teacher to-do rows now link to the student's work, with a "ดูงาน" button, a status pill and a comment-count chip. The migration is additive and was verified by **dry-run only**.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 270731b | test(quick-261004-fgj): add failing tests for comment thread helpers and schema (RED) |
| 2 | bd573a5 | feat(quick-261004-fgj): comment thread helpers and schema (GREEN) |
| 3 | 87ad294 | feat(quick-261004-fgj): comment thread migration, access, actions and queries |
| 4 | a99d042 | feat(quick-261004-fgj): discussion thread UI on student and teacher to-do pages |
| 5 | 632abf2 | feat(quick-261004-fgj): unread teacher-comment dots and public names on student views |
| 6 | 28d1c2c | feat(quick-261004-fgj): teacher to-do rows link to student work; comment chips; reviewerComment |

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean (no output) |
| `npx eslint .` | 15 problems (10 errors, 5 warnings) — same as the baseline (use-mobile.ts, auth.test.ts, etc.); none added |
| `npm test` | 15 files, **289 passed** (baseline 241; +44 comment-thread/schema/authz tests, +4 todo-review-status) |
| `npm run build` | success (all routes compiled; `/todo/[todoId]`, both group pages dynamic) |
| Migration with no flag | prints usage, **exit 1** |
| Migration `--dry-run` | ends with `DRY RUN — rolled back`, counts unchanged, exit 0 |
| `grep -rn dangerouslySetInnerHTML src/components/comment` | empty |
| `grep -rn router.refresh src/components/comment` | empty |
| `grep -n email src/lib/comment-thread.ts src/server/actions/comment.ts` | empty |
| `grep -n authorRole src/server/queries/submission.ts` | matches (reviewerComment filter) |
| `--apply` / drizzle-kit / seeds / DB writes | **never run** |

## Migration dry-run output (exact)

```
MODE: DRY RUN (will roll back)
comments table exists: yes (evolve in place)
BEFORE: comments=0 work_pages=1 submissions=1
BEFORE columns (table.column type nullable default):
  comments.id text NOT NULL
  comments.submission_id text NOT NULL
  comments.user_id text NOT NULL
  comments.content text NOT NULL
  comments.created_at timestamp without time zone NOT NULL default now()
  comments.updated_at timestamp without time zone NOT NULL default now()
BEFORE indexes:
  comments_pkey: CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id)
BEFORE foreign keys:
  comments.comments_submission_id_submissions_id_fk: FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
AFTER: comments=0 work_pages=1 submissions=1
AFTER columns (table.column type nullable default):
  comment_reads.id text NOT NULL
  comment_reads.user_id text NOT NULL
  comment_reads.work_page_id text NOT NULL
  comment_reads.last_seen_at timestamp without time zone NOT NULL default now()
  comments.id text NOT NULL
  comments.submission_id text NULL
  comments.user_id text NOT NULL
  comments.content text NOT NULL
  comments.created_at timestamp without time zone NOT NULL default now()
  comments.updated_at timestamp without time zone NOT NULL default now()
  comments.work_page_id text NULL
  comments.author_role text NOT NULL default 'student'::text
  comments.edited_at timestamp without time zone NULL
  comments.deleted_at timestamp without time zone NULL
AFTER indexes:
  comment_reads_pkey: CREATE UNIQUE INDEX comment_reads_pkey ON public.comment_reads USING btree (id)
  comment_reads_user_page_unique: CREATE UNIQUE INDEX comment_reads_user_page_unique ON public.comment_reads USING btree (user_id, work_page_id)
  comments_pkey: CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id)
  comments_submission_id_idx: CREATE INDEX comments_submission_id_idx ON public.comments USING btree (submission_id)
  comments_work_page_created_idx: CREATE INDEX comments_work_page_created_idx ON public.comments USING btree (work_page_id, created_at)
AFTER foreign keys:
  comment_reads.comment_reads_work_page_id_work_pages_id_fk: FOREIGN KEY (work_page_id) REFERENCES work_pages(id) ON DELETE CASCADE
  comments.comments_submission_id_submissions_id_fk: FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
  comments.comments_work_page_id_work_pages_id_fk: FOREIGN KEY (work_page_id) REFERENCES work_pages(id) ON DELETE CASCADE
AFTER comments.author_role distribution:
  (no comments)
AFTER comment_reads=0 (expected 0)
DRY RUN — rolled back
```

## Orchestrator: apply then deploy

The new code selects `comments.work_page_id/author_role/edited_at/deleted_at` and `comment_reads`. On the old schema, the student to-do page (reviewerComment), both group pages and the thread would fail. The old code ignores the new columns. **Apply first, then deploy right away.**

1. `npx tsx src/db/migrations/2026-10-04-comment-threads.ts --dry-run`: re-check that it ends with `DRY RUN — rolled back` and the counts are unchanged.
2. `npx tsx src/db/migrations/2026-10-04-comment-threads.ts --apply`: expect `APPLIED — committed`.
3. Optional: re-run `--dry-run`. It should print `already migrated ... — nothing to do`.
4. Merge and deploy right away. Never use `drizzle-kit push`; constraint and index names already match Drizzle's, so no diff is expected.

## Regression sweep

- **(a) Every action is gated.** All 5 exports in `actions/comment.ts` call `getCurrentUserId()`, then `resolveCommentThread(` (lines 71, 83, 121, 150, 170). `authz-coverage.test.ts` checks this statically, with code comments stripped so a mention in a comment can't satisfy it. It also checks the export set and that `postComment` uses `db.transaction(`.
- **(b) Cross-thread access.**
  - A student of group B is not a member of group A's to-do group, so `authorizeTodoViewer` throws for list, post, edit, delete and mark-seen.
  - A student who passes another `studentId` or `groupId` gets `'forbidden'`, so the action throws. This is unit-tested in `resolveThreadOwner`.
  - `editComment`/`deleteComment` re-resolve the thread from the comment's own page and require `thread.page.id === comment.workPageId`.
- **(c) No emails.** `CommentView` carries only `authorName` (publicName) and `authorImageUrl`. `buildCommentThread` copies only `publicName` and `imageUrl` out of the directory. A test asserts that the serialised view has no `email` or `@`.
- **(d) Existing behaviour.** `getTodoSubmissionStatuses` is unchanged. The work page tests (conflict, eligibility, schema sync) all still pass (289/289).
- **(e) Cascades (schema FK review).** Deleting a to-do cascades to work_pages, then to comments (`comments_work_page_id_work_pages_id_fk`) and comment_reads (`comment_reads_work_page_id_work_pages_id_fk`). Submission deletes still cascade to their comments.
- **(f) 03i compatibility.** Comment permissions never reference `canEditWorkPage`, `latestStatus`/`latestScopedStatus` or deadlines. A static test asserts this for `actions/comment.ts` and `comment-access.ts`. Students can comment on locked or submitted pages. The edit to `StudentTodoScreen` is one appended block.

## Deviations from Plan

### Planned deviations (Claude's discretion, per CONTEXT)

1. **`comments.author_role` column.** This extra additive column is stored at write time: editor becomes 'teacher', everyone else 'student'. The ครู badge, the unread dot and reviewerComment need it, and working out roles at read time breaks once a teacher leaves the classroom.
2. **Polling `listComments` instead of `router.refresh()`.** CONTEXT asked for `router.refresh()` every 30 s. A full refresh re-renders the autosaving Tiptap work page on the same screen, which could disturb typing or conflict handling. Instead, the thread polls `listComments` every 30 s while the tab is visible, and again when the tab becomes visible. Comment actions also skip `revalidatePath` for the same reason.
3. **publicName fix.** `UserDisplay.publicName` was added. The student-facing `updatedByName` in `getStudentWorkPage` and `toConflict` now uses it, because `name` can fall back to a classmate's email. Teacher-only views keep `name`.

### Orchestrator-requested change (user-reported bug)

4. **Teachers could not reach `/todo/[todoId]` from the group page.** In `TodoItem`:
   - The title is now a `Link` to `/todo/<id>`.
   - A visible **"ดูงาน"** button (BTN_INFO) sits next to a `StatusPill`: ยังไม่ส่ง / รอตรวจ / ต้องแก้ไข / ผ่านแล้ว. For individual to-dos it shows "รอตรวจ n" when several students are waiting.
   - The 💬 count chip links to `/todo/<id>#comments`.
   - The status comes from the new editor-only `getGroupTodoReviewStatuses` and the pure `summarizeTodoReview`, tested in `todo-review-status.test.ts`. Rules: group to-do uses the group's latest submission. Individual to-do uses each student's latest, ranked pending > rejected > approved > none.
   - Because a link can't sit inside the collapsible trigger, the edit form now opens from the chevron button (aria-label "แก้ไขรายละเอียดงาน") instead of from the title. On mobile, the pill and "ดูงาน" wrap onto a second line.

### Auto-fixed issues

5. **[Rule 1] The authz test could pass on a comment.** `editComment`/`deleteComment` first authorized through a helper, so their bodies didn't literally contain `resolveCommentThread(`. They now call it inline, followed by `assertSameThread`. The test also strips comments before matching.
6. **[Rule 3] Plan verify greps hit doc comments.** A comment saying "router.refresh" and comments saying "email" matched the plan's `! grep` checks. I reworded them; the behaviour is unchanged.

### Minor choices

- After a post, the thread scrolls to the newest message. Edit and delete keep the scroll position, so you don't lose the message you're working on.
- Unread dots are only shown on unlocked nodes, because a locked node can't be opened to clear the dot.
- Nothing extra was needed for the sticky mobile submit bar. It sticks only inside the work page container, and `<main>` already pads for the bottom tab bar.

## Known Stubs

None. Every UI element is backed by real queries and actions.

## Manual verification (after apply + deploy; not done here, since no DB writes were allowed)

1. **Student, group to-do:** open a to-do. "ความคิดเห็น (0)" shows the empty-state text. Post with Cmd/Ctrl+Enter and with the "ส่ง" button. Enter adds a newline. The counter appears above 1800 characters.
2. **Body safety:** post `<script>alert(1)</script>` and `javascript:alert(1)`; both should render as literal text. `https://example.com.` should link without the trailing dot and open in a new tab.
3. **Edit and delete:** edit within 15 minutes and check the "แก้ไขแล้ว" tag. After 15 minutes the แก้ไข item disappears. Delete shows "ข้อความถูกลบ".
4. **Teacher, group to-do:** on `/todo/<id>`, the thread is under งานของนักเรียน. Teacher messages are blue-soft with the ครู badge. The teacher can delete a student's comment.
5. **Teacher, individual to-do:** the student chips switch threads (`?student=<id>#comments`). Each student sees only their own thread.
6. **Cross-group isolation:** a student of another group can't load or post (the action throws). Check the student home of the other group too.
7. **Unread dot:** a teacher comments, and the student's node shows a blue 💬 dot (mobile and desktop). Opening the to-do clears it on the next home load.
8. **Teacher group page:** each to-do row has a title link, a status pill and a "ดูงาน" button, all opening `/todo/<id>`. The 💬 chip appears when the count is above 0 and jumps to `#comments`. The chevron still opens the edit form. Drag-reorder still works from the grip.
9. **Round tag:** comment after submitting and the comment shows "ส่งครั้งที่ n". Resubmit and the thread is still there.
10. **Polling:** with two browsers on the same thread, a new message appears within about 30 s. The work page editor isn't disturbed while you type.

## Self-Check: PASSED

- All created files exist (13 created, 18 modified, listed above).
- Commits 270731b, bd573a5, 87ad294, a99d042, 632abf2 and 28d1c2c are present in `git log`.
