---
phase: 02-content-structure
plan: 05
subsystem: ui
tags: [next.js, server-components, student-view, todo-detail, template-picker, r2-presigned, collapsible]

# Dependency graph
requires:
  - phase: 02-content-structure (plans 01-04)
    provides: queries (getStudentClassrooms, getStudentGroup, getActivePhases, getTodoDetail, getTemplates), actions (joinByCode, applyTemplate), DB schema
provides:
  - Student home with auto-redirect for single classroom/group
  - Student classroom page with group redirect or waiting state
  - Student group phase view (read-only collapsible phases with todo links)
  - Todo detail page with notes, attachments, submission/past-submission placeholders
  - Join route for invite codes
  - Template picker for empty groups (built-in + custom)
  - Attachment download via R2 presigned URLs
affects: [03-submissions, 04-review]

# Tech tracking
tech-stack:
  added: []
  patterns: [render-prop-for-link-buttons, server-component-redirect-flow, collapsible-phase-sections]

key-files:
  created:
    - src/app/(dashboard)/student/classroom/[classroomId]/page.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/app/(dashboard)/todo/[todoId]/page.tsx
    - src/app/(dashboard)/join/[code]/page.tsx
    - src/components/student/classroom-cards.tsx
    - src/components/student/join-code-input.tsx
    - src/components/student/group-phase-view.tsx
    - src/components/todo/todo-detail.tsx
    - src/components/todo/todo-attachments-list.tsx
    - src/components/template/template-picker.tsx
  modified:
    - src/app/(dashboard)/student/page.tsx
    - src/server/actions/todo.ts

key-decisions:
  - "Student home uses server-side redirect for single classroom (not client-side) to avoid flash"
  - "Group phase view uses Collapsible from shadcn with locked phases non-expandable"
  - "Attachment download uses server action to generate presigned GET URL then opens in new tab"
  - "Template picker separates built-in and custom templates with visual divider"

patterns-established:
  - "Server component redirect chain: fetch -> condition -> redirect() for student navigation"
  - "Read-only phase view: Collapsible sections with status badges and todo links"
  - "R2 download pattern: server action getAttachmentDownloadUrl -> presignGet -> window.open"

requirements-completed: [CLASS-03, GRP-03, GRP-04, TODO-04]

# Metrics
duration: 4min
completed: 2026-09-27
---

# Phase 2 Plan 5: Student-Facing UI & Todo Detail Summary

**Student navigation with auto-redirect, read-only group phase view, todo detail page with attachments, join route, and template picker for empty groups**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-27T09:13:10Z
- **Completed:** 2026-09-27T09:17:35Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 12

## Accomplishments
- Student home handles 0/1/multiple classrooms with proper auto-redirect avoiding redirect loops
- Group phase view shows locked/active/completed phases as collapsible sections with todo links
- Todo detail page renders teacher notes, downloadable attachments, and submission/past-submission placeholders
- Join route processes invite codes with error handling
- Template picker enables teachers to bootstrap empty groups with built-in or custom templates

## Task Commits

Each task was committed atomically:

1. **Task 1: Student Home + Classroom View + Join Route** - `7672637` (feat)
2. **Task 2: Todo Detail Page + Student Group Phase View + Template Picker** - `d9375aa` (feat)
3. **Task 2 fix: base-ui Button render prop** - `9e9fec6` (fix)

## Files Created/Modified
- `src/app/(dashboard)/student/page.tsx` - Student home with 0/1/multi classroom routing
- `src/app/(dashboard)/student/classroom/[classroomId]/page.tsx` - Classroom redirect to group or waiting state
- `src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx` - Group phase view page
- `src/app/(dashboard)/todo/[todoId]/page.tsx` - Todo detail with notes, attachments, placeholders
- `src/app/(dashboard)/join/[code]/page.tsx` - Invite code join flow
- `src/components/student/classroom-cards.tsx` - Grid of classroom cards for multi-classroom students
- `src/components/student/join-code-input.tsx` - Inline join code input form
- `src/components/student/group-phase-view.tsx` - Read-only collapsible phase/todo outline
- `src/components/todo/todo-detail.tsx` - Teacher notes display component
- `src/components/todo/todo-attachments-list.tsx` - Downloadable attachment rows with R2 presigned URLs
- `src/components/template/template-picker.tsx` - Template selection grid for empty groups
- `src/server/actions/todo.ts` - Added getAttachmentDownloadUrl server action

## Decisions Made
- Used server-side redirect() in student home instead of client-side router.push to avoid FOUC
- Used base-ui render prop (not Radix asChild) for polymorphic Button+Link, per project convention
- Template picker shows built-in templates first, then custom templates, separated by a divider
- Attachment downloads open presigned URL in new tab rather than using fetch+blob for simplicity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used render prop instead of asChild on Button component**
- **Found during:** Task 2 (build verification)
- **Issue:** Project uses base-ui Button which does not support asChild prop (project convention uses render prop)
- **Fix:** Replaced `<Button asChild><Link>` with `<Button render={<Link />}>` pattern
- **Files modified:** src/app/(dashboard)/todo/[todoId]/page.tsx, src/app/(dashboard)/join/[code]/page.tsx
- **Verification:** Build check passes for new files (no new TS errors)
- **Committed in:** 9e9fec6

**2. [Rule 2 - Missing Critical] Added getAttachmentDownloadUrl server action**
- **Found during:** Task 2 (attachment component implementation)
- **Issue:** No existing server action for generating presigned download URLs for attachments
- **Fix:** Added getAttachmentDownloadUrl to src/server/actions/todo.ts using presignGet from r2.ts
- **Files modified:** src/server/actions/todo.ts
- **Verification:** Component references the action correctly
- **Committed in:** d9375aa

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Known Stubs
- `src/app/(dashboard)/todo/[todoId]/page.tsx` line ~83: Submission form placeholder text "การส่งงานจะเปิดให้ใน Phase ถัดไป" -- intentional, will be replaced in Phase 3 (submissions)
- `src/app/(dashboard)/todo/[todoId]/page.tsx` line ~91: Past submissions placeholder text "ยังไม่มีงานที่ส่ง" -- intentional, will be replaced in Phase 3 (submissions)

## Issues Encountered
- Pre-existing build errors in teacher components (classroom-settings-form, create-classroom-form, invite-code-display, assign-student-dialog, create-group-form) related to asChild usage -- out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Student can now navigate from home to group to todo detail page
- Todo detail page has placeholder sections ready for Phase 3 submission form integration
- Template picker enables fast group bootstrapping for teachers
- Phase 3 (submissions) can wire submission form into the todo detail page's placeholder section

## Self-Check: PASSED

All 11 created/modified files verified present. All 3 commits verified in git log.

---
*Phase: 02-content-structure*
*Completed: 2026-09-27*
