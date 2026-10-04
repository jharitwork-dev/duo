---
quick_id: 261004-iyj
status: complete
completed: 2026-10-04
key-files:
  modified:
    - src/lib/node-path.ts
    - src/lib/__tests__/node-path.test.ts
    - src/components/student/phase-stepper.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
---

# Quick 261004-iyj: Students can preview locked future phases (greyed) Summary

Locked phase circles in the student stepper now link to `?phase=<id>` and open a read-only, greyed
preview of the group's to-dos. Server-side access gates are not relaxed.

## Commits

- 681eac0 docs: plan
- 3780e38 feat: `isPhasePreview` helper; `pickDefaultPhaseId` honours an explicitly requested locked phase (default without a request is still the active phase) + tests
- 16b4414 feat: stepper circles all clickable (locked = white, grey border/text, aria-label "(ยังไม่ปลดล็อค · ดูล่วงหน้า)"); grey banner "Phase นี้ยังไม่ปลดล็อค · ดูล่วงหน้าได้ แต่ยังส่งงานไม่ได้"; unread-comment query skipped in preview

## Notes

- No query change needed: `getActivePhases(groupId)` already filters to-dos by `todos.groupId = groupId`.
- Node rendering reuses the existing locked style: `computeLockedTodoIds` locks every node of a locked
  phase, and NodePath/NodePathDesktop render locked nodes as `<div aria-disabled>` (no link, no unread or
  overdue dot, pill "ยังไม่ปลดล็อค", deadline line kept).
- `isPhaseViewable` (used by `work-page-access.ts`, `deadline-dashboard.ts`) is unchanged, so
  `/todo/[id]`, submit and comment still refuse locked phases. Teacher branch untouched.

## Checks

- tsc: clean
- eslint src: 15 problems (10 errors, 5 warnings), same as the baseline, no new ones
- npm test: 20 files, 479 tests passed
- npm run build: success

## Deviations from Plan

None.

## Manual verification

- As a student: click a locked phase circle, check the grey banner and greyed non-clickable nodes, and that the URL `?phase=` works on mobile and desktop.
- Opening `/todo/<id>` for a to-do in a locked phase still refuses access, same as before.

## Self-Check: PASSED
