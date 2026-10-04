---
phase: quick-261004-fgj
verified: 2026-10-04T00:00:00Z
status: passed
score: 11/11 must-haves verified
---

# Quick Task 261004-fgj: Task discussion thread (teachers and students) — Verification Report

**Task Goal:** One discussion thread per task (per group / per student), visible only to classroom editors + that group/student; post anytime; edit within 15 min; soft delete; round tag; unread dot on student path; teacher comment counts; reviewerComment compatibility; plus teacher to-do rows link to /todo/[id] with a "ดูงาน" button and status pill.

**Verified:** 2026-10-04
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Student sees "ความคิดเห็น (n)" thread card under work page/history, can post 1–2000 char plain text via Cmd/Ctrl+Enter or "ส่ง" | ✓ VERIFIED | `src/components/comment/comment-thread.tsx` renders `ความคิดเห็น ({count})`; `comment-composer.tsx` `isSendShortcut` handles Cmd/Ctrl+Enter + "ส่ง" button; wired into `student-todo-view.tsx:143-145` under `<Suspense>` after the work page/history grid |
| 2 | Teacher on /todo/[todoId] sees same thread (group) or picks student (individual); can post; teacher messages tinted blue-soft with blue "ครู" badge | ✓ VERIFIED | `src/app/(dashboard)/todo/[todoId]/page.tsx:133-141,153-208` renders `TeacherCommentThread` with student picker chips (`?student=<id>#comments`) only when `workView` exists (editor-only); `comment-message.tsx:51-57,79` applies `bg-cocoon-blue text-white` badge + `bg-cocoon-blue-soft` bubble when `authorRole === 'teacher'` |
| 3 | Students of another group/student cannot read or post: every comment action throws | ✓ VERIFIED | `resolveThreadOwner` (`src/lib/comment-thread.ts:140-161`) returns `'forbidden'` for mismatched group/student ids; `resolveCommentThread` throws `NOT_AUTHORIZED` on that result; unit-tested in `comment-thread.test.ts:143-154`; every one of the 5 actions in `actions/comment.ts` calls `resolveCommentThread(` before any DB write, statically enforced by `authz-coverage.test.ts:116-121` |
| 4 | Students never see a classmate's/teacher's email; names come from a public name that never falls back to email | ✓ VERIFIED | `publicDisplayName` (`comment-thread.ts:176-186`) only uses firstName/lastName/username, falls back to `'ไม่ระบุชื่อ'`, never email; `buildCommentThread` (`queries/comment.ts:53-55`) copies only `publicName`+`imageUrl` into the directory passed to `toCommentView`; `CommentView` has no email field; test asserts `JSON.stringify(view)` does not match `/email|@/` (`comment-thread.test.ts:266`) |
| 5 | `<script>`/`javascript:` renders as literal text; only http(s)/www URLs become links (rel=noopener noreferrer, target=_blank); no dangerouslySetInnerHTML | ✓ VERIFIED | `linkifySegments` regex `URL_RE` only matches `https?://` or `www.`; `javascript:`, `data:`, `<script>` all fall through `safeHref` returning null and are kept as literal text (unit-tested `comment-thread.test.ts:72-77`); `comment-body.tsx` renders segments as `<span>`/`<a>` React nodes only, with `rel="noopener noreferrer" target="_blank"`; `grep dangerouslySetInnerHTML src/components/comment` is empty |
| 6 | Author can edit own comment within 15 min ("แก้ไขแล้ว"); author or editor can soft-delete ("ข้อความถูกลบ", no body sent to clients) | ✓ VERIFIED | `canEditComment`/`canDeleteComment` (`comment-thread.ts:105-118`) implement the 15-min window and author-or-editor rule, unit-tested at the boundary (`comment-thread.test.ts:98-114`); `toCommentView` sets `body: null` when `deletedAt` is set (`comment-thread.ts:230`); `comment-message.tsx:82-83` shows "ข้อความถูกลบ" italic placeholder |
| 7 | Comments after submission n carry "ส่งครั้งที่ n" tag; thread persists across resubmissions (attached to work page) | ✓ VERIFIED | `roundForSubmission` computes 1-based round from scoped submission ids (`comment-thread.ts:121-125`, tested); `comment-message.tsx:65-67` renders the tag when `round !== null`; comments key off `work_page_id` (not `submission_id`), so the thread is stable across resubmissions |
| 8 | Student home node path shows unread dot for to-dos with unseen teacher comments; opening clears it | ✓ VERIFIED | `getUnreadTeacherCommentTodoIds` (`queries/comment.ts:84-137`) computed with fixed query count via `hasUnreadTeacherComments`; wired into student group page (`.../group/[groupId]/page.tsx:126-169`) → `NodePath`/`NodePathDesktop` render `MessageCircle` dot (`node-path.tsx:3,46`); `CommentThread` calls `markCommentsSeen` on mount for students (`comment-thread.tsx:86-88`) |
| 9 | Teacher to-do row shows comment-count chip linking to /todo/<id>#comments when count > 0 | ✓ VERIFIED | `getGroupCommentCounts` (`queries/comment.ts:143-153`) grouped count through `assertGroupEditor`; wired teacher page → `GroupPhaseBoard` → `TodoList` → `TodoItem`; `todo-item.tsx:131-142` renders the chip only when `commentCount > 0`, with `stopPropagation` on click/pointerdown |
| 10 | reviewerComment is latest non-deleted teacher comment tied to that submission | ✓ VERIFIED | `queries/submission.ts:174-175`: nested `comments` relation filtered `and(eq(comments.authorRole, 'teacher'), isNull(comments.deletedAt))`, ordered desc, limit 1 (per plan); `authorRole` stored at write time in `postComment` (`actions/comment.ts:103`) |
| 11 | Migration dry-run only; output ends "DRY RUN — rolled back" | ✓ VERIFIED | Re-ran `npx tsx src/db/migrations/2026-10-04-comment-threads.ts --dry-run`: output ends `DRY RUN — rolled back`, counts unchanged (`comments=0 work_pages=1 submissions=1` before and after); no-flag run exits 1 with usage; `git status` clean — `--apply` never run |

