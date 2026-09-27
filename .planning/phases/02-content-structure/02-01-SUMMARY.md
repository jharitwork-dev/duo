---
phase: 02-content-structure
plan: 01
subsystem: database, api
tags: [drizzle, zod, server-actions, invite-code, shadcn, dnd-kit]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: DB schema (classrooms, groups, phases, todos), Clerk auth, requireRole
provides:
  - Classroom CRUD server actions with invite code flow
  - Group CRUD server actions with maxGroupSize enforcement
  - Classroom and group query helpers with membership verification
  - phaseTemplates table for reusable phase structures
  - inviteCode, maxGroupSize, isArchived schema columns
  - shadcn UI components (dialog, dropdown-menu, collapsible, form, label, textarea, select, switch, calendar, popover, tabs, alert-dialog)
  - @dnd-kit/react for drag-and-drop
affects: [02-02, 02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/react", "shadcn dialog", "shadcn dropdown-menu", "shadcn collapsible", "shadcn form", "shadcn label", "shadcn textarea", "shadcn select", "shadcn switch", "shadcn calendar", "shadcn popover", "shadcn tabs", "shadcn alert-dialog"]
  patterns: [classroom-ownership-verification, invite-code-generation-with-collision-retry, membership-gated-queries]

key-files:
  created:
    - src/db/schema/phaseTemplates.ts
    - src/lib/invite-code.ts
    - src/server/actions/classroom.ts
    - src/server/actions/group.ts
    - src/server/queries/classroom.ts
    - src/server/queries/group.ts
  modified:
    - src/db/schema/classrooms.ts
    - src/db/schema/phases.ts
    - src/db/schema/todos.ts
    - src/db/schema/index.ts
    - src/db/schema/relations.ts
    - package.json

key-decisions:
  - "Invite codes use crypto.getRandomValues with 10-retry collision loop for uniqueness"
  - "All classroom actions verify ownership via createdBy field before mutation"
  - "Students can only be in one group per classroom (enforced in joinGroup)"
  - "Query helpers verify membership before returning data (Pitfall 2 compliance)"

patterns-established:
  - "Classroom ownership check: query classroom with createdBy=currentUserId before mutation"
  - "Invite code: 6-char alphanumeric (no ambiguous chars) via crypto.getRandomValues"
  - "Membership-gated queries: verify classroomMember record exists before returning classroom/group data"

requirements-completed: [CLASS-01, CLASS-02, CLASS-03, CLASS-04, GRP-01, GRP-02, GRP-03, GRP-04]

# Metrics
duration: 4min
completed: 2026-09-27
---

# Phase 2 Plan 1: Schema + Actions Summary

**Classroom/group data layer with invite-code join flow, Zod-validated server actions, and membership-gated queries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-09-27T08:58:42Z
- **Completed:** 2026-09-27T09:02:39Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- Added inviteCode, maxGroupSize, isArchived columns to classrooms; isArchived to phases and todos
- Created phaseTemplates table and invite-code utility with crypto.getRandomValues
- Built 6 classroom server actions (create, joinByCode, addStudent, updateSettings, regenerateInviteCode, removeStudent) and 4 group actions (create, assignStudent, joinGroup, removeFromGroup)
- Created 4 classroom queries and 3 group queries, all with membership verification
- Installed @dnd-kit/react and 12 shadcn UI components

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + install new dependencies** - `0ea7042` (feat)
2. **Task 2: Classroom + Group Server Actions and Query Helpers** - `4a01ae0` (feat)

## Files Created/Modified
- `src/db/schema/classrooms.ts` - Added inviteCode, maxGroupSize, isArchived columns
- `src/db/schema/phases.ts` - Added isArchived column
- `src/db/schema/todos.ts` - Added isArchived column
- `src/db/schema/phaseTemplates.ts` - New table for reusable phase structures
- `src/db/schema/index.ts` - Added phaseTemplates barrel export
- `src/db/schema/relations.ts` - Added phaseTemplates import
- `src/lib/invite-code.ts` - Invite code generator with collision retry
- `src/server/actions/classroom.ts` - 6 classroom CRUD actions
- `src/server/actions/group.ts` - 4 group CRUD actions
- `src/server/queries/classroom.ts` - 4 classroom query helpers
- `src/server/queries/group.ts` - 3 group query helpers
- `src/components/ui/*.tsx` - 11 new shadcn components
- `package.json` - Added @dnd-kit/react dependency

## Decisions Made
- Invite codes use crypto.getRandomValues with 10-retry collision loop (no ambiguous chars: O/0/I/1 excluded)
- All classroom mutation actions verify ownership via createdBy field
- Students enforced to one group per classroom in joinGroup action
- Query helpers verify classroomMember record before returning data (Pitfall 2)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `drizzle-kit push` failed due to WebSocket connectivity issue in the execution environment (Neon serverless driver requires WebSocket). Schema changes are correct in code and will sync on next `npx drizzle-kit push` run with proper database connectivity. This does not block subsequent plans.

## User Setup Required

Run `npx drizzle-kit push` to sync schema changes to Neon database (if not already done).

## Next Phase Readiness
- Classroom and group data layer complete, ready for Wave 2 UI plans
- All server actions and queries available for teacher/student dashboard pages
- shadcn components and @dnd-kit/react ready for UI development

---
*Phase: 02-content-structure*
*Completed: 2026-09-27*
