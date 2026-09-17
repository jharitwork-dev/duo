# Architecture Research

**Domain:** Project-based learning platform (classroom/group/phase/todo/submission hierarchy)
**Researched:** 2026-09-17
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Teacher UI   │  │ Student UI   │  │ Shared (Progression UI)  │  │
│  │ (dashboard,  │  │ (phase path, │  │ (phase map, submission   │  │
│  │  review,     │  │  submit,     │  │  viewer, comment thread) │  │
│  │  assign)     │  │  view)       │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
├─────────┴─────────────────┴────────────────────────┴────────────────┤
│                     Auth & Middleware Layer                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Clerk (clerkMiddleware + auth() in Server Actions)          │   │
│  │  Roles: teacher | student — checked server-side per action   │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                        Data Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Server       │  │ Data Access  │  │ File Storage             │  │
│  │ Actions      │  │ (Drizzle     │  │ (R2 presigned URLs       │  │
│  │ (mutations   │  │  queries,    │  │  via aws4fetch)          │  │
│  │  + queries)  │  │  relations)  │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
├─────────┴─────────────────┴────────────────────────┴────────────────┤
│                        Storage Layer                                │
│  ┌──────────────────────┐  ┌────────────────────────────────────┐   │
│  │ Neon Postgres        │  │ Cloudflare R2                      │   │
│  │ (all relational data)│  │ (submission files, assignment      │   │
│  │                      │  │  attachments)                      │   │
│  └──────────────────────┘  └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Teacher Dashboard | List classrooms, manage groups, assign phases/todos, review submissions | Server Component pages + Server Actions for mutations |
| Student Phase Map | Duolingo-style progression path, show locked/unlocked/completed phases | Client Component (motion animations) consuming server-fetched data |
| Submission Flow | Upload files to R2, submit links/text, track submission status | Server Action mints presigned URL, client PUTs directly to R2 |
| Review Flow | View submissions, add comments, approve/reject to unlock next phase | Server Components for display, Server Actions for approve/comment |
| Phase Progression Engine | Determine which phases are unlocked based on approval status | Pure server logic — query function, not a UI component |
| R2 File Service | Presign PUT (upload) and GET (download) URLs, manage file keys | Framework-free module (copy from web-cocoon `r2.ts` pattern) |
| Notification Service | Email on submission, approval, comment | Resend via Server Actions (defer to v2) |

## Database Schema

### Entity-Relationship Overview

```
classroom (1)──→(N) group
classroom (1)──→(N) classroom_member

group (1)──→(N) group_member
group (1)──→(N) phase

phase (1)──→(N) todo
phase (N)──→(1) phase (optional: prerequisite_phase_id)

todo (1)──→(N) submission
todo (1)──→(N) todo_attachment (teacher-uploaded files)

submission (1)──→(N) submission_file
submission (1)──→(N) comment
```

### Core Tables

