---
phase: 01-foundation-auth
plan: 03
subsystem: ui, auth, infra
tags: [clerk, r2, aws4fetch, thai-localization, sidebar, dashboard, nextjs, base-ui]

# Dependency graph
requires:
  - phase: 01-foundation-auth/01-01
    provides: "Neon DB schema (10 tables), Drizzle ORM setup"
  - phase: 01-foundation-auth/01-02
    provides: "Clerk auth (getCurrentRole, requireRole, getCurrentUserId), constants (ROLES, ROUTES), middleware, onboarding, admin server actions"
provides:
  - "R2 presigned URL infrastructure (presignPut, presignGet, deleteObject, validateFile, submissionKey, attachmentKey)"
  - "Thai date formatting utilities (formatDate, formatDateShort, formatDateTime with Buddhist Era)"
  - "Dashboard layout with role-based sidebar navigation"
  - "Teacher dashboard shell (/teacher)"
  - "Student dashboard shell (/student)"
  - "Admin teacher approval page (/admin)"
  - "Landing page with role-based redirect"
affects: [02-classroom-content, 03-submissions, 04-review-feedback]

# Tech tracking
tech-stack:
  added: [aws4fetch]
  patterns: [base-ui render prop for polymorphic components, Intl.DateTimeFormat('th-TH') for Buddhist Era dates, requireRole() Server Component guards, Clerk Backend API for user listing]

key-files:
  created:
    - src/lib/r2.ts
    - src/lib/format.ts
    - src/lib/__tests__/format.test.ts
    - src/components/app-sidebar.tsx
    - src/components/user-nav.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/teacher/page.tsx
    - src/app/(dashboard)/student/page.tsx
    - src/app/(dashboard)/admin/page.tsx
    - src/app/(dashboard)/admin/admin-actions.tsx
  modified:
    - src/app/page.tsx
    - src/app/layout.tsx

key-decisions:
  - "base-ui render prop instead of Radix asChild for polymorphic Button/SidebarMenuButton rendering"
  - "ClerkProvider signUpFallbackRedirectUrl instead of deprecated afterSignUpUrl for Clerk v7"
  - "Admin page uses Clerk Backend API getUserList to fetch pending teachers (no local users table)"

patterns-established:
  - "render prop pattern: <Button render={<Link href='...' />}> for base-ui polymorphic components"
  - "requireRole() guard at top of every Server Component dashboard page"
  - "Thai UI strings hardcoded directly in components (no i18n library per D-13)"
  - "Intl.DateTimeFormat('th-TH') module-level singletons for date formatting"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, L10N-01, L10N-02]

# Metrics
duration: 3min
completed: 2026-09-17
---

# Phase 1 Plan 3: Dashboard Shells, R2 Infrastructure, and Thai Localization Summary

**Role-based dashboard shells (teacher/student/admin) with Thai UI, R2 presigned URL helpers via aws4fetch, and Buddhist Era date formatting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-17T18:47:56Z
- **Completed:** 2026-09-17T18:51:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 12

## Accomplishments
- R2 presigned URL infrastructure ready for Phase 3 submissions (presignPut, presignGet, deleteObject, validateFile with 50MB limit and MIME allowlist)
- Thai date formatting utilities with Buddhist Era year using Intl.DateTimeFormat('th-TH')
- Teacher dashboard shell with Thai sidebar nav (classrooms/submissions/settings) and requireRole() guard
- Student dashboard shell with Thai sidebar nav (my classrooms/progress) and requireRole() guard
- Admin teacher approval page with Clerk Backend API integration and approve/reject server actions
- Landing page with role-based redirect for authenticated users and Thai sign-in/sign-up buttons
- All 22 tests passing, build succeeds with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: R2 presign helpers, Thai date utilities, and date format tests** - `b4ab298` (feat)
2. **Task 2: Dashboard shells -- sidebar layout, teacher/student/admin pages** - `1e9ea6e` (feat)
3. **Task 3: Verify end-to-end auth flow and dashboard shells** - auto-approved (checkpoint)

