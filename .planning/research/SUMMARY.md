# Project Research Summary

**Project:** Duo -- Project-Based Learning Platform
**Domain:** Education LMS (project-based learning, Grades 9-12 + incubation)
**Researched:** 2026-09-17
**Confidence:** HIGH

## Executive Summary

Duo is a purpose-built project-based learning (PBL) platform for Thai education programs (Innovator's Academy, Cocoon). The domain is well-understood -- LMS platforms are mature -- but Duo's differentiator is a Duolingo-style visual progression path that makes multi-phase project work feel tangible and motivating. The recommended approach is a Next.js 15 App Router monolith with Server Actions for all mutations, Neon Postgres via Drizzle ORM for data, Clerk for auth with teacher/student roles, and Cloudflare R2 for file storage. The stack is locked and well-documented; there are no risky technology bets.

The core product loop is straightforward: teachers create classrooms with groups, structure work into phases and to-dos, students submit files/links/text, teachers review and approve, approval unlocks the next phase. This maps cleanly to a hierarchical data model (classroom -> group -> phase -> todo -> submission -> comment) and a linear build order. The Duolingo-style visual path is the highest-complexity feature but depends on the entire data pipeline being functional first.

The primary risks are architectural, not technological: (1) file uploads must use presigned URLs from day one (Vercel has a hard 4.5MB body limit), (2) the Neon WebSocket driver must be used instead of HTTP to support transactions for the approval-unlock workflow, (3) authorization must be enforced in Server Actions, not just middleware (CVE-2025-29927), and (4) the group-vs-individual submission mode must be designed into the schema upfront because retrofitting it is HIGH cost. All four risks are preventable with correct initial setup.

## Key Findings

### Recommended Stack

The locked stack (Next.js 15, Neon, Drizzle, Clerk, R2, Resend, Vercel) is solid and well-matched to the project. Additional recommended technologies fill specific needs without bloat. See `.planning/research/STACK.md` for full details.

**Core additions beyond locked stack:**
- **shadcn/ui + Tailwind v4**: Component library and styling -- copies components into codebase, accessible by default via Radix primitives
- **Motion (prev. Framer Motion) v13+**: Animation for the Duolingo-style progression path -- spring physics, layout animations, AnimatePresence
- **React Hook Form + Zod v4**: Form handling and validation -- shared schemas between client and server
- **@aws-sdk/client-s3 + s3-request-presigner**: R2 file uploads via presigned URLs -- direct browser-to-R2, no server bottleneck
- **TanStack Query v5**: Client-side mutations with optimistic UI -- critical for teacher approve/reject workflow
- **Tiptap v2**: Headless rich text editor for teacher notes and student text submissions
- **nuqs**: Type-safe URL query state for filters and navigation
- **Sonner**: Toast notifications (shadcn default)
- **date-fns v4**: Date formatting with timezone support

**Critical version notes:** Zod 4 requires @hookform/resolvers v5+. Motion imports from `motion/react` (not `framer-motion`). Neon must use WebSocket driver, not HTTP.

### Expected Features

See `.planning/research/FEATURES.md` for full analysis including competitor comparison.

**Must have (table stakes -- launch blockers):**
- Clerk auth with teacher/student roles
- Classrooms, groups, phases with ordering and state, to-dos with submission mode flag
- File (R2), link, and text submissions
- Teacher review with comments + approve/reject
- Approval gating (phase unlock on approval)
- Free-access phase option
- Duolingo-style visual progression UI
- Basic email notifications
- Responsive design (Thai students are mobile-first)

**Should have (differentiators):**
- Duolingo-style visual progression path (the killer feature)
- Bulk phase/to-do assignment across groups
- Phase template duplication
- Teacher dashboard: pending submissions queue
- Phase progress overview per classroom
- Per-to-do group/individual submission toggle
- Mixed Thai/English UI

**Defer (v2+):**
- Analytics/reporting dashboard
- Student portfolio view
- Peer review
- API/integrations
- Multi-language beyond Thai/English

**Explicit anti-features (do NOT build):**
- Gamification (XP, streaks, leaderboards) -- Duolingo-style means the UI, not the reward mechanics
- Real-time chat -- students use LINE/Discord
- Grading/scoring system -- approve/reject is the grading model
- Calendar views -- due dates inline on progression path
- Mobile native app -- responsive web is sufficient for <100 users

### Architecture Approach

The architecture is a standard Next.js 15 App Router monolith with a strict hierarchical data model. Server Components handle reads, Server Actions handle writes, and the client layer is limited to interactive components (phase map animations, submission forms, review actions). See `.planning/research/ARCHITECTURE.md` for full schema, project structure, and data flow diagrams.

**Major components:**
1. **Teacher Dashboard** -- classroom management, group assignment, submission review queue (Server Components + Server Actions)
2. **Student Phase Map** -- Duolingo-style progression path with locked/active/completed states (Client Component with Motion animations, data from Server Component props)
3. **Submission Flow** -- presigned URL upload to R2, text/link submission, status tracking (Server Action mints URL, client uploads directly)
4. **Review + Unlock Engine** -- approve/reject submissions, comment threads, automatic phase unlock on completion (Server Actions with database transactions)
5. **Phase Progression Logic** -- centralized pure function `canAccessPhase()` determining unlock state, cached on phases.status column

**Key architectural patterns:**
- Server Actions for all mutations (no API routes for CRUD)
- Presigned URL file uploads (server never touches file bytes)
- Phase status cached/denormalized on the phases row for read performance
- Classroom-scoped authorization in every Server Action (not just middleware)
- Schema split by domain with centralized relations file

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all 7 pitfalls plus technical debt patterns, security checklist, and UX pitfalls.

1. **File uploads through Server Actions hit Vercel's 4.5MB limit** -- Use presigned URLs from day one. Server Action generates URL, client uploads directly to R2. No file bytes through Vercel.
2. **Neon HTTP driver cannot do multi-statement transactions** -- Use WebSocket driver (`neonConfig.useSecureWebSocket = true`) for Drizzle client. Required for atomic approval-unlock workflows.
3. **Authorization only in middleware is bypassable (CVE-2025-29927)** -- Check auth in every Server Action with `auth()` + role verification. Middleware is convenience, not security.
4. **Group vs individual submission mode designed as afterthought** -- Design schema with `submission_mode` on todos and both `group_id` + `user_id` on submissions from day one. Retrofitting is HIGH cost.
5. **Phase progression logic becomes scattered** -- Centralize in a single pure function `canAccessPhase()`. Call from UI, Server Actions, and tests. Never duplicate the logic.
6. **Clerk JWT token TTL causes stale permissions** -- Use Clerk for identity + coarse role only. Check fine-grained permissions (group membership) from the database on every request.
7. **Thai calendar (Buddhist Era) display inconsistencies** -- Use `Intl.DateTimeFormat('th-TH')` everywhere via a single `formatDate()` utility. Never manually add/subtract 543.

## Implications for Roadmap

Based on combined research, the build order is dictated by data dependencies (each layer depends on the one below) and risk mitigation (address critical pitfalls in the earliest possible phase).

### Phase 1: Foundation and Schema

**Rationale:** Every feature depends on the database schema, auth setup, and file storage infrastructure. Four of seven critical pitfalls must be prevented here. Getting this wrong is expensive to fix.
**Delivers:** Working database with full schema, Clerk auth with role checking pattern, R2 presigned URL infrastructure, project scaffolding with shadcn/ui
**Addresses:** Auth + roles, database schema, R2 integration, project structure
**Avoids:** Pitfall 1 (file upload limits), Pitfall 2 (Neon HTTP transactions), Pitfall 3 (auth only in middleware), Pitfall 4 (submission mode schema), Pitfall 6 (Clerk token TTL)

### Phase 2: Core Entity CRUD

**Rationale:** Teachers need to create the content structure before students can interact. This is the data entry layer -- straightforward CRUD with Server Actions and Server Components.
**Delivers:** Classroom creation/management, group creation with member assignment, phase creation with ordering, to-do creation with submission mode and attachments
**Uses:** Drizzle ORM, Server Actions, shadcn/ui forms, React Hook Form + Zod, Tiptap (teacher notes)
**Implements:** Teacher Dashboard (management portion), classroom-scoped authorization pattern

### Phase 3: Submission and Review Loop

**Rationale:** The core product loop -- students submit, teachers review. This must work before the progression UI because the visual path needs submission data to show accurate states.
**Delivers:** Student submission form (file/link/text), presigned URL upload flow, teacher review queue with approve/reject/comment, submission status tracking
**Uses:** R2 presigned URLs, react-dropzone, TanStack Query (optimistic approve/reject), Sonner (feedback toasts)
**Avoids:** Pitfall 5 (progression logic tangle) -- by building submission data first, progression logic has real data to work with

### Phase 4: Phase Progression and Visual Path

**Rationale:** The Duolingo-style progression path is the product's differentiator but has the highest UI complexity. It requires the full data pipeline (phases, to-dos, submissions, approvals) to be functional. Build the logic first, then the visual layer.
**Delivers:** Centralized `canAccessPhase()` function, automatic phase unlock on approval, Duolingo-style visual phase map with Motion animations (locked/active/completed states), free-access phase toggle
**Uses:** Motion (spring animations, AnimatePresence, layout animations), centralized progression logic
**Avoids:** Pitfall 5 (progression logic scattered) -- single function, comprehensive tests

### Phase 5: Polish and Teacher Experience

**Rationale:** With the core loop working, add the features that make teachers' lives easier and handle edge cases. These are differentiators that elevate the product beyond "it technically works."
**Delivers:** Teacher dashboard with pending submissions queue, phase progress overview per classroom, bulk phase assignment across groups, phase template duplication, email notifications (Resend), Thai date formatting, responsive design polish
**Uses:** nuqs (URL state for filters), date-fns (Thai locale formatting), Resend (transactional email)
**Avoids:** Pitfall 7 (Thai calendar inconsistency) -- formatDate() utility established here

### Phase Ordering Rationale

- **Schema before CRUD, CRUD before submissions, submissions before progression, progression before polish.** This follows the strict data dependency chain: classroom -> group -> phase -> todo -> submission -> approval -> phase unlock -> visual path.
- **Foundation phase is heavy because four critical pitfalls demand early prevention.** The Neon driver choice, presigned URL pattern, auth enforcement pattern, and submission mode schema all have HIGH retrofit cost.
- **Progression UI comes after submission loop** because the visual path renders real submission/approval state. Building the path with mock data leads to disconnected logic that breaks when wired to real data.
- **Teacher experience features are last** because they are aggregation/convenience views on top of existing data, not new data flows.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Progression + Visual Path):** The Duolingo-style path UI is the highest-complexity feature. SVG/Canvas rendering of a node path with spring animations, gesture support, and responsive layout needs design research and prototyping. The web-cocoon sister project has Motion patterns to reference.
- **Phase 3 (Submission Loop):** The presigned URL upload flow with progress tracking, error recovery, and duplicate prevention has nuance. Copy the web-cocoon `r2.ts` pattern but validate the complete client-side upload UX.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** All technologies are well-documented. Drizzle schema, Clerk middleware, shadcn init -- established patterns.
- **Phase 2 (Core CRUD):** Standard Server Action CRUD with shadcn forms. No novel patterns.
- **Phase 5 (Polish):** Aggregation queries, email sending, date formatting -- straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are locked or well-established with high community adoption. Zod 4 and Motion v13 are the newest but stable. |
| Features | HIGH | PBL domain is well-understood. Feature set validated against Google Classroom, Canvas, and Trello. Anti-features clearly scoped. |
| Architecture | HIGH | Next.js 15 App Router monolith with Server Actions is the 2026 standard. Schema design follows established LMS patterns. Sister project (web-cocoon) validates R2 and auth patterns. |
| Pitfalls | HIGH | All pitfalls sourced from official documentation, CVE reports, and community-documented issues. Recovery strategies included. |