```typescript
// ─── CLASSROOMS ───
export const classrooms = pgTable('classrooms', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),                    // "Innovator's Academy", "Cocoon"
  description: text('description'),
  createdBy: text('created_by').notNull(),          // Clerk userId (teacher)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── CLASSROOM MEMBERS ───
// Links Clerk users to classrooms with roles
export const classroomMembers = pgTable('classroom_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),                // Clerk userId
  role: text('role', { enum: ['teacher', 'student'] }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.classroomId, t.userId),             // one membership per user per classroom
]);

// ─── GROUPS (student teams) ───
export const groups = pgTable('groups', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                     // "Team Alpha"
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const groupMembers = pgTable('group_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),                // Clerk userId
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.groupId, t.userId),
]);

// ─── PHASES ───
export const phases = pgTable('phases', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  prerequisitePhaseId: text('prerequisite_phase_id'), // null = first phase or free-access
  isFreeAccess: boolean('is_free_access').notNull().default(false),
  status: text('status', { enum: ['locked', 'active', 'completed'] }).notNull().default('locked'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── TODOS ───
export const todos = pgTable('todos', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  phaseId: text('phase_id').notNull().references(() => phases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),                 // rich text / notes area
  sortOrder: integer('sort_order').notNull().default(0),
  submissionType: text('submission_type', { enum: ['group', 'individual'] }).notNull().default('group'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Teacher-uploaded attachments on a todo (assignment briefs, templates)
export const todoAttachments = pgTable('todo_attachments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  todoId: text('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  r2Key: text('r2_key').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// ─── SUBMISSIONS ───
export const submissions = pgTable('submissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  todoId: text('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  submittedBy: text('submitted_by').notNull(),      // Clerk userId
  groupId: text('group_id'),                        // null for individual submissions
  textContent: text('text_content'),                 // free-text submission
  linkUrl: text('link_url'),                         // link submission
  status: text('status', { enum: ['submitted', 'approved', 'revision_requested'] }).notNull().default('submitted'),
  reviewedBy: text('reviewed_by'),                   // Clerk userId (teacher)
  reviewedAt: timestamp('reviewed_at'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

// Files attached to a submission
export const submissionFiles = pgTable('submission_files', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  r2Key: text('r2_key').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// ─── COMMENTS ───
export const comments = pgTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),                 // Clerk userId (teacher or student)
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Key Schema Decisions

| Decision | Rationale |
|----------|-----------|
| Text IDs with `createId()` (nanoid/cuid2) | URL-safe, no sequential guessing, works across distributed systems |
| Clerk userId as text FK (no local users table) | Clerk is the auth source of truth. User profile data lives in Clerk. Avoids sync headaches. |
| `classroomMembers` join table | Decouples Clerk users from classrooms. A user can be a teacher in one classroom and student in another. |
| `submissionType` on `todos` (not phases) | Per-requirement: each todo can be group or individual independently |
| `prerequisitePhaseId` + `isFreeAccess` | Simple unlock logic: free-access phases skip approval gate. Prerequisite chain enables linear or branching paths. |
| `status` on phases is computed/cached | Can be derived from submission approvals, but caching on the row avoids expensive joins on every page load |
| Separate `submissionFiles` table | A submission can have multiple files. Text and link are inline on submission row (simpler, always one each). |

## Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Clerk sign-in/sign-up pages
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/               # Protected routes (route group)
│   │   ├── layout.tsx             # Sidebar nav, role-based menu
│   │   ├── classrooms/
│   │   │   ├── page.tsx           # List classrooms
│   │   │   └── [classroomId]/
│   │   │       ├── page.tsx       # Classroom overview (groups list)
│   │   │       ├── groups/
│   │   │       │   └── [groupId]/
│   │   │       │       ├── page.tsx        # Phase map (Duolingo path)
│   │   │       │       └── phases/
│   │   │       │           └── [phaseId]/
│   │   │       │               └── todos/
│   │   │       │                   └── [todoId]/
│   │   │       │                       └── page.tsx  # Todo detail + submit
│   │   │       └── settings/
│   │   │           └── page.tsx   # Group settings (teacher only)
│   │   └── review/                # Teacher review queue
│   │       └── page.tsx
│   ├── api/                       # Minimal — only for webhooks
│   │   └── webhooks/
│   │       └── clerk/route.ts     # Clerk webhook (optional)
│   ├── layout.tsx                 # Root layout (ClerkProvider)
│   └── page.tsx                   # Landing / redirect to dashboard
├── components/
│   ├── ui/                        # Shared primitives (buttons, cards, inputs)
│   ├── phase-map.tsx              # Duolingo-style progression path (client)
│   ├── submission-form.tsx        # File + link + text submission (client)
│   ├── review-card.tsx            # Submission review with approve/reject
│   └── comment-thread.tsx         # Comments on a submission
├── server/
│   ├── actions/                   # Server Actions (mutations)
│   │   ├── classrooms.ts          # CRUD classrooms, manage members
│   │   ├── groups.ts              # CRUD groups, manage members
│   │   ├── phases.ts              # CRUD phases, reorder, assign to groups
│   │   ├── todos.ts               # CRUD todos, manage attachments
│   │   ├── submissions.ts         # Submit, upload files
│   │   ├── reviews.ts             # Approve/reject, comment, unlock next phase
│   │   └── uploads.ts             # R2 presigned URL generation
│   └── queries/                   # Server-side data fetching (reads)
│       ├── classrooms.ts          # Get classrooms for user
│       ├── groups.ts              # Get groups in classroom
│       ├── phases.ts              # Get phases with unlock status
│       ├── todos.ts               # Get todos with submission status
│       └── submissions.ts         # Get submissions for review
├── db/
│   ├── schema/
│   │   ├── classrooms.ts          # classrooms + classroomMembers tables
│   │   ├── groups.ts              # groups + groupMembers tables
│   │   ├── phases.ts              # phases table
│   │   ├── todos.ts               # todos + todoAttachments tables
│   │   ├── submissions.ts         # submissions + submissionFiles tables
│   │   ├── comments.ts            # comments table
│   │   └── relations.ts           # All Drizzle relation definitions
│   ├── index.ts                   # Drizzle client + db export
│   └── migrate.ts                 # Migration runner
├── lib/
│   ├── r2.ts                      # R2 presign helpers (copy from web-cocoon)
│   ├── auth.ts                    # Auth helper: getCurrentUser(), requireRole()
│   ├── ids.ts                     # ID generation (nanoid/cuid2)
│   └── constants.ts               # Enums, config values
└── middleware.ts                   # Clerk middleware (protect /dashboard/*)
```

