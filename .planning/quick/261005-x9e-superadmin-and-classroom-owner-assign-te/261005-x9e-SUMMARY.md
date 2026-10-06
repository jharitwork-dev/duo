# Quick Task 261005-x9e: Superadmin / owner assign teachers to a classroom — Summary

**Date:** 2026-10-06
**Commits:** 7612cc9 (tests), a097681 (decisions), 32f1aa8 (actions + queries), 2330462 (UI)

## What changed
- `src/lib/classroom-teachers.ts` (+ tests): `canManageClassroomTeachers` (superadmin or owner only — stricter than classroom edit access), `decideAddTeacher` (target must have global role `teacher`; rejects existing teacher / student members), `decideRemoveTeacher` (owner never removable).
- `src/server/actions/classroom.ts`: `addClassroomTeacher`, `removeClassroomTeacher` — role gate, Clerk role check on the target, unique-violation race mapped to "already a member", revalidate classroom + /teacher.
- `src/server/queries/classroom.ts`: `getTeacherClassrooms` now includes classrooms where the user is a teacher member (fixes /teacher list, dashboard, deadlines, review list); `getClassroomById(..., { allowAnyClassroom })` for superadmins + returns `owner`; new `getAllClassroomsForAdmin`.
- `src/lib/user-directory.ts`: `listApprovedTeachers()` (Clerk users with role `teacher`).
- UI: `ClassroomTeachers` card ("ครูประจำห้อง") in the classroom settings tab — owner badge, add picker + remove with confirm for owner/superadmin, read-only for teacher members. /admin gets "ห้องเรียนทั้งหมด" linking to each classroom's settings tab.

## Verification
- `npx tsc --noEmit`, eslint on touched files: clean. `vitest`: 537 passed. `npm run build`: passed.
- No schema change, no migration, no DB writes.

## Deviations
- Executor agent stalled twice after Task 1 / mid-Task 2; orchestrator finished Task 2 and Task 3 inline in the same worktree, then fast-forwarded main.
- Out of scope (unchanged): superadmin opening the per-group teacher page of a classroom they're not a member of.
