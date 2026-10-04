---
phase: quick-261004-gic
verified: 2026-10-04T00:00:00Z
status: passed
score: 9/9 must-haves verified
---

# Quick Task 261004-gic: Teacher review (approve / send back, auto phase unlock) Verification Report

**Task Goal:** Teacher review list (`/teacher/review`: phase stepper, รอตรวจ/รอแก้ไข/ผ่าน tabs, cards, pending badge) and
detail (`/teacher/review/[submissionId]`) with send-back (required feedback → teacher comment) and pass dialogs per
Figma copy; only latest pending round reviewable; row locks compatible with `updateSubmittedWorkPage`; auto phase
completion + next phase unlock per group (group/individual modes, free-access rule, manual overrides respected).

**Verified:** 2026-10-04
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Only a classroom editor can approve/send-back the LATEST pending submission; others throw | ✓ VERIFIED | `src/server/actions/review.ts:60,66,128,134` — `requireRole` + `assertTodoEditor(sub.todoId, userId)` in both exports; `authz-coverage.test.ts` asserts `assertTodoEditor(` in both bodies |
| 2 | Stale → "งานนี้มีการส่งฉบับใหม่แล้ว"; already-reviewed → "งานนี้ตรวจแล้ว"; nothing written | ✓ VERIFIED | `src/lib/review.ts:144-154` `checkReviewEligibility` checks stale FIRST; `review.test.ts` covers both; action returns `{kind:'fail'}` before any UPDATE (`review.ts:90-91,154-155`) |
| 3 | Locks FOR UPDATE in order group → page → submission; UPDATE guarded by `status='pending'`; racing student update gets `reviewed:true` | ✓ VERIFIED | `grep "for('update')"` shows group row (`review.ts:78,142`) then page (`getOrCreatePage(..., lock:true)`) then `lockReviewTarget` (`review-helpers.ts:14`); `grep "status, 'pending'"` shows guarded UPDATE at `review.ts:96,160`; `authz-coverage.test.ts:170-182` asserts exact ordering via `body.indexOf` |
| 4 | Feedback/note stored as teacher comment with `submission_id` = reviewed submission | ✓ VERIFIED | `insertThreadComment(tx, {submissionId: target.id, authorRole:'teacher', ...})` at `review.ts:101-108,164-170`; `comment-access.ts:107-128` inserts with that `submissionId` |
| 5 | Auto phase completion (group/individual) + next gating phase unlock, same transaction, free-access skip, no downgrade | ✓ VERIFIED | `applyAutoPhaseUnlock` called inside the same `db.transaction` only on approve (`review.ts:110-114`, confirmed not called in reject by `authz-coverage.test.ts:186-191`); logic in `src/lib/review.ts:95-134` (`computePhaseCompletion`), unit-tested in `review.test.ts` (26 tests, all pass) for group/individual/archived/free-access/last-phase/manual-override cases |
| 6 | `/teacher/review` shows picker, stepper, tabs, cards with exact copy, รอแก้ไข hint, ผ่าน banner | ✓ VERIFIED | `src/app/(dashboard)/teacher/review/page.tsx` + `review-card.tsx`/`review-tabs.tsx`/`review-phase-stepper.tsx`/`review-success-banner.tsx` render exact strings ("ส่งเมื่อ...ครั้งที่...ไฟล์", "เช็คงาน"/"ดูงาน", `REVIEW_PENDING_HINT`, `REVIEW_SUCCESS_BANNER`) |
| 7 | ตรวจงาน nav badge shows pending count (mobile + desktop) for teacher/superadmin | ✓ VERIFIED | `layout.tsx:22-26` passes `badges={{review: reviewCount}}` for non-student roles; `bottom-tab-bar.tsx`/`desktop-header.tsx` render the pill when count > 0 (grep confirmed wiring) |
| 8 | `/teacher/review/[submissionId]` shows submission card, history, คำแนะนำครั้งก่อน, footer hint, dialogs with exact copy, fgj thread | ✓ VERIFIED | `[submissionId]/page.tsx`, `review-submission-card.tsx`, `review-history-card.tsx`, `send-back-dialog.tsx` ("ส่งกลับให้แก้ไข"/"กรุณาระบุคำแนะนำก่อนส่งกลับ"), `pass-dialog.tsx` ("ยืนยันให้งานผ่าน?"/"ยืนยันให้ผ่าน") match Figma copy exactly; `CommentThreadSection` wired with `id="comments"` |
| 9 | No schema change, no DB writes, no 03i regression | ✓ VERIFIED | SUMMARY + manual grep confirm no drizzle-kit/--apply run; `updateSubmittedWorkPage` lock order (page→submission) preserved, review locks page before submission — same order, no deadlock |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/review.ts` | pure helpers + copy constants | ✓ VERIFIED | exports `computePhaseCompletion`, `checkReviewEligibility`, `buildReviewItems`, `REVIEW_MESSAGES`, `REVIEW_TAB_LABEL`, no DB/React imports |
| `src/lib/__tests__/review.test.ts` | unit tests | ✓ VERIFIED | part of 446 passing tests |
| `src/server/actions/review.ts` | `approveSubmission`, `rejectSubmission` | ✓ VERIFIED | both exported, `'use server'`, authz-coverage scans and asserts lock/guard/comment pattern |
| `src/server/review-helpers.ts` | `lockReviewTarget`, `applyAutoPhaseUnlock` | ✓ VERIFIED | plain module (no `'use server'`), `.for('update')` present |
| `src/server/queries/review.ts` | `getReviewList`, `getReviewDetail`, `getPendingReviewCount` | ✓ VERIFIED | all three present, each authz-scoped |
| `src/app/(dashboard)/teacher/review/page.tsx` | list page | ✓ VERIFIED | replaces ComingSoon (grep confirms no `ComingSoonCard` import) |
| `src/app/(dashboard)/teacher/review/[submissionId]/page.tsx` | detail page | ✓ VERIFIED | present, `requireRole` + `getReviewDetail`, `notFound()` on null |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `review.ts` actions | submissions row lock | `.for('update')` then guarded UPDATE | ✓ WIRED | confirmed via grep + authz-coverage ordering assertion |
| `review.ts` approve | `group_phase_progress` | `applyAutoPhaseUnlock` → `computePhaseCompletion` → `onConflictDoUpdate` | ✓ WIRED | `review-helpers.ts:68-76` upserts with `onConflictDoUpdate` targeting `[groupId, phaseId]` |
| `review.ts` actions | `comments` table | `insertThreadComment(tx, {submissionId: target.id, authorRole:'teacher'})` | ✓ WIRED | confirmed at call sites |
| `review-actions.tsx` | `approveSubmission`/`rejectSubmission` | dialog confirm → action → `router.push`/`router.refresh` | ✓ WIRED | `review-actions.tsx:36-61` |
| `layout.tsx` | `getPendingReviewCount` | badge prop → `AppShell` → `BottomTabBar`/`DesktopHeader` | ✓ WIRED | `layout.tsx:22-26`, downstream render confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `/teacher/review` items | `data.items` | `getReviewList` → real Drizzle queries over `submissions`/`todos`/`groups`/`phases` joined, grouped via `buildReviewItems` | Yes | ✓ FLOWING |
| nav badge count | `reviewCount` | `getPendingReviewCount` → real SQL `count()` with joins, scoped to `classrooms.createdBy = userId` (same scope as `getTeacherClassrooms`, pre-existing convention) | Yes | ✓ FLOWING (see note below) |
| `/teacher/review/[id]` detail | `getReviewDetail` result | real Drizzle `findMany` with `with: {files, comments}` and scope filter | Yes | ✓ FLOWING |

Note: `getPendingReviewCount` (and the default classroom list in `getReviewList`) is scoped to classrooms the viewing
user created (`createdBy = userId`), matching the pre-existing `getTeacherClassrooms` convention used throughout the
codebase. A superadmin who has not personally created any classroom will see badge count 0 even if other teachers
have pending work, though they can still open any classroom's review list via `?classroom=` (authorized through
`assertClassroomEditor`). This mirrors existing system-wide behavior and is not a regression introduced by this task
— flagged as informational only, not a gap.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| tsc clean | `npx tsc --noEmit` | no output / exit 0 | ✓ PASS |
| lint at baseline | `npx eslint src` | 15 problems (10 errors/5 warnings), none in touched files, matches documented baseline | ✓ PASS |
| full test suite | `npm test` | 19 files, 446 tests passed (incl. `review.test.ts` 26 tests + extended `authz-coverage.test.ts`) | ✓ PASS |
| production build | `npm run build` | succeeded; `ƒ /teacher/review` and `ƒ /teacher/review/[submissionId]` built | ✓ PASS |
| lock order grep | `grep "for('update')" review-helpers.ts review.ts` | group row, page (via getOrCreatePage), submission row all present | ✓ PASS |
| guarded UPDATE grep | `grep "status, 'pending'" review.ts` | present in both approve and reject | ✓ PASS |
| no DB-write commands in SUMMARY | `grep "drizzle-kit\|--apply"` | only appears as "not run" | ✓ PASS |
| ComingSoonCard removed | `grep -rn "ComingSoonCard" .../teacher/review` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REV-01 | 261004-gic-PLAN.md | (review action authz / eligibility) | ✓ SATISFIED | `assertTodoEditor`, `checkReviewEligibility` |
| REV-02 | 261004-gic-PLAN.md | editors approve/send-back latest pending submission; feedback in thread + feedback card | ✓ SATISFIED | `review.ts` actions + `insertThreadComment` + student `ReviewerNoteCard` |
| REV-03 | 261004-gic-PLAN.md | (review detail / history) | ✓ SATISFIED | `getReviewDetail`, `review-history-card.tsx` |
| REV-04 | 261004-gic-PLAN.md | last approval completes phase for group, activates next gating phase, same transaction, overrides still work | ✓ SATISFIED | `computePhaseCompletion` + `applyAutoPhaseUnlock`, 26 unit tests covering group/individual/free-access/override cases |
| PHASE-05 | 261004-gic-PLAN.md | (phase gating mechanics) | ✓ SATISFIED | same as REV-04 |
| TOOL-03 | 261004-gic-PLAN.md | `/teacher/review` lists pending/sent-back/passed per classroom+phase with pending badge | ✓ SATISFIED | list page + nav badge; SUMMARY explicitly notes this satisfies the Phase 6 requirement |

No orphaned requirements found for this phase in REQUIREMENTS.md cross-reference (quick task, not phase-tracked in REQUIREMENTS.md).

### Anti-Patterns Found

None found in touched files. No TODO/FIXME/placeholder/stub patterns, no empty handlers, no hardcoded-empty data flowing to render in the review feature files. One pre-existing, documented `TODO(Phase 4)` in `src/lib/node-path.ts` (`computeLockedTodoIds`, per-row gating within a phase) is explicitly called out in the SUMMARY as an intentional out-of-scope follow-up, not a regression.

### Human Verification Required

None strictly required to confirm the goal was met — all code paths are statically verified, authz is enforced, locks/guards match the plan exactly, and the full automated suite (tsc, lint, 446 tests, build) passes. The SUMMARY's manual-QA script (approve last to-do of Phase 1 → Phase 2 unlocks for that group only; empty-feedback validation; two-tab race test; student racing update) is recommended for the user to spot-check visually/behaviorally against a live dev DB, but is not required to establish that the implementation is correct and complete per static inspection.

### Gaps Summary

No gaps found. All 9 observable truths verified at exists/substantive/wired/data-flowing levels. Authz is consistently enforced via `assertTodoEditor`/`assertClassroomEditor` on every review action and query. Lock ordering (group → page → submission) matches 03i's `updateSubmittedWorkPage` order to avoid deadlock, and the guarded `UPDATE ... WHERE status = 'pending'` correctly produces `reviewed:true` semantics for a racing student update. Auto phase unlock logic is pure, unit-tested across the documented matrix (group/individual, archived to-dos, free-access, last phase, manual overrides, missing progress rows), and wired into the same transaction as the approval. Figma copy (Thai strings) matches exactly across list, detail, and both dialogs. No schema changes or DB writes were made. tsc, lint (at baseline), full test suite (446/446), and `npm run build` all pass clean.

---
_Verified: 2026-10-04_
_Verifier: Claude (gsd-verifier)_
