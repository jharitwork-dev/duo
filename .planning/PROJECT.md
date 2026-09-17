# Duo — Project-Based Learning Platform

## What This Is

A project-based learning platform for Innovator's Academy (Grades 9-12) and their incubation programs (e.g., Cocoon). Teachers and students plan projects together through phases and to-do lists, with a Duolingo-style progression UI. Students submit work (files, links, text), teachers review, comment, and approve to unlock the next phase.

## Core Value

Teachers and student groups can plan, execute, and track project-based work through a clear phase→to-do progression — with teacher approval gating advancement.

## Requirements

### Validated

- ✓ Clerk auth with teacher/student/superadmin roles — Phase 1
- ✓ Server Action authorization (not just middleware) — Phase 1
- ✓ Full DB schema deployed (classrooms through comments) — Phase 1
- ✓ Thai UI with Buddhist Era dates — Phase 1
- ✓ R2 presigned URL infrastructure ready — Phase 1

### Active

- [ ] Classrooms as top-level containers (e.g., "Innovator's Academy", "Cocoon Incubation")
- [ ] Groups (student teams) within classrooms
- [ ] Teachers create custom phases + to-do lists per group
- [ ] Teachers can assign same phases/to-dos to all groups in a classroom at once
- [ ] Teachers can duplicate assignments across groups
- [ ] Duolingo-style phase progression UI (visual path through levels)
- [ ] Each to-do opens a page with: notes area, assignment download, submission upload
- [ ] Submissions support files (R2), links, and free-text
- [ ] Group submissions (one member submits for the team) — v1
- [ ] Individual submissions (each member submits separately) — v1
- [ ] To-do level flag: "submit as group" vs "submit individually"
- [ ] Teacher approves submissions to unlock next phase
- [ ] Teacher can set phases as free-access (no approval prerequisite)
- [ ] Teacher can comment on student work
- [ ] Clerk auth with teacher and student roles
- [ ] Mixed-language UI (Thai primary, English terms)

### Out of Scope

- Gamification (XP, streaks, leaderboards) — not the product; Duolingo-style is UI only
- Real-time chat — not needed for v1
- Payment/billing — internal tool for Innovator's programs
- Mobile app — web-first, responsive design sufficient
- Analytics/reporting dashboard — defer to v2

## Context

- **Organization:** Innovator's Academy — Thai SAT/IELTS prep + real-business education, Grades 9-12. Also runs Cocoon incubation program for broader participants.
- **Sister project:** Innovator's Web + Cocoon Regis live in `web-cocoon/` repo. Duo is independent but reuses patterns (R2 uploads, Resend email, motion, form+zod).
- **Users:** Teachers (mentors/admins) and students. Small scale initially (< 100 users). Two programs sharing one platform via classrooms.
- **Domain:** `build.innovators.co.th` (subdomain of existing `innovators.co.th`)
- **Deployment:** Vercel

## Constraints

- **Tech stack**: Next.js 15 (App Router), Neon Postgres, Drizzle ORM, Clerk, R2, Resend — locked defaults from START-HERE.md
- **Reuse**: Copy patterns from web-cocoon (R2 uploads, Resend, form+zod), don't couple the apps
- **Language**: Thai primary UI with English technical terms mixed in
- **Scale**: Start small (< 100 users), no need for heavy optimization
- **Domain**: `build.innovators.co.th` — CNAME to Vercel

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Clerk for auth | Fast setup, built-in roles (teacher/student), swap to Auth.js later if needed | — Pending |
| Subdomain deployment | `build.innovators.co.th` — no new domain, keeps apps independent | — Pending |
| Classrooms as top-level | Clean separation between Innovator's Academy and Cocoon programs | — Pending |
| Both group + individual submissions in v1 | Minimal extra work, cleaner to design schema right from start | — Pending |
| Files + links + text submissions | Maximum flexibility for different assignment types | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-18 after Phase 1 completion*
