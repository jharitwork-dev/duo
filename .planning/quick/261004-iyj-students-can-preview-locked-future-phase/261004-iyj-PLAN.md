---
quick_id: 261004-iyj
type: quick
autonomous: true
files_modified:
  - src/lib/node-path.ts
  - src/lib/__tests__/node-path.test.ts
  - src/components/student/phase-stepper.tsx
  - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
---

# Quick 261004-iyj: Students can preview locked future phases (greyed)

See 261004-iyj-CONTEXT.md (locked requirements).

## Findings

- `getActivePhases(groupId)` already returns every non-archived classroom phase with only THAT group's
  to-dos (`todos.groupId = groupId`) — no query change needed; no other group's data is exposed.
- `computeLockedTodoIds` already locks every node in a locked (non-free-access) phase, and both
  `NodePath` / `NodePathDesktop` render locked nodes as `<div aria-disabled>` (no link, no unread dot,
  no overdue dot, pill "ยังไม่ปลดล็อค", deadline line kept). So the preview path is the existing locked style.
- `isPhaseViewable` is also used server-side (`work-page-access.ts`, `deadline-dashboard.ts`) — it MUST
  stay unchanged so work/submit/comment access rules are not relaxed.

## Task 1: Previewable-phase helper + tests

- `src/lib/node-path.ts`: add `isPhasePreview(phase)` (= `!isPhaseViewable(phase)`, i.e. read-only
  preview). Change `pickDefaultPhaseId` so an explicitly requested phase that exists is honoured even
  when locked (preview); default without a request stays active → last completed → first.
- Tests: requested locked phase → returned; unknown → default; no request → active (not locked).
  `isPhasePreview` cases. `isPhaseViewable` unchanged.
- Verify: `npm test`.

## Task 2: Stepper + student home preview UI

- `phase-stepper.tsx`: every circle is a `Link` (`?phase=<id>`); locked (non-viewable) circles keep the
  white/grey-bordered look (grey border/text), aria-label notes "(ยังไม่ปลดล็อค · ดูล่วงหน้า)";
  selected circle gets the ring. Labels/dates unchanged.
- Group page (student branch): when the selected phase is a preview, render a grey banner
  "Phase นี้ยังไม่ปลดล็อค · ดูล่วงหน้าได้ แต่ยังส่งงานไม่ได้", skip the unread-comment query, and pass
  the existing locked set (all nodes locked). Teacher branch untouched.
- Verify: tsc, eslint src (no new errors), npm test, npm run build.
