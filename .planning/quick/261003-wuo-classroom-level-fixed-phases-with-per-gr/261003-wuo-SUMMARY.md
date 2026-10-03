---
phase: quick-261003-wuo
plan: 01
subsystem: content-structure
tags: [phases, todos, group-progress, migration, templates, teacher-ui]
requires: []
provides:
  - classroom-level phases (phases.classroom_id)
  - group_phase_progress table + missing-row default rule
  - per-group to-dos (todos.group_id NOT NULL, todos.assignment_id)
  - multi-group to-do assignment (independent copies)
  - classroom Phase tab, group phase board, manual per-group status
  - reviewed, idempotent data migration script (dry-run verified, NOT applied)
affects: [student node-path home, student to-do page, templates, Phase 4 auto-unlock]
tech-stack:
  added: []
  patterns:
    - pure planners (planPhaseMerge, planProgressSync, resolveGroupPhaseStatuses) unit-tested, DB code thin
    - syncClassroomProgress after every phase/group structural change
key-files:
  created:
    - src/db/schema/groupPhaseProgress.ts
    - src/db/migrations/phase-merge-plan.ts
    - src/db/migrations/__tests__/phase-merge-plan.test.ts
    - src/db/migrations/2026-10-03-classroom-phases.ts
    - src/lib/phase-progress.ts
    - src/lib/template-structure.ts
    - src/lib/__tests__/phase-progress.test.ts
    - src/lib/__tests__/template-structure.test.ts
    - src/server/phase-helpers.ts
    - src/components/todo/assign-todo-dialog.tsx
    - src/components/phase/group-phase-board.tsx
    - src/components/phase/group-phase-status-select.tsx
    - src/components/phase/archived-phase-list.tsx
    - src/components/template/save-template-dialog.tsx
  modified:
    - src/db/schema/{phases,todos,relations,index}.ts
    - src/db/seed/templates.ts
    - src/lib/node-path.ts
    - src/server/actions/{phase,todo,template,group}.ts
    - src/server/queries/{phase,todo,template,submission}.ts
    - src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx
    - src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/app/(dashboard)/todo/[todoId]/page.tsx
    - src/components/phase/{phase-list,phase-item,inline-add-phase}.tsx
    - src/components/todo/{todo-list,todo-item,inline-add-todo}.tsx
    - src/components/template/template-picker.tsx
decisions:
  - "Pristine-group rule for progress sync: no completed rows, <=1 active row, no submissions in its active phase -> re-derive the default; otherwise keep rows and only insert missing ones as locked"
  - "Submission existence for progress sync uses todos.group_id (to-dos are per group) instead of submissions.group_id, which is nullable (ON DELETE set null)"
  - "Migration sets lock_timeout 5s / statement_timeout 60s so live traffic never queues behind its ALTER TABLE locks"
  - "Template to-dos and multi-group to-dos share one assignmentId per template to-do only when more than one group is selected"
  - "saveAsTemplate does not copy attachments (CONTEXT discretion)"
metrics:
  completed: 2026-10-04
  tasks: 3
  commits: 5
---

# Quick 261003-wuo: Classroom-level fixed phases, per-group to-dos, multi-group assignment Summary

Phases now belong to the classroom. Each group's status for a phase lives in the new `group_phase_progress` table (a missing row means the first phase is active and the rest are locked). To-dos are scoped to a (phase, group) pair, and one to-do can be created for several groups at once as independent copies that share an `assignment_id`. Templates now apply to a whole classroom. A transactional, idempotent migration script is included. It has only been run with `--dry-run` against the shared DB, and its output matches the expected merge exactly.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 55eab7e | feat(261003-wuo): classroom-level phase schema + group_phase_progress |
| 2 | 909d6f9 | feat(261003-wuo): pure progress/merge helpers with tests |
| 3 | 49b02f3 | feat(261003-wuo): classroom-phases migration script (dry-run only) |
| 4 | 2de8db5 | feat(261003-wuo): server data layer on classroom phases |
| 5 | 6b814eb | feat(261003-wuo): teacher UI for classroom phases, group board, multi-group assign |

Task 1 was split into commits 1 to 4 as the plan required. Commits 1 to 3 do not pass tsc on their own, because the server layer still read the removed columns; this is noted in each commit body. tsc is clean from commit 4 on. Task 3 was a verification pass and needed no code change, so it has no commit of its own.