**Overall confidence:** HIGH

### Gaps to Address

- **Tiptap version confidence is MEDIUM:** Rich text editor details drawn from training data, not verified against latest Tiptap docs. Validate API during Phase 2 implementation.
- **Duolingo path UI has no reference implementation:** The visual progression path is novel UI. No existing open-source component matches the vision. Plan for prototyping time in Phase 4. Consider looking at react-flow or custom SVG approaches.
- **Thai locale testing infrastructure:** No mention of automated Thai locale testing in CI. Add manual QA checklist for Thai date/text rendering.
- **Neon region selection:** Research recommends co-locating Neon and Vercel in the same region (Singapore/ap-southeast-1 for Thai users). Verify Neon supports this region during Phase 1 setup.
- **R2 CORS configuration:** Must be configured via Wrangler CLI before client-side uploads work. This is a one-time setup step but easy to forget.

## Sources

### Primary (HIGH confidence)
- [shadcn/ui installation for Next.js](https://ui.shadcn.com/docs/installation/next)
- [Motion (prev. Framer Motion) docs](https://motion.dev/docs/react)
- [TanStack Query SSR guide](https://tanstack.com/query/latest/docs/react/guides/advanced-ssr)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Drizzle ORM Relations](https://orm.drizzle.team/docs/relations)
- [Drizzle ORM Neon driver documentation](https://orm.drizzle.team/docs/connect-neon)
- [Clerk RBAC with Next.js](https://clerk.com/docs/guides/secure/basic-rbac)
- [CVE-2025-29927 Next.js middleware bypass](https://clerk.com/articles/nextjs-authentication-guide-2026)
- [Vercel Serverless Function body size limits](https://vercel.com/docs/functions/limitations)
- [nuqs documentation](https://nuqs.dev/)

### Secondary (MEDIUM confidence)
- [Tiptap React docs](https://tiptap.dev/) -- version details from training data
- [Canvas group submission design patterns](https://blogs.sussex.ac.uk/tel/2019/11/19/collaborative-assessment-group-submissions-in-canvas/)
- [Coursebox - Project-Based Learning Elements](https://www.coursebox.ai/blog/project-based-learning)
- [925 Studios - Duolingo UX Breakdown](https://www.925studios.co/blog/duolingo-design-breakdown)
- web-cocoon `src/cocoon/apply/r2.ts` -- sister project R2 pattern

### Tertiary (LOW confidence)
- None -- all findings corroborated by multiple sources

---
*Research completed: 2026-09-17*
*Ready for roadmap: yes*
