---
phase: 01-foundation-auth
plan: 01
subsystem: database
tags: [drizzle, neon, postgres, shadcn, vitest, cuid2, websocket]

# Dependency graph
requires: []
provides:
  - Drizzle ORM client with Neon WebSocket Pool driver
  - Full database schema (10 tables across 6 domain files)
  - Centralized Drizzle relation definitions
  - shadcn/ui initialized with dashboard components
  - Vitest test runner with path aliases
  - cuid2 ID generation utility
  - Environment variable template
affects: [01-02, 01-03, 02-classroom-crud, 03-submissions]

# Tech tracking
tech-stack:
  added: ["@clerk/nextjs", "drizzle-orm", "drizzle-kit", "@neondatabase/serverless", "ws", "@paralleldrive/cuid2", "aws4fetch", "zod", "date-fns", "vitest", "shadcn/ui", "sonner", "lucide-react"]
  patterns: ["Neon WebSocket Pool for transactions", "cuid2 text PKs", "Clerk userId as text FK", "centralized relations.ts", "per-domain schema files"]

key-files:
  created:
    - src/db/index.ts
    - src/db/schema/classrooms.ts
    - src/db/schema/groups.ts
    - src/db/schema/phases.ts
    - src/db/schema/todos.ts
    - src/db/schema/submissions.ts
    - src/db/schema/comments.ts
    - src/db/schema/relations.ts
    - src/db/schema/index.ts
    - src/lib/ids.ts
    - drizzle.config.ts
    - vitest.config.ts
    - .env.example
    - components.json
  modified:
    - package.json
    - .gitignore

key-decisions:
  - "Used Neon WebSocket driver with Pool for transaction support (D-08)"
  - "All table PKs are text with cuid2 $defaultFn for URL-safe IDs"
  - "All user FKs are text referencing Clerk userId directly (D-07)"
  - "All relations centralized in relations.ts to prevent circular imports"
  - "shadcn/ui initialized with sidebar, button, card, avatar, separator, sonner, badge"

patterns-established:
  - "Schema per domain: one file per entity group (classrooms.ts, groups.ts, etc.)"
  - "Relations centralized: all Drizzle relation defs in single relations.ts file"
  - "Text PKs with cuid2: all tables use text('id').primaryKey().$defaultFn(() => createId())"
  - "Clerk userId as FK: text columns for user references, no local users table"
  - "Dual DB connection strings: DATABASE_URL (pooled, app) and DATABASE_URL_UNPOOLED (direct, migrations)"

requirements-completed: [L10N-01]

# Metrics
duration: 11min
completed: 2026-09-17
---

# Phase 01 Plan 01: Project Setup & Database Schema Summary

**Drizzle ORM with Neon WebSocket driver, full 10-table schema deployed, shadcn/ui initialized with 7 components, Vitest configured with path aliases**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-17T18:34:50Z
- **Completed:** 2026-09-17T18:46:10Z
- **Tasks:** 2
- **Files modified:** 32

## Accomplishments
- Full database schema with 10 tables (classrooms, classroom_members, groups, group_members, phases, todos, todo_attachments, submissions, submission_files, comments) and centralized relation definitions
- Drizzle client configured with Neon WebSocket Pool driver for transaction support
- shadcn/ui initialized with button, card, sidebar, avatar, separator, sonner, badge components
- Vitest test runner configured with @ path aliases, 14 tests passing
- All Phase 1 dependencies installed (clerk, drizzle, neon, cuid2, aws4fetch, zod, date-fns)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, configure environment, initialize shadcn/ui and Vitest** - `4329393` (feat)
2. **Task 2: Create full database schema and Drizzle client** - `b571daf` (feat)

## Files Created/Modified
- `src/db/index.ts` - Drizzle client with Neon WebSocket Pool driver
- `src/db/schema/classrooms.ts` - classrooms + classroom_members tables
- `src/db/schema/groups.ts` - groups + group_members tables
- `src/db/schema/phases.ts` - phases table with status enum (locked/active/completed)
- `src/db/schema/todos.ts` - todos + todo_attachments tables
- `src/db/schema/submissions.ts` - submissions + submission_files tables
- `src/db/schema/comments.ts` - comments table
- `src/db/schema/relations.ts` - All Drizzle relation definitions centralized
- `src/db/schema/index.ts` - Barrel export of all schema tables and relations
- `src/lib/ids.ts` - cuid2 ID generation wrapper (24-char)
- `drizzle.config.ts` - Drizzle Kit config using DATABASE_URL_UNPOOLED
- `vitest.config.ts` - Vitest with @ path alias
- `.env.example` - All required env vars documented
- `components.json` - shadcn/ui configuration
- `src/db/__tests__/schema.test.ts` - Schema smoke test (4 tests)

## Decisions Made
- Used Neon WebSocket driver with Pool for transaction support per D-08
- All table PKs use text with cuid2 $defaultFn for URL-safe collision-resistant IDs
- User references stored as plain text Clerk userId (no local users table, per D-07)
- All Drizzle relations centralized in single relations.ts to prevent circular imports (per Pitfall 5)
- Schema uses snake_case plural table names following PostgreSQL conventions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed .gitignore excluding .env.example**
- **Found during:** Task 1 (environment setup)
- **Issue:** The `.env*` pattern in .gitignore blocked committing .env.example
- **Fix:** Added `!.env.example` exception to .gitignore
- **Files modified:** .gitignore
- **Verification:** .env.example successfully committed
- **Committed in:** 4329393 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor gitignore fix, no scope creep.

## Issues Encountered
- npm ENOTEMPTY error during @clerk/nextjs install due to background task race condition. Resolved by retrying install after lock file cleared.

## User Setup Required

The following external services require manual configuration before the database can be deployed:

**Neon Postgres:**
1. Create a Neon project in Singapore (ap-southeast-1) region
2. Copy pooled connection string to `DATABASE_URL` in `.env.local`
3. Copy direct connection string to `DATABASE_URL_UNPOOLED` in `.env.local`
4. Run `npx drizzle-kit push` to deploy schema

**Clerk:**
1. Create a Clerk application
2. Copy publishable key and secret key to `.env.local`
3. Configure session token to include `{ "metadata": "{{user.public_metadata}}" }`

**Cloudflare R2:**
1. Create R2 bucket named `duo-uploads`
2. Copy account ID and API keys to `.env.local`

## Known Stubs

None - all schema tables are fully defined with correct column types, constraints, and foreign keys.

## Next Phase Readiness
- Database schema ready for deployment once Neon credentials configured
- shadcn/ui components available for dashboard shell (Plan 01-02)
- Vitest infrastructure ready for auth tests (Plan 01-02)
- Drizzle client ready for CRUD operations in Phase 2+

## Self-Check: PASSED

All 15 created files verified present. Both task commits (4329393, b571daf) verified in git log. 14 tests passing.

---
*Phase: 01-foundation-auth*
*Completed: 2026-09-17*