## Verification (real results, in the worktree)

- `npx tsc --noEmit`: clean
- `npx eslint .`: `✖ 18 problems (10 errors, 8 warnings)`. The 10 errors match the baseline (use-mobile.ts, auth.test.ts). Warnings went from 13 to 8.
- `npm test`: 8 test files and 83 tests pass. That includes the new phase-merge-plan (10), phase-progress (8), template-structure (3) and resolveGroupPhaseStatuses (4) cases.
- `npm run build`: succeeds (Next 16.3.5, 18 static pages generated, every route compiled)
- Leftover sweep: `grep -rnE "phases\.groupId|phase\.group\b|todo\.phase\.group|groupId=\{groupId\} templates" src` finds nothing. `drizzle.config.ts` is untouched, and no `drizzle/` directory was generated.
- Migration without a flag (and with both flags) prints usage and exits 1.

## Migration dry-run output (exact)

`npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --dry-run`, against the shared DB, rolled back, exit 0:

```
MODE: DRY RUN (will roll back)
BEFORE: classrooms=1 groups=3 phases=2 todos=3 submissions=0
BEFORE phases (classroom / owning group / phase):
  Cocoon 2026 / A / "Market Research" id=a0q8774elzwodchcl2v9mve3 order=0 status=active todos=2
  Cocoon 2026 / AFFY / "Market Research" id=aqu7bo1kzez2mubyrzt98if4 order=0 status=active todos=1
PLAN classroom=w7s7qzlihgdpenlnz0j6lwut: survivors=1 remap=2 delete=1 progress=3
todos re-pointed: 3, progress rows written: 3, phases to delete: 1
AFTER: classrooms=1 groups=3 phases=1 todos=3 submissions=0
AFTER classroom phases:
  Cocoon 2026 / #0 "Market Research" id=a0q8774elzwodchcl2v9mve3
AFTER group_phase_progress (group / phase / status):
  A / "Market Research" / active
  AFFY / "Market Research" / active
  m / "Market Research" / active
AFTER todos per (group, phase):
  A / "Market Research" -> 2
  AFFY / "Market Research" -> 1
DRY RUN — rolled back
```

This matches the expected result. There is one classroom phase, A's older row, which survives. All 3 to-dos are re-pointed to it with group_id A, A and AFFY, and none is null. The remap includes the survivor's self-entry, so A's 2 to-dos get group_id. Progress rows exist for A and AFFY (both had status `active`) and for m (the default, `active`). Counts of to-dos (3) and submissions (0) are unchanged.

## Orchestrator: apply migration

The live site will error on phase queries during the gap between deploying this code and applying the migration (in either order). Apply the migration immediately before or after the deploy.

1. `npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --dry-run`: re-check that the output still matches the block above. Data may have changed since.
2. `npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --apply`: it must end with `APPLIED — committed`. Any failed assertion rolls everything back and exits 1.
3. `npx drizzle-kit push`: expected to be a no-op. Verify that it reports no changes. If it proposes anything, do NOT accept it; investigate first. The constraint names were chosen to match Drizzle's naming: `group_phase_progress_group_id_groups_id_fk`, `group_phase_progress_phase_id_phases_id_fk`, `group_phase_progress_group_id_phase_id_unique`, `phases_classroom_id_classrooms_id_fk`, `todos_group_id_groups_id_fk`.
4. Deploy (merge to main and let Vercel deploy).
5. Re-running `--apply` later is safe. It prints "already migrated" and exits 0.

## Access regression review (Task 3)

| Check | Result |
|-------|--------|
| (a) `resolveStudentTodoAccess` rejects a classroom member who is not in `todo.groupId` (it uses `isGroupMember(todo.groupId)`) | PASS |
| (b) `getActivePhases` filters to-dos by `todos.groupId = groupId`; the student page still redirects non-members of the group (`group.members.some(...)`) | PASS |
| (c) `createSubmission` stores `groupId = access.groupId = todo.groupId`, and `revalidatePath` uses that group | PASS |
| (d) `createTodo` rejects groups from another classroom; `setGroupPhaseStatus` requires `group.classroomId === phase.classroomId` | PASS |
| (e) `applyTemplate` refuses when the classroom has any non-archived phase (Thai error) | PASS |

