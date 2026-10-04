---
phase: quick-261004-02p
verified: 2026-10-04T02:39:57Z
status: passed
score: 9/9 must-haves verified
human_verification:
  - test: "Manual checklist in SUMMARY.md (teacher roster assign/move/remove/bulk, group limit + เต็ม pill, group/phase/todo/classroom delete flows, settings group_mode switch, student picker join/create/leave, invite join redirect, cross-classroom teacher denial)"
    expected: "All items in the SUMMARY's 'Manual verification checklist' behave as described in a running app / staging environment"
    why_human: "Requires a running dev server + real Clerk session + browser interaction (toasts, dialogs, navigation); not verifiable by static inspection alone"
  - test: "Apply migration (--apply) adjacent to deploy per SUMMARY's orchestrator steps, then drizzle-kit push no-op check"
    expected: "--apply prints APPLIED — committed; rerun prints already migrated; drizzle-kit push reports no changes"
    why_human: "HARD RULE forbids running --apply or drizzle-kit against the shared live-site DATABASE_URL from this verification session"
---

# Quick Task 261004-02p: Per-group member limit, student roster, student self-grouping, full CRUD, authz hardening — Verification Report

**Task Goal:** Per-group member limit, student roster with easy assign, student self-grouping (3 modes + leave), join redirect, delete group, full CRUD for classroom/phase/to-do/group/template, classroom-teacher authorization on every teacher mutation.
**Verified:** 2026-10-04T02:39:57Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from PLAN must_haves)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Teacher sets member limit (1-50, optional) at group creation and edits name+limit later; card shows `n/limit คน` + `เต็ม` pill | ✓ VERIFIED | `createGroup`/`updateGroup` in `src/server/actions/group.ts` accept `maxMembers` (zod 1-50 nullable); `group-card.tsx` renders `capacityLabel(memberCount, effectiveGroupLimit(...))` and `PILL_FULL` |
| 2 | assignStudent/moveStudent/joinGroup/student self-create enforce effective limit in a transaction, return Thai error, never overflow | ✓ VERIFIED | `insertMemberWithLimit` (group.ts) does `SELECT ... FOR UPDATE` + count + `effectiveGroupLimit` check inside `db.transaction`, throws `GroupRuleError` with Thai message caught by `ruleError` → `ActionResult` |
| 3 | Teacher classroom page has "นักเรียน" tab (default when unassigned students exist), unassigned list with assign/bulk, assigned list with move/remove, searchable | ✓ VERIFIED | `src/components/classroom/student-roster.tsx` (468 lines) implements chips, search (name+email), unassigned section with per-row + bulk assign, assigned-by-group section with move/remove/OverflowMenu; teacher classroom page defaults tab to `students` when unassigned exist |
| 4 | self_join lets groupless student join non-full group; self_create also create; leave allowed with no submissions; teacher mode shows waiting card | ✓ VERIFIED | `StudentGroupPicker` (join + create-when-self_create, full button disabled); `canStudentLeaveGroup`/`leaveGroup` block when `groupHasSubmissions`; student classroom page shows waiting card when `groupMode==='teacher'` |
| 5 | After joining via invite code, student lands on `/student/classroom/[id]` | ✓ VERIFIED | `join/[code]/page.tsx` redirects to `/student/classroom/${classroomId}` on success; `join-code-input.tsx` does `router.push` to the same route |
| 6 | Teachers can delete groups, archived phases, to-dos (one/all copies), classrooms (archive/restore + permanent delete), rename custom templates; every destructive action uses one shared ConfirmDialog with consequences + type-to-confirm when submissions exist (always for classroom) | ✓ VERIFIED | `deleteGroup`, `deletePhase` (archived-only), `deleteTodo` (allCopies), `deleteClassroom` (`alwaysRequire: true`), `updateTemplate`/`deleteTemplate` all exist and use `checkDeleteConfirmation`; single `ConfirmDialog` component used by `delete-group-button.tsx`, `archived-phase-list.tsx`, `todo-item.tsx`, `template-picker.tsx`, `student-roster.tsx`, `classroom-danger-zone.tsx`; no stray `AlertDialogContent` usage elsewhere |
| 7 | Every teacher mutation in classroom/group/phase/todo/template authorizes via assertClassroomEditor (owner, teacher member, or superadmin) — not role alone | ✓ VERIFIED | Manually read all exported functions in `classroom.ts`, `group.ts`, `phase.ts`, `todo.ts`, `template.ts`, `impact.ts` — every teacher-role mutation calls `assertClassroomEditor`/`assertGroupEditor`/`assertPhaseEditor`/`assertTodoEditor` or (deleteGroup/impact 'group') `authorizeGroupDelete`; `authz-coverage.test.ts` statically enforces this and passes; `grep "eq(classrooms.createdBy" src/server/actions` is empty |
| 8 | R2 objects of deleted submissions/attachments removed best-effort after commit, never throw when R2 env missing | ✓ VERIFIED | `collectFileKeys` runs inside delete transactions (groupId/phaseId/todoId/classroom scope) before DELETE; `cleanupR2Objects` called after commit in all four delete actions; `r2-cleanup.test.ts` passes (12/12 vitest files green, includes this suite) |
| 9 | Migration script exists, run with --dry-run ONLY, no write ever hit DATABASE_URL | ✓ VERIFIED | `src/db/migrations/2026-10-04-group-limits-and-mode.ts` exists with `ADD COLUMN IF NOT EXISTS`; no-flag run exits 1 (re-verified this session); SUMMARY documents exact `--dry-run` output with unchanged row counts; this verification session did NOT run `--dry-run`, `--apply`, drizzle-kit, or any DB write, per the hard rule |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/db/migrations/2026-10-04-group-limits-and-mode.ts` | Additive dry-run/apply migration | ✓ VERIFIED | Contains `ADD COLUMN IF NOT EXISTS`; no-flag exits 1 (re-checked) |
| `src/lib/group-rules.ts` | Pure helpers | ✓ VERIFIED | Exports `GROUP_MODES`, `effectiveGroupLimit`, `isGroupFull`, `canStudentJoinGroup`, `canStudentLeaveGroup`, `canStudentCreateGroup`, `checkDeleteConfirmation`, plus `canDeleteGroup`, `limitWarning`, `capacityLabel`, `groupFullError` |
| `src/lib/classroom-access.ts` | Pure decideClassroomAccess | ✓ VERIFIED | Exports `decideClassroomAccess`, used by `assertClassroomEditor` in phase-helpers.ts |
| `src/server/phase-helpers.ts` | assertClassroomEditor extended + wrappers + R2 cleanup | ✓ VERIFIED | Contains `assertGroupEditor`, `assertPhaseEditor`, `assertTodoEditor`, `authorizeGroupDelete`, `collectFileKeys`, re-exports `cleanupR2Objects` |
| `src/server/__tests__/authz-coverage.test.ts` | Static guard | ✓ VERIFIED | Exists, passes; scans classroom/group/phase/todo/template/impact.ts |
| `src/components/cocoon/confirm-dialog.tsx` | Single shared destructive confirm dialog | ✓ VERIFIED | Exports `ConfirmDialog`; used by 6 components, no competing AlertDialogContent usage |
| `src/components/classroom/student-roster.tsx` | นักเรียน roster tab | ✓ VERIFIED | 468 lines, implements assign/move/remove/bulk/search as specified |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/server/actions/*.ts` teacher mutations | `assertClassroomEditor` in phase-helpers.ts | direct call or assert(Group\|Phase\|Todo)Editor wrappers | ✓ WIRED | Verified by manual read of all exports in classroom/group/phase/todo/template/impact.ts and by passing `authz-coverage.test.ts` |
| `assignStudent`/`moveStudent`/`joinGroup`/`createGroupAsStudent` | `effectiveGroupLimit` in group-rules.ts | row lock (`FOR UPDATE`) + count inside `db.transaction` | ✓ WIRED | `insertMemberWithLimit` and `joinGroup`'s inline lock-and-check both call `effectiveGroupLimit` inside a `db.transaction` with `.for('update')` |
| `delete*` actions | `deleteObject` in `src/lib/r2.ts` (via `cleanupR2Objects`) | `cleanupR2Objects(keys)` after transaction resolves | ✓ WIRED | `deleteGroup`, `deletePhase`, `deleteTodo`, `deleteClassroom` all call `collectFileKeys` inside the tx and `cleanupR2Objects` after `await db.transaction(...)` resolves |
| `student-roster.tsx` | `assignStudent`/`moveStudent`/`removeFromGroup`/`removeStudent` | server action calls + toast + `router.refresh()` | ✓ WIRED | All four handlers call the respective action, show toast, call `router.refresh()` on success |
| student classroom page | `StudentGroupPicker` | rendered when `classroom.groupMode !== 'teacher'` and no group | ✓ WIRED | `page.tsx`: `groupMode === 'teacher' ? waitingCard : <StudentGroupPicker groupMode={groupMode} ... />` after redirecting away if the student already has a group |