### Structure Rationale

- **`server/actions/` + `server/queries/`:** Separating mutations from reads makes each file focused. Actions are `'use server'` files. Queries are plain async functions called from Server Components. This avoids the "god action file" anti-pattern.
- **`db/schema/` split by domain:** One file per entity group. Drizzle merges them at schema-export time. Easier to navigate than a single 500-line schema file.
- **`db/schema/relations.ts` centralized:** All Drizzle relation declarations in one file prevents circular import issues (relations reference multiple tables).
- **`lib/r2.ts` framework-free:** Copied from web-cocoon. No `'use server'` / `'use client'` / Next.js imports. Importable from both actions and route handlers.
- **Route groups `(auth)` and `(dashboard)`:** Standard Next.js App Router pattern. Different layouts, shared auth boundary.
- **Minimal `api/` routes:** Server Actions handle all mutations. Only webhooks need route handlers.

## Architectural Patterns

### Pattern 1: Server Actions for All Mutations

**What:** Every write operation (create, update, delete, approve) is a Server Action in `server/actions/`. No API routes for CRUD.
**When to use:** Always for this project. Next.js Server Actions are the standard pattern for App Router apps.
**Trade-offs:** Simpler than REST routes, automatic TypeScript types, but harder to call from external clients (not relevant here).

**Example:**
```typescript
// server/actions/reviews.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { submissions, phases } from '@/db/schema';
import { requireRole } from '@/lib/auth';

export async function approveSubmission(submissionId: string) {
  const { userId } = await auth();
  await requireRole(userId, 'teacher');

  await db.update(submissions)
    .set({ status: 'approved', reviewedBy: userId, reviewedAt: new Date() })
    .where(eq(submissions.id, submissionId));

  // Check if all todos in the phase are approved → unlock next phase
  await maybeUnlockNextPhase(submissionId);
}
```

### Pattern 2: Presigned URL File Upload (from web-cocoon)

**What:** Server Action generates a short-lived presigned R2 PUT URL. Client uploads directly to R2. Server never touches the file bytes.
**When to use:** All file uploads (submission files, teacher attachments).
**Trade-offs:** Fast uploads, no server bandwidth cost, but requires client-side upload logic.

**Flow:**
```
1. Client calls Server Action: requestUploadUrl({ fileName, contentType, size })
2. Server validates (auth + zod), mints presigned PUT URL
3. Client PUTs file directly to R2 using the presigned URL
4. Client calls Server Action: confirmSubmission({ todoId, files: [{ r2Key, fileName }], text, link })
5. Server creates submission + submissionFiles rows
```

### Pattern 3: Phase Unlock as Derived State

**What:** Phase lock/unlock status is derived from whether all todos in the prerequisite phase have approved submissions, but cached on the `phases.status` column for read performance.
**When to use:** Every time a submission is approved or a phase is created.
**Trade-offs:** Slight denormalization, but avoids N+1 queries on the phase map page. The progression map is the most-viewed page.

**Logic:**
```typescript
async function maybeUnlockNextPhase(submissionId: string) {
  // 1. Find the phase this submission belongs to
  // 2. Check if ALL todos in that phase have at least one approved submission
  //    (respecting group vs individual submission type)
  // 3. If yes, find phases where prerequisitePhaseId = this phase
  // 4. Set those phases status = 'active'
}
```

### Pattern 4: Classroom-Scoped Authorization

**What:** Every data access checks that the requesting user is a member of the relevant classroom with the correct role. Authorization happens in Server Actions and queries, not just middleware.
**When to use:** Every server action and query.
**Trade-offs:** More code per action, but prevents privilege escalation.

**Example:**
```typescript
// lib/auth.ts
export async function requireClassroomRole(
  userId: string,
  classroomId: string,
  role: 'teacher' | 'student'
) {
  const member = await db.query.classroomMembers.findFirst({
    where: and(
      eq(classroomMembers.userId, userId),
      eq(classroomMembers.classroomId, classroomId),
      eq(classroomMembers.role, role),
    ),
  });
  if (!member) throw new Error('Unauthorized');
  return member;
}
```

