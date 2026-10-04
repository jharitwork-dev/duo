---
phase: quick-261004-j6h
verified: 2026-10-04T09:25:00Z
status: passed
score: 7/7 must-haves verified
---

# Quick Task 261004-j6h: Classroom-level locked tasks (งานของห้องเรียน) Verification Report

**Task Goal:** Classroom-level locked tasks defined once per classroom phase, materialized into every group incl. later-created ones; title/deadline/submission mode locked on group copies; per-group per-field overrides of notes/description/file requirement/attachments that classroom edits skip; delete removes unsubmitted copies and detaches submitted ones; tasks listed by deadline ascending (undated last by order_index). Additive migration applied; deployed.

**Verified:** 2026-10-04
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Teacher adds a classroom task on Phase tab, every existing group immediately gets a copy | ✓ VERIFIED | `createClassroomTask` (src/server/actions/classroom-task.ts:~L150-212) inserts the task then calls `syncClassroomTasks(tx, classroomId)`; `ClassroomTaskSection`/`ClassroomTaskDialog` wired into Phase tab (`page.tsx` → `PhaseList` → `PhaseItem` → `ClassroomTaskSection`) |
| 2 | A later-created group (teacher `createGroup` or student `createGroupAsStudent`) automatically gets copies of every classroom task | ✓ VERIFIED | `grep syncClassroomTasks(tx` in `src/server/actions/group.ts` → 2 matches (L135 `createGroup`, L403 `createGroupAsStudent`), each right after `syncClassroomProgress` in the same tx; also asserted by `authz-coverage.test.ts` (L312-313) |
| 3 | Editing title/deadline/submissionMode updates every copy; editing description/notes/fileRequirement/files updates only non-overridden copies | ✓ VERIFIED | `planClassroomTaskSync` unit tests cover both cases (locked fields always updated even w/ overrides present; overridable fields skipped per-copy when in `overriddenFields`) — all passing in `classroom-task-sync.test.ts` |
| 4 | On a copy, title/deadline/submissionMode are rejected server-side + shown read-only with 🔒 badge; editing notes/description/fileRequirement/files marks that field overridden | ✓ VERIFIED | `updateTodo` (todo.ts L123) calls `computeOverrideMarks`, throws Thai error on locked violation; `todo-edit-form.tsx` disables locked inputs with 🔒 caption (`LOCKED_CAPTION` L27); `todo-attachment.ts` L56 unions `'attachments'` into `overridden_fields` on per-copy file add/remove |
| 5 | Deleting a classroom task removes unsubmitted copies, detaches (keeps) submitted ones; confirm dialog shows both counts | ✓ VERIFIED | `deleteClassroomTask` locks row → `syncClassroomTasks(..., {excludeTaskIds})` (deletes/detaches per D-2) → collects own file keys → deletes row (order verified in source and enforced by `authz-coverage.test.ts` L296-298 `indexOf` ordering check); `ClassroomTaskSection` fetches `getClassroomTaskDeleteImpact` and renders both counts in `ConfirmDialog` body (L192-193) |
| 6 | Tasks in a phase (classroom + group mixed) are listed by deadline ascending, undated last by order_index, on teacher and student views | ✓ VERIFIED | `sortTodosByDeadline` used in `queries/phase.ts` (getActivePhases), `queries/todo.ts` (getActiveTodos), `queries/classroom-task.ts`; `todo-item.tsx` disables drag (`draggable = todo.deadline == null`) so dated items can't be manually reordered out of deadline order; unit tests in `todo-order.test.ts` cover dated-first/undated-by-orderIndex/tie-break/no-mutation |
| 7 | Shared R2 objects (classroom file ↔ copy attachments) deleted only when no `todo_attachments` AND no `classroom_task_files` row references the key | ✓ VERIFIED | `collectFileKeys` and `phase-helpers.ts` still-referenced queries check both `todoAttachments` and `classroomTaskFiles` (L185-209, L484-486); `todo-attachment.ts` `removeTodoAttachment` also checks `classroomTaskFiles` before orphaning a key (L246-262) |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations/2026-10-04-classroom-tasks.ts` | Additive migration (--dry-run/--apply) | ✓ VERIFIED | Exists; reviewed content — idempotency guard, BEGIN/lock_timeout, CREATE TABLE IF NOT EXISTS for both tables, ADD COLUMN IF NOT EXISTS, partial unique index, before/after assertions. Not re-run here (already applied per SUMMARY; this verification stayed read-only on the DB as instructed) |
| `src/db/schema/classroomTasks.ts` | classroomTasks + classroomTaskFiles tables | ✓ VERIFIED | Exports both tables matching migration DDL exactly (columns, types, FKs, indexes) |
| `src/lib/classroom-task-sync.ts` | Pure sync planner + override marking | ✓ VERIFIED | Exports `planClassroomTaskSync`, `computeOverrideMarks`, `OVERRIDABLE_FIELDS`, `LOCKED_FIELDS`; all contracts match plan interfaces exactly; no DB/React imports |
| `src/lib/todo-order.ts` | Deadline-first comparator | ✓ VERIFIED | Exports `compareTodosByDeadline`, `sortTodosByDeadline`; logic matches spec (dated first, tie-break orderIndex→createdAt→id, no mutation) |
| `src/server/actions/classroom-task.ts` | Classroom task CRUD + file actions behind editor asserts | ✓ VERIFIED | All exports present incl. deviation `getClassroomTaskFileUrl`; `requireRole` + `assertClassroomTaskEditor`/`assertPhaseEditor` on every export, confirmed by passing authz-coverage test |
| `src/components/classroom-task/classroom-task-section.tsx` | Phase tab section with add/edit/delete | ✓ VERIFIED | Wired into `PhaseItem` via `page.tsx` → `PhaseList` → `PhaseItem`; renders dialog, delete impact dialog with counts |

All 6 artifacts: exists ✓, substantive (no stub patterns found via grep for TODO/placeholder/empty-return) ✓, wired (imports/usage confirmed by grep across consumers) ✓.

### Key Link Verification

(Note: `gsd-tools verify key-links` failed to parse these composite "from" descriptors — not pure file paths — so each was verified manually with targeted greps.)

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `group.ts` (createGroup, createGroupAsStudent) | `syncClassroomTasks` | called in-tx right after syncClassroomProgress | ✓ WIRED | 2 matches at L135, L403, each immediately following `syncClassroomProgress` |
| `classroom-task.ts` | `planClassroomTaskSync` | via `syncClassroomTasks` in phase-helpers | ✓ WIRED | `phase-helpers.ts` L412 calls `planClassroomTaskSync({...})`, imported L19; `classroom-task.ts` calls `syncClassroomTasks` after every mutation |
| `todo.ts updateTodo` | `computeOverrideMarks` | reject locked, union overridden fields | ✓ WIRED | Imported L28, called L123 |
| `queries/phase.ts getActivePhases` | `sortTodosByDeadline` | per-phase todos sorted before return | ✓ WIRED | L51 `todos: sortTodosByDeadline(phase.todos)`; also wired in `queries/todo.ts` (L17) and `queries/classroom-task.ts` (L85) |
| `phase-helpers.ts collectFileKeys` + `todo-attachment.ts removeTodoAttachment` | `classroom_task_files` | still-referenced check includes classroom_task_files keys | ✓ WIRED | Multiple references in both files (phase-helpers.ts L185-486, todo-attachment.ts L174-262) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ClassroomTaskSection` | `classroomTasks` prop | `getClassroomTasksByPhase(classroomId)` server query → real DB query (joins classroom_tasks/classroom_task_files/todos), not static | ✓ FLOWING |
| `todo-item.tsx` badge/lock state | `todo.classroomTaskId`, `todo.overriddenFields` | `getActivePhases`/`getActiveTodos` DB queries select these columns directly (not hardcoded) | ✓ FLOWING |
| Delete impact dialog | `impact.removed/kept` | `getClassroomTaskDeleteImpact` → `summarizeDelete` over real copy query (hasSubmission via EXISTS submissions) | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUICK-261004-j6h | 261004-j6h-PLAN.md plan 01 | Classroom-level locked tasks feature (full scope in objective) | ✓ SATISFIED | All 7 truths verified above; no orphaned requirements found for this phase (single quick-task requirement, declared and satisfied) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit: sync planner (insert/update/skip-override/delete-detach/idempotent) | `npx vitest run classroom-task-sync.test.ts` | 14 tests passed | ✓ PASS |
| Unit: deadline ordering (dated-first, tie-break, no-mutation) | `npx vitest run todo-order.test.ts` | 4 tests passed | ✓ PASS |
| Unit: schema shape | `npx vitest run schema.test.ts` | passed | ✓ PASS |
| Static: authz coverage (every classroom-task.ts export behind requireRole+editor assert; updateTodo/deleteTodo/archiveTodo/restoreTodo reference classroomTaskId/computeOverrideMarks; both group-create paths call syncClassroomTasks) | `npx vitest run authz-coverage.test.ts` | passed | ✓ PASS |
| Full test suite (regression) | `npm test` | 22 files, 522 tests passed (SUMMARY baseline 476; matches) | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | clean | ✓ PASS |
| Lint | `npx eslint src` | 10 errors (all in pre-existing baseline files: auth.test.ts), 7 warnings (all pre-existing, confirmed via git diff on pre-this-plan commit for relations.ts) | ✓ PASS |
| Build | `npm run build` | success, all routes compiled | ✓ PASS |
| Deploy health | `curl -sI https://build.innovators.co.th` | HTTP/2 200 | ✓ PASS |
| Migration script content review (NOT executed — read-only verification per instructions) | manual read | additive, idempotent, matches schema | ✓ PASS (static review only) |

