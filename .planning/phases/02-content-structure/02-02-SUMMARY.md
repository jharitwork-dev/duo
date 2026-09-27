---
phase: 02-content-structure
plan: "02"
subsystem: api
tags: [drizzle, server-actions, zod, soft-delete, templates, crud]

# Dependency graph
requires:
  - phase: 02-content-structure/01
    provides: isArchived columns on phases/todos, phaseTemplates table, classrooms/groups schema
provides:
  - Phase CRUD actions (create, update, reorder, archive, restore)
  - Todo CRUD actions (create, update, reorder, archive, restore)
  - Template actions (apply, saveAs, delete)
  - Phase/Todo query helpers with isArchived filtering
  - Template query helpers (built-in + user templates)
  - 4 built-in template seeds with Thai content
affects: [02-content-structure/03, 02-content-structure/04, 02-content-structure/05]

# Tech tracking
tech-stack:
  added: []
  patterns: [transactional-reorder, soft-delete-filtering, template-json-structure, upsert-seed]

key-files:
  created:
    - src/server/actions/phase.ts
    - src/server/actions/todo.ts
    - src/server/actions/template.ts
    - src/server/queries/phase.ts
    - src/server/queries/todo.ts
    - src/server/queries/template.ts
    - src/db/seed/templates.ts
  modified: []

key-decisions:
  - "Template structure stored as JSON string in phaseTemplates.structure column"
  - "First phase in group auto-set to 'active', rest 'locked' on creation and template apply"
  - "Reorder operations use db.transaction for atomic orderIndex updates"
  - "getTodoDetail verifies access through classroom membership chain"

patterns-established:
  - "Transactional reorder: verify IDs belong to parent + not archived, then update in transaction"
  - "Soft-delete pattern: archive/restore toggle isArchived, queries filter by default"
  - "Template JSON structure: { phases: [{ name, description?, todos: [{ title, submissionMode? }] }] }"

requirements-completed: [PHASE-01, PHASE-02, PHASE-03, PHASE-04, TODO-01, TODO-02, TODO-03, TODO-04]

# Metrics
duration: 3min
completed: 2026-09-27
---

# Phase 2 Plan 02: Phase/Todo Actions + Templates Summary

**Phase and todo CRUD with transactional reorder, soft-delete archive/restore, template apply/save system, and 4 built-in Thai curriculum templates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-27T08:59:17Z
- **Completed:** 2026-09-27T09:02:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 5 phase actions (create, update, reorder, archive, restore) and 5 todo actions with Zod validation and role-based auth
- 3 template actions (applyTemplate, saveAsTemplate, deleteTemplate) with ownership and built-in protection
- 6 query helpers with automatic isArchived filtering and classroom membership access verification
- 4 built-in templates seeded: Market Research, Product Development, Pitch Preparation, Business Model Canvas with Thai phase/todo names

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase + Todo Server Actions and Query Helpers** - `b40ebf1` (feat)
2. **Task 2: Template Actions + Seed 4 Built-in Templates** - `bb1fc69` (feat)

## Files Created/Modified
- `src/server/actions/phase.ts` - Phase CRUD: create, update, reorder (transactional), archive, restore
- `src/server/actions/todo.ts` - Todo CRUD: create, update, reorder (transactional), archive, restore
- `src/server/actions/template.ts` - Template apply, saveAs, delete with built-in protection
- `src/server/queries/phase.ts` - getActivePhases, getPhaseById, getArchivedPhases with isArchived filter
- `src/server/queries/todo.ts` - getActiveTodos, getTodoById, getTodoDetail with access chain verification
- `src/server/queries/template.ts` - getTemplates (built-in + user), getTemplateById with parsed structure
- `src/db/seed/templates.ts` - seedTemplates() upsert for 4 built-in templates with Thai content

## Decisions Made
- Template structure stored as JSON string matching TemplateStructure type for flexible schema
- First phase auto-set to 'active' on creation (orderIndex 0) and on template apply
- Reorder verifies all IDs belong to parent entity and are not archived before transactional update
- getTodoDetail traverses todo -> phase -> group -> classroom -> classroomMember for access verification
- Seed uses name-based existence check for idempotent upsert

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all actions, queries, and seed data are fully implemented.

## Next Phase Readiness
- All Phase/Todo/Template actions ready for Wave 2 UI plans
- Query helpers provide filtered data for teacher and student views
- Template system ready for empty-group state template picker UI
- Seed function ready to run: `npx tsx src/db/seed/templates.ts`

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (b40ebf1, bb1fc69) verified in git log.

---
*Phase: 02-content-structure*
*Completed: 2026-09-27*