## Files Created/Modified
- `src/lib/r2.ts` - R2 presigned URL helpers (getR2Config, presignPut, presignGet, deleteObject, validateFile, submissionKey, attachmentKey)
- `src/lib/format.ts` - Thai date formatting (formatDate, formatDateShort, formatDateTime) with Buddhist Era
- `src/lib/__tests__/format.test.ts` - 8 tests for Thai dates and R2 validation
- `src/components/app-sidebar.tsx` - Role-based sidebar with Thai nav labels and Lucide icons
- `src/components/user-nav.tsx` - Clerk UserButton wrapper
- `src/app/(dashboard)/layout.tsx` - Protected dashboard layout with SidebarProvider and role check
- `src/app/(dashboard)/teacher/page.tsx` - Teacher dashboard shell with Thai welcome card
- `src/app/(dashboard)/student/page.tsx` - Student dashboard shell with Thai welcome card
- `src/app/(dashboard)/admin/page.tsx` - Admin page listing pending teachers from Clerk
- `src/app/(dashboard)/admin/admin-actions.tsx` - Client component for approve/reject buttons
- `src/app/page.tsx` - Landing page with role-based redirect and Thai CTA buttons
- `src/app/layout.tsx` - Fixed ClerkProvider prop for Clerk v7

## Decisions Made
- Used base-ui `render` prop pattern instead of Radix `asChild` -- shadcn v4 uses @base-ui/react which has different polymorphic component API
- Fixed ClerkProvider from `afterSignUpUrl` to `signUpFallbackRedirectUrl` for Clerk v7 compatibility
- Admin page fetches users via Clerk Backend API `getUserList` and filters client-side for teacher_pending role -- adequate for <100 users

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui component API mismatch (asChild -> render prop)**
- **Found during:** Task 2 (Dashboard shells)
- **Issue:** Plan specified `asChild` prop for Button and SidebarMenuButton, but shadcn v4 uses @base-ui/react which uses `render` prop instead of Radix's `asChild`
- **Fix:** Changed `<Button asChild>` to `<Button render={<Link href="..." />}>` and same for SidebarMenuButton
- **Files modified:** src/app/page.tsx, src/components/app-sidebar.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 1e9ea6e (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Clerk v7 ClerkProvider prop**
- **Found during:** Task 2 (Dashboard shells)
- **Issue:** `afterSignUpUrl` prop does not exist on ClerkProvider in Clerk v7
- **Fix:** Changed to `signUpFallbackRedirectUrl="/onboarding"` which is the v7 equivalent
- **Files modified:** src/app/layout.tsx
- **Verification:** `npx tsc --noEmit` passes, build succeeds
- **Committed in:** 1e9ea6e (Task 2 commit)

**3. [Rule 1 - Bug] Fixed Clerk v7 UserButton prop**
- **Found during:** Task 2 (Dashboard shells)
- **Issue:** `afterSignOutUrl` prop does not exist on UserButton in Clerk v7
- **Fix:** Removed the prop -- Clerk handles sign-out redirect via dashboard configuration
- **Files modified:** src/components/user-nav.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 1e9ea6e (Task 2 commit)

**4. [Rule 2 - Missing Critical] Added admin-actions.tsx client component for admin page**
- **Found during:** Task 2 (Dashboard shells)
- **Issue:** Admin page needed client-side interactivity for approve/reject buttons (useTransition, router.refresh) but page.tsx is a Server Component
- **Fix:** Created separate `admin-actions.tsx` client component with approve/reject button handling
- **Files modified:** src/app/(dashboard)/admin/admin-actions.tsx (new)
- **Verification:** Build succeeds, TypeScript clean
- **Committed in:** 1e9ea6e (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness with Clerk v7 and base-ui APIs. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required for this plan.

## Known Stubs
None - dashboard pages intentionally show empty welcome cards as specified in the plan (content will be populated in Phase 2).

## Next Phase Readiness
- Phase 1 foundation complete: auth, database schema, dashboard shells, R2 infrastructure, Thai localization
- Ready for Phase 2 (classroom-content): teacher can create classrooms, phases, and to-dos
- R2 helpers ready for Phase 3 (submissions): file upload infrastructure in place
- All 22 tests pass, build clean

---
*Phase: 01-foundation-auth*
*Completed: 2026-09-17*
