---
phase: quick-261003-wuo
verified: 2026-10-03T17:18:24Z
status: passed
score: 10/10 must-haves verified
human_verification:
  - test: "Live manual verification list in SUMMARY.md (sections 1-9), to be run AFTER the orchestrator applies the migration"
    expected: "Phase tab deep-link, multi-group assign, per-group status select, template apply/save, new-group default progress, student path unchanged, cross-group access denial — all behave as designed"
    why_human: "Requires a running app against a live/staging DB with the migration applied; this verification pass intentionally never touches the shared DATABASE_URL (hard rule) and could only perform static/code-level checks"
---

# Quick Task 261003-wuo: Classroom-level fixed phases, per-group to-dos, multi-group assignment — Verification Report

**Task Goal:** Move phases from group level to classroom level, store each group's phase status in `group_phase_progress`, scope to-dos to (phase, group) with multi-group assignment, adapt templates, and ship a reviewed, idempotent (dry-run only) data migration script.
**Verified:** 2026-10-03T17:18:24Z
**Status:** passed
**Mode:** Initial verification (no prior VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every group in a classroom sees the same ordered phase list (phases belong to the classroom) | ✓ VERIFIED | `src/db/schema/phases.ts` has `classroomId` FK, no `groupId`/`status`. `getActivePhases(groupId)` (src/server/queries/phase.ts) loads phases by the group's `classroomId`, shared across all groups. |
| 2 | A student only sees/submits to-dos whose `group_id` is their own group; a teacher sees every group's to-dos in their classroom | ✓ VERIFIED | `resolveStudentTodoAccess` (src/server/queries/submission.ts) checks `isGroupMember(todo.groupId, userId)` and returns null otherwise. `getActivePhases` filters `eq(todos.groupId, groupId)`. Teacher group page loads all groups' to-dos per group page; `getTodoDetail` is reached only by teacher/superadmin role branch. |
| 3 | A group's phase status comes from `group_phase_progress`; missing row ⇒ first non-archived phase active, rest locked | ✓ VERIFIED | `resolveGroupPhaseStatuses` (src/lib/node-path.ts) + `getGroupPhaseStatus` (src/server/queries/phase.ts) implement exactly this default. Unit tests pass (4 cases in node-path.test.ts). |
| 4 | Teacher can set one group's phase status from the group page; student stepper reflects it | ✓ VERIFIED | `setGroupPhaseStatus` (src/server/actions/phase.ts) upserts `group_phase_progress`; `GroupPhaseStatusSelect` (src/components/phase/group-phase-status-select.tsx) calls it and `router.refresh()`s. Student stepper reads the same `getActivePhases` result, so the change is visible immediately after refresh. |
| 5 | Teacher can create one to-do for several groups at once (checkboxes + ทุกกลุ่ม); each gets an independent copy sharing one `assignment_id` | ✓ VERIFIED | `AssignTodoDialog` (src/components/todo/assign-todo-dialog.tsx) with `GroupChecklist` "ทุกกลุ่ม" toggle calls `createTodo({phaseId, groupIds, ...})`; `createTodo` (src/server/actions/todo.ts) sets `assignmentId = groupIds.length > 1 ? createId() : null` and inserts one row per group in one transaction. |
| 6 | Applying a template to an empty classroom creates phases + optional to-dos for selected groups; refused with Thai error if phases exist | ✓ VERIFIED | `applyTemplate` (src/server/actions/template.ts) throws `'ห้องเรียนนี้มี Phase อยู่แล้ว — เก็บ Phase เดิมก่อนใช้เทมเพลต'` when a non-archived phase exists; otherwise inserts phases + per-group to-do copies (shared `assignmentId` when >1 group) and calls `syncClassroomProgress`. |
| 7 | บันทึกเป็นเทมเพลต saves classroom's non-archived phases + one chosen group's to-dos (title, submissionMode, description, notes) | ✓ VERIFIED | `saveAsTemplate` (src/server/actions/template.ts) builds `TemplateStructure` from active phases and the chosen group's active todos with exactly those 4 fields; `SaveTemplateDialog` wires name/description/group select. |
| 8 | Migration merges per-group phases by trimmed lower-case name, keeps every to-do (re-pointed, group_id = old phase's group), writes progress rows, idempotent, rolls back under --dry-run | ✓ VERIFIED | `phase-merge-plan.ts` implements `nameKey = name.trim().toLowerCase()`; `2026-10-03-classroom-phases.ts` has the idempotency guard (step 1), `--dry-run` → `ROLLBACK`, `--apply` → `COMMIT`, and asserts `todosTouched === before.todos`. 19 unit tests pass covering all described scenarios including the live-data fixture. Dry-run was actually executed against the shared DB (documented in SUMMARY) and matches the expected result exactly; it was NOT applied. |
| 9 | After migration EVERY to-do has non-null group_id, incl. to-dos already on a survivor phase (remap holds one entry per ORIGINAL phase row, survivors self-mapped) | ✓ VERIFIED | `remap = classroomPhases.map(...)` in `phase-merge-plan.ts` produces exactly one entry per original row with an explicit invariant check (`remap.length !== classroomPhases.length` throws); survivor self-maps have `oldPhaseId === survivorId`. Dedicated tests (a)/(b)/(c) in the plan all pass, including "live-data fixture: every to-do resolves to a group (no null group_id)". |
| 10 | Student node-path home, stepper, to-do pages look/behave exactly as before | ✓ VERIFIED | Student branch markup in `student/classroom/[classroomId]/group/[groupId]/page.tsx` is unchanged (same components: PhaseStepper, NodePath, NodePathDesktop, same node-path helpers); `getActivePhases` keeps its name/shape. `npm run build` succeeds; tsc clean. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/groupPhaseProgress.ts` | `group_phase_progress` table, unique(group_id, phase_id) | ✓ VERIFIED | Table + `unique().on(t.groupId, t.phaseId)` present, exports `PHASE_STATUSES`/`PhaseStatus`. |
| `src/db/schema/phases.ts` | `classroom_id`, no `group_id`/`status` | ✓ VERIFIED | Confirmed by direct read; no `groupId`/`status` columns remain. |
| `src/db/schema/todos.ts` | `group_id` NOT NULL + `assignment_id` | ✓ VERIFIED | Both columns present as specified. |
| `src/db/migrations/phase-merge-plan.ts` | Pure merge planner, exports `planPhaseMerge` | ✓ VERIFIED | Exported, 160 lines, pure (no DB imports), invariant-checked remap. |
| `src/db/migrations/2026-10-03-classroom-phases.ts` | Idempotent transactional migration, --dry-run/--apply | ✓ VERIFIED | 307 lines (min 120). Both flags implemented, mutually exclusive, usage printed otherwise. |
| `src/lib/phase-progress.ts` | Pure progress sync planner, exports `planProgressSync` | ✓ VERIFIED | Exported; pristine/non-pristine logic matches spec; 8 tests pass. |
| `src/lib/node-path.ts` | `resolveGroupPhaseStatuses` export, default rule | ✓ VERIFIED | Exported; local `PhaseStatus` type (no schema import, stays pure); 4 new tests pass; all pre-existing exports retained. |
| `src/server/phase-helpers.ts` | `assertClassroomEditor`, `getPhaseClassroomId`, `syncClassroomProgress` | ✓ VERIFIED | All three exported and implemented exactly as specified (owner-or-superadmin check, planProgressSync-driven upsert). |
| `src/components/todo/assign-todo-dialog.tsx` | Multi-group to-do creation form (checkboxes + ทุกกลุ่ม) | ✓ VERIFIED | `GroupChecklist` with "ทุกกลุ่ม" toggle; calls `createTodo({phaseId, groupIds, ...})`; toast `เพิ่มงานให้ ${n} กลุ่มแล้ว`. |
| `src/components/phase/group-phase-board.tsx` | Teacher group page: classroom phases, per-group status + manual control, this group's to-dos | ✓ VERIFIED | Renders one collapsible card per phase with `PhaseStatusPill`, `GroupPhaseStatusSelect`, and `TodoList` scoped to `groupId`; opens the active phase by default. |

All 10 declared artifacts: VERIFIED at all applicable levels (exists, substantive, wired). Level-4 data-flow trace: `getActivePhases` → DB query (not static) → consumed by `GroupPhaseBoard`/student page → rendered. No hollow props found.

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `queries/phase.ts getActivePhases(groupId)` | `group_phase_progress` + `todos.group_id` | `resolveGroupPhaseStatuses` | ✓ WIRED | Confirmed by direct read: joins classroom phases with group-scoped todos, resolves status via the pure helper. |
| `queries/submission.ts resolveStudentTodoAccess` | `todos.group_id` | `groupId = todo.groupId; phase.status` resolved for that group | ✓ WIRED | Confirmed: `const groupId = todo.groupId`, `getGroupPhaseStatus(groupId, todo.phaseId)`. |
| `components/todo/assign-todo-dialog.tsx` | `createTodo({ phaseId, groupIds, ... })` | server action call | ✓ WIRED | `await createTodo({ phaseId, groupIds, title, submissionMode })` inside `startTransition`. |
| `actions/phase.ts` and `actions/group.ts` | `syncClassroomProgress` | called after phase create/reorder/archive/restore and group create | ✓ WIRED | Confirmed in `createPhase`, `reorderPhases`, `archivePhase`, `restorePhase` (phase.ts) and `createGroup` (group.ts). |
| `teacher/classroom/[classroomId]/page.tsx` | Phase tab (PhaseList / TemplatePicker / SaveTemplateDialog) | `TabsTrigger value="phases"` | ✓ WIRED | `grep -q 'value="phases"'` passes; tab fetches `getClassroomPhases`, `getArchivedPhases`, `getTemplates` in parallel. |

All 5 key links: WIRED.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GroupPhaseBoard` | `phases` prop | `getActivePhases(groupId)` (DB query, joins phases + todos + progress) | Yes — real Drizzle query, not static | ✓ FLOWING |
| `AssignTodoDialog` | `groups` prop | `getGroupsByClassroom(classroomId)` at call sites | Yes | ✓ FLOWING |
| Student node-path page | `phases`/`todos` | `getActivePhases` + `getTodoSubmissionStatuses` (both DB-backed) | Yes | ✓ FLOWING |

No hardcoded-empty props or static stub returns found in the files touched by this task.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit suites for new pure logic (merge planner, progress sync, resolveGroupPhaseStatuses) | `npx vitest run src/db/migrations/__tests__/phase-merge-plan.test.ts src/lib/__tests__/phase-progress.test.ts src/lib/__tests__/node-path.test.ts` | 43/43 passed | ✓ PASS |
| Full project test suite | `npm test` | 8 files / 83 tests passed | ✓ PASS |
| Type safety | `npx tsc --noEmit` | clean | ✓ PASS |
| Lint baseline unchanged | `npx eslint .` | 10 errors (baseline), 8 warnings | ✓ PASS |
| Production build | `npm run build` | succeeded, all routes compiled | ✓ PASS |
| No leftover references to old model | `grep -rnE "phases\.groupId\|phase\.groupId\|todo\.phase\.group\|phases\.status" src` | no matches | ✓ PASS |
| drizzle.config.ts / drizzle/ untouched | `git status --short drizzle.config.ts drizzle/`, `ls drizzle` | clean, directory does not exist | ✓ PASS |
| Migration dry-run safety | Code review of `2026-10-03-classroom-phases.ts` main() | `--dry-run`/`--apply` mutually exclusive, dry-run always ROLLBACKs; SUMMARY documents only `--dry-run` was ever executed, matching expected merge output | ✓ PASS (code-level; DB state itself not independently re-queried per hard rule) |

Spot-checks constrained by the hard rule: no DB connection, no `drizzle-kit`, no migration execution (not even `--dry-run`) was performed during this verification pass. All DB-touching claims were verified by static code review plus the dry-run transcript already captured in SUMMARY.md, not by re-running anything against the shared database.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PHASE-01 | 01 | Teacher can create ordered phases for a group/classroom | ✓ SATISFIED | `createPhase` + `PhaseList`/`InlineAddPhase`, now at classroom level per D-1. |
| PHASE-02 | 01 | Phases have state: locked/active/completed | ✓ SATISFIED | State moved to per-group `group_phase_progress`, same 3-value enum, default rule preserved. |
| PHASE-03 | 01 | Teacher can set a phase free-access | ✓ SATISFIED | `isFreeAccess` column retained on `phases`; `updatePhase` still accepts it; `isPhaseViewable` unchanged. |
| PHASE-04 | 01 | Teacher can set optional deadlines on phases | ✓ SATISFIED | `deadline` column retained; `updatePhase` accepts it. |
| TODO-01 | 01 | Teacher can create to-do items within a phase | ✓ SATISFIED | `createTodo` (now per phase+group(s)). |
| TODO-02 | 01 | Each to-do has submission mode group/individual | ✓ SATISFIED | `submissionMode` column + UI Select retained verbatim. |
| TODO-03 | 01 | Teacher can set optional deadlines on to-dos | ✓ SATISFIED | `deadline` column retained on `todos`; `updateTodo` accepts it. |
| TODO-04 | 01 | To-do detail page: notes, attachments, submission form | ✓ SATISFIED | `todo/[todoId]/page.tsx` unchanged in structure, only data-access paths updated. |
| TOOL-01 | 01 | Teacher can assign phases/to-dos to all groups in a classroom at once (bulk assign) | ✓ SATISFIED (code) | `AssignTodoDialog`'s "ทุกกลุ่ม" toggle and `TemplatePicker`'s all-checked-by-default group checklist both implement classroom-wide bulk assignment. **Note:** `.planning/REQUIREMENTS.md` still shows `TOOL-01` as `[ ]` unchecked / "Phase 6 / Pending" — this looks like a stale tracking doc, not a code gap; the orchestrator should update REQUIREMENTS.md's checkbox and phase mapping to reflect that this quick task delivered it. |

No orphaned requirements found: all 9 IDs declared in the plan's frontmatter are addressed above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/node-path.ts` | 55 | `// TODO(Phase 4): require 'approved' instead of any submission once teacher review ships.` | ℹ️ Info | Pre-existing comment from an earlier quick task (260928-iwi), not introduced here; correctly scoped out per CONTEXT ("auto-unlock on approval (Phase 4)... out of scope"). Not a blocker. |

No stub patterns (`return null`/`{}`/`[]` as a dead end, empty handlers, hardcoded-empty props, console.log-only implementations) were found in any of the 31 files this task created or modified.

### Human Verification Required

### 1. Post-migration manual UI walkthrough

**Test:** Execute the 9-item "Manual verification list (after the migration is applied)" in `261003-wuo-SUMMARY.md` — Phase tab deep link, multi-group "เพิ่มงานให้หลายกลุ่ม", status Select + student stepper reflection, per-group to-do add/reorder/archive isolation, template apply with partial/no groups + refusal toast, บันทึกเป็นเทมเพลต with/without a group, new-group default progress, student visual parity, cross-group access denial.
**Expected:** All 9 items behave as described in the SUMMARY.
**Why human:** Requires a running app connected to a database where the migration has actually been applied (teacher/student roles, real browser session, visual comparison). This verification pass is intentionally DB-write-free per the hard rule and could not exercise any of these live.

### 2. Orchestrator migration apply

**Test:** Run `npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --dry-run` once more immediately before `--apply` (data may have changed since the captured transcript), then `--apply`, then `npx drizzle-kit push` (expect no-op), then deploy.
**Expected:** `--apply` ends with `APPLIED — committed`; `drizzle-kit push` reports no changes.
**Why human/orchestrator-only:** Hard rule forbids this verification pass from touching the shared DATABASE_URL in any way; this step is explicitly reserved for the orchestrator per the plan.

### Gaps Summary

No code-level gaps found. Schema, pure planners (with full unit-test coverage matching every behavior described in the plan), server actions/queries, and teacher/student UI all match the plan's must-haves exactly, including Thai copy strings, access-control checks (a)-(e) from Task 3, and the migration script's safety/idempotency properties. `tsc`, `eslint` (baseline-only errors), `npm test` (83/83), and `npm run build` all pass. No references to the removed `phases.groupId`/`phases.status`/`todo.phase.group` remain anywhere in `src`. `drizzle.config.ts` is untouched and no `drizzle/` directory exists, confirming no schema-push side effects occurred.

The only non-blocking item is a stale `TOOL-01` checkbox in `.planning/REQUIREMENTS.md` that doesn't yet reflect this task's delivery — a documentation sync item, not a functional gap.

All DB-mutating verification (actually applying the migration, running `drizzle-kit push`, exercising the UI against applied data) remains for the orchestrator/human per the explicit hard rule that this pass must never write to or further interact with the shared DATABASE_URL.

---

*Verified: 2026-10-03T17:18:24Z*
*Verifier: Claude (gsd-verifier)*