**Score:** 11/11 truths verified

### Bonus/Orchestrator-requested truth

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 12 | Teacher to-do rows link to /todo/[id] with a "ดูงาน" button and status pill | ✓ VERIFIED | `todo-item.tsx:113-118` (title `Link`), `153-159` ("ดูงาน" `Link` styled `BTN_INFO`), `148-152` (`StatusPill` with `reviewStatus`/`reviewLabel` from `getGroupTodoReviewStatuses`/`summarizeTodoReview`, unit-tested in `todo-review-status.test.ts`) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations/2026-10-04-comment-threads.ts` | Additive idempotent migration | ✓ VERIFIED | Dry-run re-executed, ends "DRY RUN — rolled back", unchanged counts; no-flag exits 1 |
| `src/lib/comment-thread.ts` | Pure helpers | ✓ VERIFIED | All exports present (`normalizeCommentBody`, `linkifySegments`, `canEditComment`, `canDeleteComment`, `roundForSubmission`, `resolveThreadOwner`, `formatCommentTime`, `hasUnreadTeacherComments`, `publicDisplayName`), no server-only imports |
| `src/server/comment-access.ts` | `resolveCommentThread` built on `authorizeTodoViewer` | ✓ VERIFIED | Exported, calls `authorizeTodoViewer` (`comment-access.ts:64`), throws for outsiders/archived, handles `needsStudent` |
| `src/server/actions/comment.ts` | 5 actions | ✓ VERIFIED | `postComment, editComment, deleteComment, listComments, markCommentsSeen` all exported, all call `resolveCommentThread(`, `postComment` wraps write in `db.transaction(` |
| `src/components/comment/comment-thread.tsx` | Client thread card | ✓ VERIFIED | Messages list, composer, 30s visible-only polling (`comment-thread.tsx:90-117`), empty/loading/error states |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `actions/comment.ts` | `comment-access.ts` | every export calls `resolveCommentThread(` | ✓ WIRED | Confirmed by reading source + statically enforced by `authz-coverage.test.ts:116-121` (also checks `getCurrentUserId()` precedes it) |
| `comment-access.ts` | `work-page-access.ts` | `authorizeTodoViewer` + `findPage`/`getOrCreatePage` | ✓ WIRED | `comment-access.ts:64,89`; `actions/comment.ts:90` (`getOrCreatePage(tx, ..., { markAuthor: false })`) |
| `comment-thread.tsx` | `actions/comment.ts` | `listComments` polling, post/edit/delete, `markCommentsSeen` | ✓ WIRED | All five actions imported and called in `comment-thread.tsx:8,52,71,131,149,165` |
| student group page | `queries/comment.ts` | `getUnreadTeacherCommentTodoIds` → NodePath `unreadTodoIds` | ✓ WIRED | `.../student/.../group/[groupId]/page.tsx:12,130,162,169` |
| `queries/submission.ts` | `comments.author_role` | reviewerComment = latest non-deleted teacher comment | ✓ WIRED | `queries/submission.ts:174-175` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CommentThread` | `data.comments` | `listComments` server action → `buildCommentThread` → real `db.select().from(comments)` join + `getUserDirectory` | Yes | ✓ FLOWING |
| `NodePath` dot | `unreadTodoIds` | `getUnreadTeacherCommentTodoIds` — real queries over `workPages`/`comments`/`commentReads`, fixed query count, filtered by `hasUnreadTeacherComments` | Yes | ✓ FLOWING |
| `TodoItem` comment chip | `commentCounts[todo.id]` | `getGroupCommentCounts` — real grouped SQL count joined through `workPages`/`todos`, gated by `assertGroupEditor` | Yes | ✓ FLOWING |
| `TodoItem` status pill | `review` | `getGroupTodoReviewStatuses` / `summarizeTodoReview` (pure, unit-tested in `todo-review-status.test.ts`) | Yes | ✓ FLOWING |
| reviewerComment | `SubmissionHistoryEntry.reviewerComment` | Drizzle relation query with real `authorRole`/`deletedAt` filter | Yes | ✓ FLOWING |

No hollow props or disconnected data sources found.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration dry-run ends correctly | `npx tsx src/db/migrations/2026-10-04-comment-threads.ts --dry-run` | Ends `DRY RUN — rolled back`, counts unchanged | ✓ PASS |
| Migration no-flag guard | `npx tsx .../2026-10-04-comment-threads.ts` (no args) | Prints usage, exit 1 | ✓ PASS |
| Type safety | `npx tsc --noEmit` | Clean, no output | ✓ PASS |
| Lint baseline | `npx eslint .` | 15 problems (10 errors / 5 warnings) — matches documented baseline, no new issues | ✓ PASS |
| Full test suite | `npm test` | 15 files, 289/289 passed | ✓ PASS |
| Production build | `npm run build` | Succeeds, all routes compiled including `/todo/[todoId]` and both group pages (dynamic) | ✓ PASS |
| No dangerouslySetInnerHTML | `grep -rn dangerouslySetInnerHTML src/components/comment` | Empty | ✓ PASS |
| No router.refresh in comment UI | `grep -rn router.refresh src/components/comment` | Empty | ✓ PASS |
| No email leakage in comment lib/actions | `grep -n email src/lib/comment-thread.ts src/server/actions/comment.ts src/components/comment/*.tsx` | Empty | ✓ PASS |
| Working tree / commits | `git status --short`, `git log` | Clean tree, all 6 phase commits present (270731b, bd573a5, 87ad294, a99d042, 632abf2, 28d1c2c) | ✓ PASS |

No server was started; no DB writes were performed; `--apply` was never invoked (hard safety rule honored).

### Requirements Coverage

Not applicable — this is a quick task (`QUICK-261004-fgj`); no corresponding entries exist in `.planning/REQUIREMENTS.md` for quick tasks. Coverage is assessed against the PLAN's `must_haves` instead (see Observable Truths above).

### Anti-Patterns Found

None. Scanned `src/components/comment/`, `src/server/actions/comment.ts`, `src/server/comment-access.ts`, `src/server/queries/comment.ts`, `src/lib/comment-thread.ts` for TODO/FIXME/PLACEHOLDER, empty handlers, dangerouslySetInnerHTML, router.refresh, and email references — all clean.

### Human Verification Required

The following require a human with a live DB after the orchestrator applies the migration and deploys (consistent with the SUMMARY's "Manual verification" section — none of this could be exercised here because DATABASE_URL is shared with the live site and no DB writes were permitted):

1. **End-to-end posting and polling**
   **Test:** Open the same to-do thread in two browser sessions (student + teacher), post a message in one, wait up to 30s.
   **Expected:** The message appears in the other session without disturbing the autosaving work-page editor.
   **Why human:** Requires a running server against a live/staging DB with two authenticated sessions; static analysis can't exercise polling timing or editor-disturbance behavior.

2. **Visual verification of role badges/bubble colors**
   **Test:** View a thread with both a teacher and student comment.
   **Expected:** Teacher message is blue-soft with a blue "ครู" badge; student message is white with a bordered "นักเรียน" badge.
   **Why human:** Visual/CSS rendering outcome, not verifiable by grep/tsc.

3. **Unread dot clears on open**
   **Test:** As a student with an unseen teacher comment, confirm the node-path dot appears, open the to-do, return home.
   **Expected:** Dot is gone on the next home load.
   **Why human:** Requires live navigation and DB state (comment_reads row) that cannot be created without DB writes here.

4. **Teacher student-switcher correctness**
   **Test:** On an individual to-do with multiple students, click each chip.
   **Expected:** Each shows only that student's own thread; URL updates to `?student=<id>#comments`.
   **Why human:** Requires live session interaction.

### Gaps Summary

No gaps found. All 11 plan must-haves plus the orchestrator-requested "ดูงาน"/status-pill/comment-chip addition are implemented, statically verified, and covered by passing automated tests (`tsc`, `eslint` at baseline, 289/289 `vitest`, successful `npm run build`). The migration was dry-run only as required — `--apply` was never executed and the working tree is clean. No anti-patterns, no email leakage, no HTML injection paths, and `javascript:`/`data:`/`<script>` payloads are confirmed (by both source inspection and unit test) to render as inert literal text rather than clickable links. Authorization on every comment action (including teacher-supplied `groupId`/`studentId`) is enforced server-side via `resolveCommentThread`/`resolveThreadOwner`, independent of what any client UI passes, and is defended by a dedicated static test (`authz-coverage.test.ts`). Remaining items are inherently manual (live two-session polling, visual styling, DB-state-dependent unread-dot clearing) and are listed under Human Verification Required.

---

*Verified: 2026-10-04*
*Verifier: Claude (gsd-verifier)*