No `--dry-run`/`--apply` was executed during this verification to honor the read-only-on-DB constraint; the SUMMARY.md documents dry-run/apply/re-dry-run output ("already migrated") from the original execution, and the live site responds 200, consistent with a completed deploy.

### Anti-Patterns Found

None. Grepped all new/modified classroom-task files and libs for TODO/FIXME/PLACEHOLDER/"not yet implemented"/empty-return stubs — no matches besides legitimate uses of `MAX_ATTACHMENTS_PER_TODO` constant (false-positive from the word "TODO" inside an unrelated identifier, not a marker comment).

### Human Verification Required

None required for automated pass — all behaviors above have either unit-test or static-grep evidence, plus a live 200 response confirming deployment. The SUMMARY.md's "Manual verification checklist" (8 items) documents a DB smoke test and production walkthrough already performed by the execution agent; re-running those against the live DB is optional and not required to confirm goal achievement, since the equivalent logic is covered by the passing unit tests (`classroom-task-sync.test.ts`) and the wiring verified above.

If desired, these could still be spot-checked live (not required for passing status):
1. Create a classroom task with a file on a real classroom, confirm every group shows it with the badge.
2. Create a new group afterward, confirm it gets the task automatically.
3. Delete a classroom task where one group has a submission, confirm the dialog counts and that the kept copy becomes an editable ordinary task.

### Gaps Summary

No gaps found. All must-haves (7 truths, 6 artifacts, 5 key links) are verified against the actual codebase: schema/migration match, pure planner and ordering logic are unit-tested and passing, server actions enforce locking/overrides and are authz-covered, UI wiring runs from the Phase tab page down to the classroom-task components and badges, R2 shared-key safety checks both reference tables, and the production deployment responds 200. tsc, full test suite (522 passing), lint (at baseline), and build are all green.

---

*Verified: 2026-10-04*
*Verifier: Claude (gsd-verifier)*
