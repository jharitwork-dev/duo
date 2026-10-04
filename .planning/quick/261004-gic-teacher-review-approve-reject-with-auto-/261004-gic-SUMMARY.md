---
phase: quick-261004-gic
plan: 01
subsystem: teacher-review
tags: [review, approve, send-back, phase-unlock, nav-badge, comments]
requires: [quick-261004-03i, quick-261004-fgj, quick-261004-01i]
provides: [approveSubmission, rejectSubmission, /teacher/review, /teacher/review/[submissionId], auto phase unlock]
affects: [nav (ตรวจงาน badge), teacher work panel, student to-do page (approval note card), postComment (refactor only)]
tech-stack:
  added: []
  patterns: [row locks group -> page -> submission, guarded UPDATE status='pending', URL-state list page]
key-files:
  created:
    - src/lib/review.ts
    - src/lib/__tests__/review.test.ts
    - src/server/review-helpers.ts
    - src/server/actions/review.ts
    - src/server/queries/review.ts
    - src/app/(dashboard)/teacher/review/[submissionId]/page.tsx
    - src/components/review/ (stepper, tabs, card, picker, banner, submission/history cards, actions, dialogs, review-ui.ts)
  modified:
    - src/app/(dashboard)/teacher/review/page.tsx
    - src/app/(dashboard)/layout.tsx
    - src/components/cocoon/{app-shell,bottom-tab-bar,desktop-header,nav-items}.ts(x)
    - src/server/comment-access.ts, src/server/actions/comment.ts
    - src/server/__tests__/authz-coverage.test.ts
    - src/components/work-page/teacher-work-page-panel.tsx
    - src/components/student/submission-status-view.tsx, src/components/student/student-todo-view.tsx
decisions:
  - Free-access phases never block and are skipped when choosing the phase to activate; an approval inside one may complete it but never activates another phase
  - The review transaction locks the group row first, so two approvals in the same group cannot both miss the "last to-do approved" check
  - History round label for a sent-back round follows Figma home-15 ("ต้องแก้ไข"), not the plan's "ให้แก้ไข"
metrics:
  completed: 2026-10-04
  tasks: 3
---

# Quick 261004-gic: Teacher review (approve / send back, auto phase unlock) Summary

Teachers can now approve or send back the latest pending submission from a Figma-styled review list and detail page. Feedback goes into the fgj comment thread. When the last to-do of a phase is approved, that group's phase is marked completed and the next gating phase is activated in the same transaction.

**Precondition:** 03i was fully merged (main at 85bdc1d, including the 03i SUMMARY). The worktree was fast-forwarded from b6624e4 to 85bdc1d before work started.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | 1af3405 | test: failing tests for review helpers |
| 1 (GREEN) | 732dbb7 | feat: review actions with row locks, review comments and auto phase unlock |
| 2 | ff2ab54 | feat: teacher review list with phase stepper, status tabs and pending badge |
| 3 | b4afa22 | feat: review detail page with send-back and pass dialogs |

## Routes

- `/teacher/review?classroom=&phase=&tab=pending|rejected|approved&done=approved|rejected`: the list page. It replaces the ComingSoon placeholder.
- `/teacher/review/[submissionId]`: the detail page with the ให้แก้ไข / ให้ผ่าน dialogs and the fgj thread (`#comments`).
- Entry points:
  - the ตรวจงาน nav tab, which shows a pending-count badge on mobile and desktop
  - the review list cards
  - the teacher work panel on `/todo/[id]`: "เช็คงาน" while pending, "ดูผลตรวจ" otherwise

## Lock order and guards

`approveSubmission` / `rejectSubmission` (`src/server/actions/review.ts`) run in this order:

1. `requireRole(TEACHER, SUPERADMIN)` → `getCurrentUserId` → zod → `assertTodoEditor`.
2. A transaction that takes, in order:
   1. the `groups` row FOR UPDATE
   2. the work page FOR UPDATE (`getOrCreatePage lock:true, markAuthor:false`)
   3. the submission FOR UPDATE (`lockReviewTarget`), plus the latest in-scope submission FOR UPDATE
3. `checkReviewEligibility`: a stale round returns "งานนี้มีการส่งฉบับใหม่แล้ว"; an already-reviewed one returns "งานนี้ตรวจแล้ว".
4. `UPDATE … WHERE id AND status='pending'`, which sets only status / reviewedBy / reviewedAt. createdAt and updatedAt are never touched.
5. `insertThreadComment` with the reviewed submission id: feedback is required on send-back, the note is optional on approve.
6. On approve only, `applyAutoPhaseUnlock`.

Taking the page lock before the submission lock matches 03i's `updateSubmittedWorkPage` order, so the two can't deadlock. A racing student update gets `reviewed:true`.

## Free-access interpretation

- Free-access phases never block progression. When choosing the phase to activate, they are skipped (left untouched) and the next non-free-access phase becomes active.
- Approving inside a free-access phase can mark that phase completed but never activates another phase.
- If the current phase is already `completed` (e.g. a teacher override) or `locked` (and not free-access), nothing happens. `setGroupPhaseStatus` overrides still work.
- A phase with zero to-dos never completes automatically.
- Individual to-dos require every **current** group member's latest round to be approved. Former members are ignored, and a group with no members never completes.

## TOOL-03 note

TOOL-03 (Phase 6: a teacher view of pending, sent-back and passed work with a count badge) is **satisfied here** by `/teacher/review` and the ตรวจงาน nav badge. Phase 6 should not rebuild it.

## Student side check (Task 3 step 8)