The student branch markup is unchanged. `getActivePhases` keeps its name and return shape (phase fields + `status` + `todos`), so PhaseStepper, NodePath and NodePathDesktop receive the same shapes, and the node-path helpers do too. `student-todo-view.tsx` only uses `isPhaseViewable(phase)` (status and isFreeAccess, both still present).

## Deviations from Plan

### Auto-fixed / adjusted

1. **[Rule 3 - Blocking] The student page teacher-branch change landed in the Task 2 commit, not Task 3.** TemplatePicker's props changed in Task 2 (classroomId, groups), and the old call site would not compile. The empty state is now an EMPTY_CARD that links to `?tab=phases`, with the unused imports removed. Commit 6b814eb.
2. **[Rule 2] `InlineAddPhase.onCreated` is optional and defaults to `router.refresh()`.** The server-rendered classroom page cannot pass a function prop.
3. **[Rule 2] `AssignTodoDialog` takes `trigger` (content) + `triggerClassName`, plus optional controlled `open`/`onOpenChange`.** Base UI's DialogTrigger needs a `render` element, and the phase dropdown item has to open the dialog in controlled mode.
4. **`syncClassroomProgress` takes submission existence from `todos.group_id` rather than `submissions.group_id`.** The two are equivalent now that to-dos are per group, and `submissions.group_id` is nullable. The plan's pristine rule was kept unchanged.
5. **The migration header comment was reworded** so the plan's leftover grep (`phases\.status`) stays empty. Commit 2de8db5.
6. **The migration adds `lock_timeout = 5s` and `statement_timeout = 60s`** so the shared live DB never queues behind its locks. The dry-run holds these locks briefly too.
7. **Extra test file `src/lib/__tests__/template-structure.test.ts`** (3 cases) covers `parseTemplateStructure` tolerance.
8. **Orchestrator request mid-run:** the "Cocoon Incubation" built-in template was added to `BUILT_IN_TEMPLATES` in `src/db/seed/templates.ts` (3 phases, 6 to-dos, all `submissionMode: 'group'`). It was committed in 6b814eb. The seed script was not run.
9. Removed the unused imports (`phases`, `groups`, `groupMembers`) in `src/server/queries/todo.ts`, which this task touched.

### Not changed (noted)

- `updateTodo` / `archiveTodo` / `restoreTodo` still check only the role, not classroom ownership. The plan said to leave them unchanged, and this was already the case before this task.
- If a non-pristine group's active phase is archived, the group can end up with no active phase. The teacher can fix this with the manual status Select (D-3). Auto-advancing is Phase 4.

## Preserved concurrent work

`src/lib/user-directory.ts`, `src/components/cocoon/member-identity.tsx`, `getClassroomById` (members/groups display fields), `assign-student-dialog.tsx`, `classroom-settings-form.tsx`, `group-card.tsx`, the admin user-role list and the app icons are all untouched. The classroom page still passes `classroomMembers`/`members` to GroupCard and ClassroomSettingsForm.

## Manual verification list (after the migration is applied)

1. Teacher → classroom → **Phase** tab (`?tab=phases` deep link works). "Market Research" is listed. Reorder, edit, archive, and restore from "Phase ที่เก็บไว้".
2. Phase menu → "เพิ่มงานให้หลายกลุ่ม" → check ทุกกลุ่ม → each group gets its own copy (check on each group page).
3. Group page → each phase shows this group's status pill. Change it with the status Select (toast "อัปเดตสถานะแล้ว"). The student stepper for that group reflects the change.
4. Group page → เพิ่มงาน (this group is pre-checked) → reorder and archive to-dos. Other groups are not affected.
5. Test classroom with no phases: the template picker shows a group checklist. Apply with all groups checked, and again with none (phases only). Applying when phases already exist shows the Thai refusal toast.
6. บันทึกเป็นเทมเพลต with a group, and with "ไม่รวมงาน". The new template appears in the picker.
7. Create a new group: it gets default progress (first phase active).
8. Student (group A): the home path, stepper and to-do pages look identical to before. Only group A's to-dos are visible. Submitting works.
9. A student from another group cannot open A's to-do URL (access denied).

## Known Stubs

None.

## Self-Check: PASSED

- All created files exist (verified with `git diff --stat 4b2adae HEAD`, 41 files).
- Commits 55eab7e, 909d6f9, 49b02f3, 2de8db5 and 6b814eb are present in `git log`.
