# Phase 1: Foundation & Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 01-Foundation & Auth
**Areas discussed:** Clerk role setup, DB schema scope, Dashboard shells, Thai localization

---

## Clerk Role Setup

### Q1: How do students and teachers get their roles?

| Option | Description | Selected |
|--------|-------------|----------|
| Admin assigns roles | Teacher manually adds users and assigns student/teacher role | |
| Invite codes | Teacher generates a code — students enter it at signup to join | |
| Self-select at signup | User picks 'I am a teacher' or 'I am a student' during registration | ✓ |

**User's choice:** Self-select at signup
**Notes:** None

### Q2: If students self-select, anyone could pick 'teacher'. How to handle?

| Option | Description | Selected |
|--------|-------------|----------|
| Trust it | Small user base, all known. Fix if abused. | |
| Teacher needs approval | Anyone can sign up as student, but teacher role requires admin approval | ✓ |
| Teacher invite-only | Only students self-register; teachers created by admin | |

**User's choice:** Teacher needs approval
**Notes:** None

### Q3: Who approves teacher accounts?

| Option | Description | Selected |
|--------|-------------|----------|
| You (superadmin) | You have a superadmin role and approve teacher signups manually | ✓ |
| Any existing teacher | Any approved teacher can approve new teacher accounts | |
| Clerk dashboard | Approve directly in Clerk's admin dashboard | |

**User's choice:** You (superadmin)
**Notes:** None

---

## DB Schema Scope

### Q1: Deploy full DB schema in Phase 1 or only auth-related tables?

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema | All tables: classrooms, groups, phases, todos, submissions, comments | ✓ |
| Auth only | Only user/role tables now. Add other tables in respective phases. | |

**User's choice:** Full schema (Recommended)
**Notes:** None

### Q2: How to handle Clerk user data locally?

| Option | Description | Selected |
|--------|-------------|----------|
| Clerk ID as FK | Store Clerk user ID directly as text FK. No local users table. | ✓ |
| Local users table | Sync Clerk users to local table via webhook. | |

**User's choice:** Clerk ID as FK (Recommended)
**Notes:** None

---

## Dashboard Shells

### Q1: What should the dashboard shells look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar layout | Left sidebar with nav links + main content area | ✓ |
| Top nav + cards | Horizontal nav bar at top, card-based content below | |
| You decide | Claude picks the best layout | |

**User's choice:** Sidebar layout (Recommended)
**Notes:** None

### Q2: What visual style?

| Option | Description | Selected |
|--------|-------------|----------|
| Clean & modern | shadcn/ui default — neutral colors, subtle borders, minimal | |
| Colorful & playful | Duolingo-inspired — bold colors, rounded elements | |
| Mix | Teacher side clean, student side colorful | |

**User's choice:** Other — Use Innovator's brand CI, will upload Figma reference later
**Notes:** Start with clean shadcn/ui defaults, adjust when Figma arrives

---

## Thai Localization

### Q1: How to handle Thai text in the UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded Thai | Write Thai strings directly in components. No i18n library. | ✓ |
| i18n library (next-intl) | Use next-intl with Thai locale file. | |
| Simple dict file | One TypeScript file with all Thai strings as constants. | |

**User's choice:** Hardcoded Thai (Recommended)
**Notes:** None

### Q2: How to display dates in Thai Buddhist calendar?

| Option | Description | Selected |
|--------|-------------|----------|
| Intl.DateTimeFormat | Use browser's built-in Intl API with 'th-TH' locale | ✓ |
| Custom utility | Write a date formatting helper that adds 543 manually | |

**User's choice:** Intl.DateTimeFormat (Recommended)
**Notes:** None

---

## Claude's Discretion

- Database table naming conventions
- Drizzle schema file organization
- R2 presigned URL implementation details
- Middleware vs layout-based route protection
- shadcn/ui component selection for dashboard shell

## Deferred Ideas

None — discussion stayed within phase scope