### Authorization Deep-Dive (focus of this verification)

Read every exported function in `src/server/actions/{classroom,group,phase,todo,template,impact}.ts`:

- **classroom.ts**: `createClassroom` (no classroom yet, allowlisted), `joinByCode` (student-only, no classroom-editor needed), `addStudent`/`updateClassroomSettings`/`regenerateInviteCode`/`removeStudent`/`setClassroomArchived`/`deleteClassroom` all call `assertClassroomEditor`.
- **group.ts**: `createGroup`/`updateGroup`(`assertGroupEditor`)/`assignStudent`(`assertGroupEditor`)/`moveStudent`(`assertGroupEditor` on destination)/`removeFromGroup`(`assertGroupEditor`) are teacher mutations, all gated. `deleteGroup` intentionally has no `requireRole(TEACHER)` and instead branches on `authorizeGroupDelete` → `canDeleteGroup` (classroom editor OR self_create creator with 0 submissions). `joinGroup`/`createGroupAsStudent`/`leaveGroup` are student actions gated by `lockClassroomStudent` (classroom_members role check) rather than assertClassroomEditor — correct, since students are not classroom editors.
- **phase.ts**: `createPhase`/`updatePhase`/`reorderPhases`/`archivePhase`/`restorePhase`/`setGroupPhaseStatus`/`deletePhase` all call `assertClassroomEditor` or `assertPhaseEditor`.
- **todo.ts**: `createTodo`/`updateTodo`/`reorderTodos`/`archiveTodo`/`restoreTodo`/`deleteTodo` all call `assertClassroomEditor`/`assertPhaseEditor`/`assertTodoEditor` (closing the 261003-wuo gap on updateTodo/archiveTodo/restoreTodo). `getAttachmentDownloadUrl` has no classroom-membership check at all (any authenticated user can fetch any attachment's presigned URL if they know the attachment id) — pre-existing behavior, not a teacher mutation, out of this task's stated scope, flagged below as a note rather than a gap.
- **template.ts**: `applyTemplate`/`saveAsTemplate` call `assertClassroomEditor`; `deleteTemplate`/`updateTemplate` check `template.createdBy === userId` (allowlisted template-owner pattern, matches plan).
- **impact.ts**: `getDeletionImpact` branches by `kind`, each branch calls the matching assert*Editor or `authorizeGroupDelete`.

`authz-coverage.test.ts` statically enforces the above and passed (149/149 vitest tests overall, 12 files).

No `eq(classrooms.createdBy, …)` inline ownership check remains anywhere in `src/server/actions` (grep confirmed empty).

### Email exposure check (student paths)

- `getClassroomById` (server-side) resolves full `MemberDisplay` (name, email, imageUrl) via `getUserDirectory` for both classroom members and group members — this is correct for the **teacher** roster/group-card use.
- The **student** classroom page (`/student/classroom/[classroomId]/page.tsx`) strips this down before passing to the client: `members: g.members.map((m) => ({ name: m.name, imageUrl: m.imageUrl }))` — no `email` field reaches `StudentGroupPicker`.
- The **student** group page does not pass `group.members` to any client component at all (used only server-side for the "is this my group" access check).
- `StudentGroupActions` and `StudentGroupPicker` prop types (`PickerGroup.members: {name, imageUrl}[]`) contain no email field.
- **No student-reachable path exposes classmates' emails.**

### Behavioral / Build Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean (exit 0) |
| `npx vitest run` | 12 files, 149 tests passed |
| `npx eslint .` | 10 errors, 5 warnings (baseline unchanged) |
| `npm run build` | succeeded, 24 routes generated |
| `grep "eq(classrooms.createdBy" src/server/actions` | empty |
| `grep "/teacher/classrooms/\|/student/classrooms/" src/server` | empty |
| Migration no-flag run | prints usage, exit 1 |
| Stray `AlertDialogContent` outside ui/confirm-dialog/invite-code-display | none found |
| `git status --short` | clean (all work committed through 9b84193) |
| Migration `--dry-run` / `--apply` / drizzle-kit / seeds | **NOT run this session** (hard rule — shared live DATABASE_URL); SUMMARY.md documents a prior `--dry-run` run with exact output and unchanged row counts |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUICK-261004-02p | 261004-02p-PLAN.md | All 9 must-have truths above | ✓ SATISFIED | See Observable Truths table |

### Anti-Patterns Found

None found that block the goal. Minor note (not a gap, pre-existing / out-of-scope):

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `src/server/actions/todo.ts:getAttachmentDownloadUrl` | No classroom-membership check before issuing a presigned download URL | ℹ️ Info | Pre-existing behavior unrelated to the teacher-mutation authorization scope of this task; any authenticated user who knows/guesses an attachment id can download it. Not part of this task's stated must-haves (teacher mutations) but worth a future follow-up. |

### Human Verification Required

1. **Manual UI checklist (SUMMARY.md "Manual verification checklist")** — Test: walk through roster assign/bulk/move/remove, group limit + เต็ม pill, group/phase/todo/classroom delete with type-to-confirm, settings group_mode switch, student picker join/create/leave, invite join redirect, and cross-classroom-teacher denial in a running app. Expected: all items behave as described. Why human: requires a live session (Clerk auth, browser, toasts, navigation) that static code inspection cannot exercise.
2. **Migration `--apply` + `drizzle-kit push` no-op check** — Test: following the SUMMARY's orchestrator steps, run `--apply` right before deploy, verify "APPLIED — committed" and that a second run says "already migrated", then confirm `drizzle-kit push` reports no changes. Expected: schema in sync, no destructive prompt accepted. Why human: this verification session is forbidden from running any write against the shared live-site DATABASE_URL (hard rule), so this step must be done by the user/orchestrator outside this session.

### Gaps Summary

No gaps found. All 9 must-have truths, all 7 required artifacts, and all 5 key links verified against the actual codebase (not just SUMMARY claims). tsc, vitest (149/149), eslint (baseline 10/5), and `npm run build` all pass. Authorization was independently re-derived by reading every exported action function rather than trusting the authz-coverage test alone, and the only gap-adjacent item (`getAttachmentDownloadUrl` missing a membership check) is explicitly outside this task's stated scope (teacher mutations only) and is noted as information, not a blocker. Two items are routed to human verification because they require either a live browser session or a write against the shared production database, both of which are outside what this automated verification is permitted or able to do.

---

_Verified: 2026-10-04T02:39:57Z_
_Verifier: Claude (gsd-verifier)_
