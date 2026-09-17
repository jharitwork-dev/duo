---
phase: 01-foundation-auth
plan: 02
subsystem: auth
tags: [clerk, rbac, middleware, server-actions, vitest]

requires: []
provides:
  - Clerk middleware protecting dashboard routes (public: /, /sign-in, /sign-up, /api/webhooks)
  - CustomJwtSessionClaims type augmentation with metadata.role
  - requireRole() / getCurrentRole() / getCurrentUserId() auth helpers
  - ROLES constant (superadmin, teacher, teacher_pending, student)
  - Sign-in and sign-up pages with Clerk components
  - Post-signup onboarding page with role promotion (student immediate, teacher pending)
  - promoteRole() server action (unsafeMetadata -> publicMetadata promotion)
  - approveTeacher() / rejectTeacher() superadmin server actions
  - Root layout with ClerkProvider, lang="th", Toaster
affects: [01-foundation-auth, 02-content-management, 03-submissions]

tech-stack:
  added: ["@clerk/nextjs@7.9.4", "vitest@4.1.11"]
  patterns: ["Server Action auth via requireRole()", "publicMetadata role pattern", "clerkMiddleware + createRouteMatcher"]

key-files:
  created:
    - src/types/globals.d.ts
    - src/lib/constants.ts
    - src/lib/auth.ts
    - src/middleware.ts
    - src/lib/__tests__/auth.test.ts
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
    - src/app/(auth)/onboarding/page.tsx
    - src/server/actions/auth.ts
    - src/server/actions/admin.ts
    - vitest.config.ts
  modified:
    - src/app/layout.tsx

key-decisions:
  - "Role promotion via afterSignUpUrl redirect to onboarding page (not webhook) -- simpler for <100 users"
  - "Middleware is convenience redirect only; real security boundary is requireRole() in Server Actions"
  - "teacher_pending as distinct role value prevents premature teacher access"

patterns-established:
  - "Server Action auth: every action calls requireRole() or auth() at top"
  - "Role stored in publicMetadata, read via sessionClaims.metadata.role"
  - "Test pattern: mock @clerk/nextjs/server auth() for unit testing"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

duration: 10min
completed: 2026-09-17
---

# Phase 01 Plan 02: Clerk Auth & RBAC Summary

**Clerk three-role auth system (superadmin/teacher/student) with middleware route protection, requireRole() Server Action guards, post-signup role promotion, and teacher approval workflow**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-17T18:34:53Z
- **Completed:** 2026-09-17T18:45:48Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Complete Clerk auth infrastructure with type augmentation, role constants, and three auth helper functions (requireRole, getCurrentRole, getCurrentUserId)
- Middleware protecting all dashboard routes with public route matcher for auth and webhook routes
- Sign-in/sign-up pages, post-signup onboarding with automatic role promotion (students immediate, teachers pending)
- Superadmin teacher approval/rejection Server Actions with requireRole guard
- 10 passing unit tests covering all auth helper edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Clerk auth infrastructure** - `3d94799` (feat)
2. **Task 2: Auth pages and server actions** - `16bbece` (feat)

## Files Created/Modified
- `src/types/globals.d.ts` - CustomJwtSessionClaims type augmentation with UserRole
- `src/lib/constants.ts` - ROLES enum (4 values) and ROUTES constants
- `src/lib/auth.ts` - requireRole(), getCurrentRole(), getCurrentUserId() helpers
- `src/middleware.ts` - clerkMiddleware with public route matcher
- `src/lib/__tests__/auth.test.ts` - 10 unit tests for auth helpers
- `vitest.config.ts` - Vitest configuration with @ path alias
- `src/app/layout.tsx` - Updated with ClerkProvider, afterSignUpUrl, lang="th", Toaster
- `src/app/(auth)/layout.tsx` - Centered layout for auth pages
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` - Clerk SignIn component
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` - Clerk SignUp component
- `src/app/(auth)/onboarding/page.tsx` - Post-signup role promotion with Thai UI
- `src/server/actions/auth.ts` - promoteRole() server action
- `src/server/actions/admin.ts` - approveTeacher() and rejectTeacher() server actions

## Decisions Made
- Used afterSignUpUrl redirect to onboarding page instead of Clerk webhook for role promotion -- simpler architecture for <100 users
- Middleware provides convenience redirects only; requireRole() in Server Actions is the real security boundary (per AUTH-04 and CVE-2025-29927 awareness)
- teacher_pending as a distinct role value prevents new teachers from accessing teacher routes before superadmin approval

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created vitest.config.ts for test infrastructure**
- **Found during:** Task 1 (auth infrastructure)
- **Issue:** No test framework configured in the project; vitest needed config with path alias resolution
- **Fix:** Created vitest.config.ts with @ alias matching tsconfig paths
- **Files modified:** vitest.config.ts
- **Verification:** All 10 tests pass
- **Committed in:** 3d94799 (Task 1 commit)

**2. [Rule 3 - Blocking] Installed @clerk/nextjs and vitest packages**
- **Found during:** Task 1 (auth infrastructure)
- **Issue:** Fresh scaffold had no Clerk or test dependencies
- **Fix:** npm install @clerk/nextjs vitest
- **Files modified:** package.json, package-lock.json
- **Verification:** Packages resolve correctly, tests run
- **Committed in:** 3d94799 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for task completion. No scope creep.

## Issues Encountered
- node_modules had permission conflicts from parallel agent execution; resolved by re-running npm install

## User Setup Required

**External services require manual configuration.** See the plan frontmatter `user_setup` section for:
- Clerk application creation and API key configuration
- Session token customization to include publicMetadata
- Setting superadmin role for user jharit in Clerk Dashboard
- Environment variables: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY

## Known Stubs
None - all components are wired to real Clerk APIs and server actions.

## Next Phase Readiness
- Auth infrastructure complete: middleware, helpers, pages, server actions all in place
- Ready for dashboard shells (plan 01-03) to use role-based navigation
- Clerk Dashboard configuration required before runtime testing (env vars + session token customization)

## Self-Check: PASSED

All 13 files verified present. Both commit hashes (3d94799, 16bbece) found in git log. 10/10 unit tests passing.

---
*Phase: 01-foundation-auth*
*Completed: 2026-09-17*