## Data Flow

### Submission Flow (Primary User Journey)

```
Student opens todo page
    |
    v
Server Component fetches todo + existing submissions (server/queries/todos.ts)
    |
    v
Client Component: SubmissionForm (file picker, text area, link input)
    |
    v
[File selected] → Server Action: requestUploadUrl() → presigned PUT URL
    |
    v
Client PUTs file directly to R2 (no server in the middle)
    |
    v
Client calls Server Action: createSubmission({ todoId, files[], text, link })
    |
    v
Server: validate auth → create submission row + submissionFiles rows → revalidatePath
    |
    v
Page re-renders with updated submission status
```

### Review + Unlock Flow

```
Teacher opens review queue
    |
    v
Server Component: fetch pending submissions across all groups (server/queries/submissions.ts)
    |
    v
Teacher clicks "Approve" → Server Action: approveSubmission(submissionId)
    |
    v
Server: update submission status → check phase completion → maybe unlock next phase
    |
    v
revalidatePath → student sees phase unlocked on next load
```

### Phase Assignment Flow (Teacher)

```
Teacher on classroom page → selects "Assign phases to group"
    |
    v
Server Action: createPhasesForGroup({ groupId, phases[] })
    |                                                      
    v                                                      
[Bulk assign?] → Server Action: duplicatePhasesToGroups({ sourceGroupId, targetGroupIds[] })
    |
    v
Copies phase + todo structure to each target group (new IDs, same content)
```

### Key Data Flows

1. **Phase map rendering:** Server fetches phases for group + submission status per todo per phase. Computes lock/unlock state. Returns flat array with status field. Client renders the Duolingo path with motion animations.
2. **Bulk phase assignment:** Teacher creates phases + todos for one group, then "duplicates" to other groups. Server Action deep-copies the structure with new IDs. Each group gets independent copies (changes to one do not affect others).
3. **File download:** When viewing a submission, server generates a presigned GET URL for each file. URL is short-lived (1 hour). Client renders download links / inline previews.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (current target) | Monolith is perfect. Single Neon DB, direct queries, no caching layer. |
| 100-1k users | Add indexes on frequently queried columns (classroomId, groupId, phaseId, status). Consider connection pooling if hitting Neon limits. |
| 1k+ users | Add Redis/Upstash for session-adjacent caching (phase status). Consider read replicas. This scale is unlikely for this project. |

### Scaling Priorities

1. **First bottleneck:** Phase map query (joins across phases + todos + submissions). Prevention: cache phase status on the phases row, add composite indexes.
2. **Second bottleneck:** File upload concurrency. Prevention: presigned URLs already offload to R2; no server bottleneck.

## Anti-Patterns

### Anti-Pattern 1: Local Users Table Syncing with Clerk

**What people do:** Create a `users` table mirroring Clerk data, set up webhooks to sync.
**Why it's wrong:** At <100 users, this adds complexity for no gain. Clerk's `auth()` and `currentUser()` provide everything needed. The sync webhook is a reliability concern.
**Do this instead:** Store only `userId` (Clerk ID) as a text foreign key. Fetch display names from Clerk when rendering (or use `<UserButton />`). Only add a local users table if you need to query users in JOIN-heavy reports.

### Anti-Pattern 2: Storing Phase Status Only in Submissions

**What people do:** Compute phase lock/unlock by querying all submissions every time the phase map loads.
**Why it's wrong:** The phase map is the most-loaded page. Running aggregation queries across submissions + todos on every load is wasteful.
**Do this instead:** Cache computed status on `phases.status`. Update it in the `approveSubmission` action. Simple, fast reads.

### Anti-Pattern 3: Single Schema File

**What people do:** Put all tables in one `schema.ts` file.
**Why it's wrong:** Becomes 500+ lines quickly. Hard to navigate, causes merge conflicts.
**Do this instead:** Split by domain (`classrooms.ts`, `groups.ts`, `phases.ts`, etc.). Centralize relations in `relations.ts` to avoid circular imports.

### Anti-Pattern 4: API Routes for Everything

**What people do:** Create `/api/classrooms`, `/api/groups`, `/api/submissions` REST endpoints.
**Why it's wrong:** Server Actions are simpler, type-safe, and the standard App Router pattern. API routes add boilerplate with no benefit for a server-rendered app.
**Do this instead:** Use Server Actions for all mutations. Use server-side query functions called directly in Server Components for reads. Reserve `api/` for webhooks only.

