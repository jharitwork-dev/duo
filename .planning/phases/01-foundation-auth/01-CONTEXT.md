# Phase 1: Foundation & Auth - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffolding with full database schema (all tables from classrooms through submissions), Clerk authentication with teacher/student/superadmin roles, R2 file upload infrastructure, and Thai/English localization utilities. Empty dashboard shells for both roles.

</domain>

<decisions>
## Implementation Decisions

### Clerk Role Setup
- **D-01:** Users self-select role (teacher or student) at signup
- **D-02:** Student role is immediately active after signup
- **D-03:** Teacher role requires approval from a superadmin before gaining teacher access
- **D-04:** Superadmin is the project owner (user jharit) — approves teacher signups via in-app UI
- **D-05:** Three roles total: superadmin, teacher (pending/approved), student

### Database Schema
- **D-06:** Deploy full schema in Phase 1 — all tables (classrooms, groups, phases, todos, submissions, comments, etc.) created upfront to prevent costly retrofits
- **D-07:** Use Clerk user ID as text FK directly in all tables — no local users table. Simple approach for < 100 users.
- **D-08:** Use Neon WebSocket driver (not HTTP) to support multi-statement transactions (required for approval/unlock workflows in later phases)

### Dashboard Shells
- **D-09:** Sidebar layout — left sidebar with nav links + main content area for both teacher and student views
- **D-10:** Visual style follows Innovator's brand CI — user will provide Figma reference later. Start with clean shadcn/ui defaults, adjust when Figma arrives.
- **D-11:** Teacher dashboard shell: sidebar with nav (Classrooms, Submissions, Settings), empty main area with welcome message
- **D-12:** Student dashboard shell: sidebar with nav (My Classrooms, My Progress), empty main area with welcome message

### Thai Localization
- **D-13:** Hardcoded Thai strings directly in components — no i18n library. UI is Thai-only with English technical terms mixed in naturally.
- **D-14:** Use `Intl.DateTimeFormat('th-TH')` for Thai Buddhist calendar dates — handles BE year automatically. Use consistently everywhere, no manual year arithmetic.

### Claude's Discretion
- Database table naming conventions (snake_case, singular/plural)
- Drizzle schema file organization (single file vs per-table)
- R2 presigned URL implementation details (copied from web-cocoon patterns)
- Middleware vs layout-based route protection structure
- shadcn/ui component selection for dashboard shell

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sister Project (copy patterns, don't couple)
- `~/Desktop/Innovators Tech/web-cocoon/src/cocoon/apply/r2.ts` — R2 presigned upload pattern to reuse
- `~/Desktop/Innovators Tech/web-cocoon/src/cocoon/apply/create-upload-url.ts` — Upload URL generation

### Research
- `.planning/research/STACK.md` — Locked stack decisions and library recommendations
- `.planning/research/ARCHITECTURE.md` — DB schema sketch and project structure
- `.planning/research/PITFALLS.md` — Critical pitfalls: presigned URLs, Neon WebSocket, Server Action auth, submission schema

### Project
- `.planning/PROJECT.md` — Project context, constraints, key decisions
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-04, L10N-01, L10N-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Fresh Next.js 15 scaffold — only default `src/app/page.tsx`, `layout.tsx`, `globals.css`
- No existing components, hooks, or utilities yet

### Established Patterns
- None — this is a greenfield scaffold. Phase 1 establishes all patterns.

### Integration Points
- `src/app/layout.tsx` — Clerk provider wraps here
- `src/app/` — Route groups for teacher and student dashboards

</code_context>

<specifics>
## Specific Ideas

- **Innovator's brand CI** — user will upload Figma reference for visual style. Start with clean shadcn/ui defaults and adjust later.
- **Teacher workflow:** create classroom → create starter phases/to-dos → bulk assign to all groups. Schema must support this from day 1.
- **LINE notifications** (not email) — schema should include fields for LINE user IDs if needed later, but LINE integration itself is Phase 6.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-09-17*
