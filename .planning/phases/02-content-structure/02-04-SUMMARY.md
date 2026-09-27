---
phase: 02-content-structure
plan: "04"
subsystem: ui
tags: [dnd-kit, sortable, collapsible, inline-edit, drag-and-drop, phases, todos]

requires:
  - phase: 02-content-structure
    provides: Phase/todo server actions (02-02), group queries (02-01)
provides:
  - Group page with draggable collapsible phase outline
  - Inline add/edit for phases and todos
  - Drag-and-drop reorder for phases and todos
  - Phase edit form (name, description, deadline, free-access)
  - Todo edit form (title, notes, submission mode, deadline, attachments placeholder)
affects: [02-05-templates, 03-submissions, 04-review, student-views]

tech-stack:
  added: []
  patterns:
    - "DragDropProvider with useSortable for sortable lists"
    - "Nested DnD providers with distinct group identifiers"
    - "Server Component data fetch -> Client Component interactive UI"
    - "Inline add pattern with input expansion"
    - "Auto-save on blur + explicit save button"

key-files:
  created:
    - src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/components/phase/phase-list.tsx
    - src/components/phase/phase-item.tsx
    - src/components/phase/phase-edit-form.tsx
    - src/components/phase/inline-add-phase.tsx
    - src/components/todo/todo-list.tsx
    - src/components/todo/todo-item.tsx
    - src/components/todo/todo-edit-form.tsx
    - src/components/todo/inline-add-todo.tsx
  modified: []

key-decisions:
  - "Nested DragDropProvider per phase with distinct group IDs to prevent cross-level DnD interference"
  - "Manual array splice for reorder instead of @dnd-kit/helpers move (not installed)"
  - "Attachments section as placeholder -- upload wired when R2 integration in Phase 3"

patterns-established:
  - "Collapsible outline: PhaseItem wraps Collapsible with drag handle + expand trigger"
  - "Inline add: Button expands to input + confirm/cancel, collapses on success"
  - "DnD reorder: Optimistic local state update + server action persist + router.refresh()"

requirements-completed: [PHASE-01, PHASE-02, PHASE-03, PHASE-04, TODO-01, TODO-02, TODO-03, TODO-04]

duration: 4min
completed: 2026-09-27
---

# Phase 2 Plan 4: Group Phase/Todo Management Summary

**Draggable collapsible phase outline with inline add/edit and nested todo management using @dnd-kit/react sortable**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-27T09:07:39Z
- **Completed:** 2026-09-27T09:11:16Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Group page with Server Component data fetching and access verification
- Draggable, collapsible phase list with inline add and expand-to-edit
- Nested todo management with per-phase drag-and-drop reorder
- Todo edit form with plain text notes, submission mode select, deadline picker, and attachments placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Group Phase Management Page with Collapsible Outline + DnD** - `792e716` (feat)
2. **Task 2: Inline Todo Management within Phases** - `691ae55` (feat)

## Files Created/Modified
- `src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx` - Server Component page fetching group + phases
- `src/components/phase/phase-list.tsx` - DragDropProvider wrapper for phase reorder
- `src/components/phase/phase-item.tsx` - Sortable collapsible phase with actions dropdown
- `src/components/phase/phase-edit-form.tsx` - Inline form with name, description, deadline, free-access toggle
- `src/components/phase/inline-add-phase.tsx` - Inline add button that expands to input
- `src/components/todo/todo-list.tsx` - Nested DragDropProvider for per-phase todo reorder
- `src/components/todo/todo-item.tsx` - Sortable collapsible todo with actions dropdown
- `src/components/todo/todo-edit-form.tsx` - Inline form with title, notes (plain text), submission mode, deadline, attachments
- `src/components/todo/inline-add-todo.tsx` - Inline add with title input + submission mode select

## Decisions Made
- Used nested DragDropProvider with distinct group identifiers (`phases` vs `todos-{phaseId}`) to prevent cross-level drag interference
- Used manual array splice for reorder state management since `@dnd-kit/helpers` `move` utility was not installed
- Attachments section rendered as placeholder -- full R2 upload integration deferred to Phase 3 (file submissions)
- Plain text Textarea for notes per D-12 decision (no Tiptap/rich text)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

1. **Attachments upload placeholder** - `src/components/todo/todo-edit-form.tsx` line ~155 - Dashed border box saying "upload when R2 connected". R2 presigned URL infrastructure exists in `src/lib/r2.ts` but wiring to this UI is Phase 3 scope.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase/todo UI complete, ready for template system (02-05)
- Attachments upload wiring needed in Phase 3 (submissions)
- Student-facing views will reuse these components with read-only mode

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (792e716, 691ae55) found in git log.

---
*Phase: 02-content-structure*
*Completed: 2026-09-27*