### Anti-Pattern 5: Uploading Files Through Server Actions

**What people do:** Pass file bytes through a Server Action to upload to R2.
**Why it's wrong:** Next.js Server Actions have a 1MB default body limit. Large files fail. Server bandwidth is wasted.
**Do this instead:** Use the presigned URL pattern. Server Action returns a URL, client uploads directly to R2.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Clerk | `clerkMiddleware()` in `middleware.ts` + `auth()` in Server Actions | Use `publicMetadata` for role storage. Check server-side, never trust client. Ensure Next.js >=15.2.3 for CVE-2025-29927 fix. |
| Neon Postgres | Drizzle `neon-http` driver for serverless, connection string via `DATABASE_URL` | Use Neon's built-in connection pooler (`-pooler` suffix on connection string). |
| Cloudflare R2 | `aws4fetch` for presigned URLs (copy `r2.ts` from web-cocoon) | Framework-free module. No `@aws-sdk` (too large for serverless). |
| Resend | Server Action sends email on submission/approval (v2) | Keep as a separate `lib/email.ts` module. |
| Vercel | Deploy target, `build.innovators.co.th` CNAME | No special config needed beyond standard Next.js. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI Components <-> Server Actions | Direct function call (form action or `startTransition`) | Type-safe, no fetch boilerplate |
| Server Actions <-> DB | Drizzle query builder | All SQL goes through Drizzle, never raw strings |
| Server Actions <-> R2 | `lib/r2.ts` presign functions | Actions call `presignPut`/`presignGet`, return URL to client |
| Server Components <-> Queries | Direct import and call | `server/queries/*.ts` are plain async functions, no `'use server'` |
| Phase Map (Client) <-> Server | Initial data via Server Component props, mutations via Server Actions | Phase map needs client-side interactivity (animations), so data is passed as props from a parent Server Component |

## Build Order (Dependencies)

The build order is determined by data dependencies:

```
Phase 0: Foundation
  1. DB schema + Drizzle setup + migrations
  2. Clerk integration + middleware + auth helpers
  3. Basic layout + route structure

Phase 1: Core Entities (no submissions yet)
  4. Classrooms CRUD (teacher creates, students join)
  5. Groups CRUD (teacher creates, assigns students)
  6. Phases CRUD (teacher creates phases per group)
  7. Todos CRUD (teacher creates todos per phase)

Phase 2: Submission Loop
  8. R2 integration (copy from web-cocoon, adapt key structure)
  9. Submission form (file upload + text + link)
  10. Submission creation Server Action
  11. Teacher review queue + approve/reject

Phase 3: Progression
  12. Phase unlock logic (approve → unlock next)
  13. Duolingo-style phase map UI (motion animations)
  14. Bulk phase assignment (duplicate to groups)

Phase 4: Polish
  15. Comments on submissions
  16. Email notifications (Resend)
  17. Free-access phase toggle
  18. Edge cases (re-submission, revision requests)
```

**Why this order:** Each phase depends on the one before. You cannot build submissions without todos. You cannot build unlock logic without submissions. The progression UI is the "Duolingo feel" but requires the full data pipeline underneath.

## Sources

- [Drizzle ORM Relations](https://orm.drizzle.team/docs/relations) — relation definition patterns
- [Drizzle ORM Schema](https://orm.drizzle.team/docs/sql-schema-declaration) — table definition syntax
- [Clerk RBAC in Next.js](https://clerk.com/blog/nextjs-role-based-access-control) — role-based access patterns
- [Clerk clerkMiddleware()](https://clerk.com/docs/reference/nextjs/clerk-middleware) — middleware setup
- [Clerk Organizations RBAC](https://clerk.com/articles/organizations-and-role-based-access-control-in-nextjs) — per-org roles
- [Direct-to-R2 Uploads with Presigned URLs in Next.js](https://dev.to/nareshipme/direct-to-r2-uploads-with-presigned-urls-in-nextjs-15-5c4l) — upload pattern
- [Next.js App Router Project Structure](https://dev.to/krunal_groovy/the-nextjs-15-app-router-project-structure-that-scales-with-examples-47ha) — folder conventions
- [Modern Full Stack Architecture with Next.js 15+](https://softwaremill.com/modern-full-stack-application-architecture-using-next-js-15/) — architecture patterns
- web-cocoon `src/cocoon/apply/r2.ts` — battle-tested R2 presign pattern to copy

---
*Architecture research for: Duo project-based learning platform*
*Researched: 2026-09-17*
