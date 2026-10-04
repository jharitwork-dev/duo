---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Quick task 261004-fgj deployed; 261004-03i planning
last_updated: "2026-10-04T12:00:00.000Z"
last_activity: 2026-10-04
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17)

**Core value:** Teachers and student groups can plan, execute, and track project-based work through a clear phase-to-do progression -- with teacher approval gating advancement.
**Current focus:** Phase 04 — review & progression (quick tasks 261004-03i → 261004-gic → 261004-gid)

## Current Position

Phase: 4
Plan: quick 261004-03i (deadlines + dashboard) planning; next 261004-gic (review), 261004-gid (teacher attachments)
Status: In progress — phases 1, 2, 3, 5 complete via quick tasks
Last activity: 2026-10-04 - Completed + deployed quick task 261004-02p (grouping, roster, full CRUD, authz)

Progress: [███████▌░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P02 | 10min | 2 tasks | 13 files |
| Phase 01 P01 | 11min | 2 tasks | 32 files |
| Phase 01 P03 | 3min | 3 tasks | 12 files |
| Phase 02 P02 | 3min | 2 tasks | 7 files |
| Phase 02 P01 | 4min | 2 tasks | 24 files |
| Phase 02 P03 | 2min | 3 tasks | 11 files |
| Phase 02 P04 | 4min | 2 tasks | 9 files |
| Phase 02 P05 | 4min | 3 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 6 phases following data dependency chain (foundation -> content -> submissions -> review -> UI -> polish)
- [Roadmap]: Phases 5 and 6 can run in parallel after Phase 4 (no dependency between them)
- [Roadmap]: Full DB schema deployed in Phase 1 to prevent retrofit costs (per research pitfall analysis)
- [Phase 01]: Role promotion via afterSignUpUrl redirect to onboarding page (not webhook) -- simpler for <100 users
- [Phase 01]: Middleware is convenience redirect only; requireRole() in Server Actions is the real security boundary
- [Phase 01]: teacher_pending as distinct role value prevents premature teacher access before superadmin approval
- [Phase 01]: Neon WebSocket Pool driver for transaction support (D-08)
- [Phase 01]: All table PKs use text+cuid2, user FKs are plain Clerk userId text columns (D-07)
- [Phase 01]: Relations centralized in single relations.ts to prevent circular imports
- [Phase 01]: base-ui render prop instead of Radix asChild for polymorphic Button/SidebarMenuButton
- [Phase 01]: ClerkProvider signUpFallbackRedirectUrl instead of deprecated afterSignUpUrl for Clerk v7
- [Phase 01]: Admin page uses Clerk Backend API getUserList to fetch pending teachers (no local users table)
- [Phase 02]: Template structure stored as JSON string in phaseTemplates.structure column
- [Phase 02]: Reorder operations use db.transaction for atomic orderIndex updates with pre-validation
- [Phase 02]: getTodoDetail verifies access through todo->phase->group->classroom->member chain
- [Phase 02]: Invite codes use crypto.getRandomValues with 10-retry collision loop for uniqueness
- [Phase 02]: All classroom actions verify ownership via createdBy field before mutation
- [Phase 02]: Query helpers verify classroomMember record before returning data (Pitfall 2 compliance)
- [Phase 02]: Inline tab content for classroom dashboard (groups + settings) rather than separate routes
- [Phase 02]: Nested DragDropProvider with distinct group IDs for cross-level DnD isolation
- [Phase 02]: Student home uses server-side redirect for single classroom navigation
- [Phase 02]: Attachment download via server action presigned URL opened in new tab

### Pending Todos

None yet.

### Blockers/Concerns

- Neon region (Singapore/ap-southeast-1) must be verified during Phase 1 setup
- Tiptap version confidence is MEDIUM -- validate API during Phase 2
- Student uploads now go browser → R2 directly: bucket CORS must allow PUT + content-type from build.innovators.co.th and localhost
- getAttachmentDownloadUrl lacks a classroom-membership check (pre-existing)
- R2 configured 2026-10-04: bucket build-innovator-uploads (APAC), Object R&W token scoped to it, CORS for localhost:3000 + build.innovators.co.th; env set locally and on Vercel (all envs). Secret was pasted in chat — rotate the token when convenient.
- Clerk session token must include {"metadata": "{{user.public_metadata}}"} (dev instance done 2026-09-28; production instance still needs it)
- DONE 2026-10-04: classroom-phase migration applied to the shared DB; "Cocoon 2026" now uses the "Cocoon Incubation" template (3 phases, 6 to-dos per group)
- drizzle-kit push misreads this Postgres version's named NOT NULL constraints (false 'add unique constraint' prompt) — do NOT use push; apply schema changes via reviewed scripts in src/db/migrations (--dry-run/--apply)
- Node-level row locks are UI-only; server gates at phase level (TODO Phase 4)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260928-iwi | Cocoon UI redesign from Figma — student flow (shell, login, node-path home, submission) | 2026-09-28 | 98606bf | [260928-iwi-cocoon-ui-redesign-from-figma-student-fl](./quick/260928-iwi-cocoon-ui-redesign-from-figma-student-fl/) |
| 260928-jkg | Desktop (Mac) Cocoon shell + student desktop alignment + teacher/admin CI | 2026-09-28 | 3d3ea6a | [260928-jkg-apply-cocoon-ui-ci-to-teacher-and-admin-](./quick/260928-jkg-apply-cocoon-ui-ci-to-teacher-and-admin-/) |
| fast | Cocoon-branded landing page matching sign-in/sign-up | 2026-10-03 | 4b9da06 | — |
| fast | Rename product Duo → build.Innovator (title, logs, package name) | 2026-10-03 | 2817e47 | — |
| fast | Member names instead of Clerk ids + superadmin teacher/student role management | 2026-10-03 | bc420a7 | — |
| 261003-wuo | Classroom-level fixed phases, per-group tasks, multi-group assignment (full: plan-checked ×2, verified 10/10, migration applied) | 2026-10-04 | 6b814eb | [261003-wuo-classroom-level-fixed-phases-with-per-gr](./quick/261003-wuo-classroom-level-fixed-phases-with-per-gr/) |
| 261004-02p | Group member limits, student roster, self-grouping, full CRUD, classroom-teacher authz (full: checked, verified 9/9; migration applied + deployed 2026-10-04) | 2026-10-04 | 701e0c0 | [261004-02p-per-group-member-limit-student-roster-wi](./quick/261004-02p-per-group-member-limit-student-roster-wi/) |
| 261004-01i | Notion-like work page submissions, sub-todo checklist, files, teacher file requirement (full: checked, verified 9/9; migration applied + deployed 2026-10-04) | 2026-10-04 | e70e854 | [261004-01i-notion-like-work-page-submissions-with-s](./quick/261004-01i-notion-like-work-page-submissions-with-s/) |
| 261004-fgj | Task discussion thread (teacher ↔ students) + teacher "ดูงาน" links/status pills (full: checked, verified 11/11; migration applied + deployed) | 2026-10-04 | 28d1c2c | [261004-fgj-task-discussion-thread-for-teachers-and-](./quick/261004-fgj-task-discussion-thread-for-teachers-and-/) |
| 261004-03i | Deadlines (overdue/late/on-time), edit-after-submit before deadline, teacher dashboard + matrix + timeline (full: checked, executed in 3 runs, verified 10/10; no migration; deployed) | 2026-10-04 | 942fb94 | [261004-03i-clear-deadlines-with-overdue-and-late-su](./quick/261004-03i-clear-deadlines-with-overdue-and-late-su/) |
| 261004-gic | Teacher review: approve / send back, auto phase unlock, review list + detail per Figma (full: checked, verified 9/9; no migration; deployed) | 2026-10-04 | b4afa22 | [261004-gic-teacher-review-approve-reject-with-auto-](./quick/261004-gic-teacher-review-approve-reject-with-auto-/) |
| 261004-gid | Teacher file attachments on tasks (shared-key safe deletion, limits, student download) (full: checked, verified 8/8; no migration; deployed) | 2026-10-04 | 022fb89 | [261004-gid-teacher-file-attachments-on-tasks](./quick/261004-gid-teacher-file-attachments-on-tasks/) |
| 261004-iyj | Students preview locked future phases (greyed, read-only) | 2026-10-04 | 16b4414 | [261004-iyj-students-can-preview-locked-future-phase](./quick/261004-iyj-students-can-preview-locked-future-phase/) |

## Session Continuity

Last session: 2026-09-27T09:18:36.277Z
Stopped at: Completed 02-05-PLAN.md
Resume file: None

## Session Handoff (2026-10-04, context near limit)

In flight / next, in order (user authorized end-to-end execution incl. apply+deploy; ALWAYS dry-run first):
1. **261004-03i** DONE + deployed 2026-10-04.
2. **261004-gic** DONE + deployed 2026-10-04.
3. **261004-gid** DONE + deployed 2026-10-04.
4. Phase 6 LINE notifications: not specced; ask the user (LINE OA? which events?).
User-side in progress: Clerk production instance — DONE: prod instance (secondary app, build.innovators.co.th), 5 DNS CNAMEs added via Cloudflare API (DNS only); user doing Google OAuth client (redirect https://clerk.build.innovators.co.th/v1/oauth_callback). REMAINING after that: (original plan: create prod instance cloned from dev, domain build.innovators.co.th, 5 DNS CNAMEs in Cloudflare as DNS-only; then Google OAuth client, swap pk_live/sk_live in Vercel Production, migrate dev Clerk user ids → prod ids by email in DB). Also rotate the R2 token (secret was pasted in chat).