- The round history already shows each round's status (`STATUS_LABEL`: รอตรวจ / ต้องแก้ไข / ผ่านแล้ว).
- The "คำแนะนำจากผู้ตรวจ" card already reads `reviewerComment`, which is the latest teacher comment tied to that submission. That is exactly what `rejectSubmission` writes.
- **The approval-note case was missing.** I added a `tone="approved"` variant to `ReviewerNoteCard`, which renders a green "ข้อความจากผู้ตรวจ". `student-todo-view.tsx` renders it when the latest round is approved and has a teacher comment.

## Checks (real results)

- `npx tsc --noEmit`: clean.
- `npx eslint src`: 15 problems (10 errors, 5 warnings). That is identical to the baseline recorded before starting (same files, all pre-existing). None are in touched files.
- `npm test`: 19 files, 446 tests passed. This includes `review.test.ts` (26 tests) and the extended authz-coverage test (review.ts is scanned, plus lock/guard/comment/unlock assertions).
- `npm run build`: succeeded. `ƒ /teacher/review` and `ƒ /teacher/review/[submissionId]` are built.
- `grep ComingSoonCard src/app/(dashboard)/teacher/review`: no matches.

## Safety

- **No schema change and no DB writes.** No drizzle-kit, no migration `--apply`, no seeds. All of these were "not run".
- No R2 uploads, no deploy, no push. The dev server on port 3000 was not touched. `.env.local` was copied from main and is git-ignored, so it was not committed.

## Deviations from Plan

1. **[Figma over plan] History label for a sent-back round is "ต้องแก้ไข".** The plan said "ให้แก้ไข", but design/mac home-15 shows "ต้องแก้ไข".
2. **[Figma over plan] "คำแนะนำครั้งก่อน" is placed under the submission card in the left column, as in home-15.** The plan put it above the grid. It reuses `ReviewerNoteCard`.
3. **[Rule 3] Extra small files.**
   - `BTN_WARN` lives in a new `src/components/review/review-ui.ts`, so the client dialogs don't import from the server card. `ui.ts` was not edited.
   - `reviewListHref`, `parseReviewTab`, `REVIEW_ROUND_LABEL` and `REVIEW_SENT_BACK_BANNER` were added to `src/lib/review.ts`.
4. **[Rule 2] `getReviewList` also accepts an explicit `?classroom=` for classrooms the teacher doesn't own,** for teacher members and superadmins, after an `assertClassroomEditor` check. The default list, like `getPendingReviewCount`, stays scoped to classrooms the user created (same scope as `getTeacherClassrooms`).
5. **`student-todo-view.tsx` (not in the plan's file list) got one conditional render** for the approval note, because that is where `ReviewerNoteCard` is used.
6. **If an eligibility check fails, the transaction still commits a work page that `getOrCreatePage` may have just created.** That page is empty and has no author (`markAuthor:false`), the same behaviour as `postComment`. Nothing else is written.

## Known follow-ups (out of scope)

- `computeLockedTodoIds` in `src/lib/node-path.ts` still unlocks the next row of to-dos once the previous ones are submitted, not once they are approved (its `TODO(Phase 4)`). Phase gating is now enforced by approval; per-row gating inside a phase was left unchanged.

## Manual verification (for the user, on a non-production DB or a test classroom)

1. As a teacher, open `/teacher/review`.
   - The classroom picker appears only when you have more than one classroom.
   - The Phase stepper defaults to the first phase with pending work.
   - The รอตรวจ tab lists cards showing "ส่งเมื่อ … · ครั้งที่ n · k ไฟล์" and "เช็คงาน".
   - The ตรวจงาน nav tab shows the pending count on desktop and mobile.
2. Open a card. Check the snapshot, the files ("เปิด" opens them), ประวัติการส่ง, the footer hint, and the comment thread.
3. Click ให้แก้ไข, then submit with empty feedback. "กรุณาระบุคำแนะนำก่อนส่งกลับ" should appear and no request should be sent.
4. Enter feedback and send it back.
   - You land on the รอแก้ไข tab with "✓ ส่งกลับให้แก้ไขแล้ว · แจ้งเตือนทีมเรียบร้อย" and the hint text, and the badge decreases.
   - As the student, the to-do shows ต้องแก้ไข with the "คำแนะนำจากผู้ตรวจ" card, the feedback appears in the thread, and the work page is editable again.
5. The student resubmits. In the review detail, "คำแนะนำครั้งก่อน" shows the earlier feedback and the history lists two rounds.
6. Approve the **last** to-do of Phase 1 for a group, with an optional note.
   - The toast reads "บันทึกผลแล้ว" with "ปลดล็อค {Phase 2} ให้ทีมแล้ว".
   - You land on the ผ่าน tab with "✓ บันทึกผลแล้ว · แจ้งเตือนทีมเรียบร้อย".
   - On the student path, Phase 1 is completed and Phase 2 is unlocked for **that group only**.
   - The note appears as the green "ข้อความจากผู้ตรวจ" card and in the thread.
7. Race test: open the review detail in two tabs and approve in both. The second shows the toast "งานนี้ตรวจแล้ว".
8. Race test: while the teacher has the pass dialog open, the student clicks "อัปเดตงานที่ส่ง". If the review commits first, the student gets "ครูตรวจงานนี้แล้ว" (03i).
9. Individual to-do: the phase completes only after every current member's latest round is approved.
10. A teacher override via the group page phase controls still works after an auto unlock.

## Self-Check: PASSED

- Created files exist: src/lib/review.ts, src/server/actions/review.ts, src/server/review-helpers.ts, src/server/queries/review.ts, src/app/(dashboard)/teacher/review/[submissionId]/page.tsx.
- Commits exist: 1af3405, 732dbb7, ff2ab54, b4afa22.
