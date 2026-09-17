# Phase 1: Foundation & Auth - Research

**Researched:** 2026-09-17
**Domain:** Next.js 15 project scaffolding, Clerk auth with RBAC, Drizzle + Neon Postgres, R2 file infrastructure, Thai localization
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire project foundation: database schema (all tables upfront), Clerk authentication with three-role system (superadmin/teacher/student), R2 presigned upload infrastructure, Thai localization utilities, and empty dashboard shells. This is a greenfield phase on a fresh Next.js 16.3.5 scaffold with only React 19 and Tailwind 4 installed.

The primary technical challenges are: (1) Clerk role architecture -- users self-select at signup via `unsafeMetadata`, then a webhook or backend call promotes to `publicMetadata` for secure server-side checks; (2) Neon WebSocket driver setup for transaction support (HTTP driver cannot do multi-statement transactions); (3) Full schema deployment of ~10 tables with correct FK relationships and Drizzle relations; (4) R2 presigned URL infrastructure copied from the web-cocoon sister project using `aws4fetch`.

**Primary recommendation:** Set up Drizzle + Neon WebSocket driver first, deploy the full schema, then layer Clerk auth with the `publicMetadata` role pattern, then build dashboard shells. R2 and localization utilities are independent and can be built in parallel.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Users self-select role (teacher or student) at signup
- **D-02:** Student role is immediately active after signup
- **D-03:** Teacher role requires approval from a superadmin before gaining teacher access
- **D-04:** Superadmin is the project owner (user jharit) -- approves teacher signups via in-app UI
- **D-05:** Three roles total: superadmin, teacher (pending/approved), student
- **D-06:** Deploy full schema in Phase 1 -- all tables (classrooms, groups, phases, todos, submissions, comments, etc.) created upfront to prevent costly retrofits
- **D-07:** Use Clerk user ID as text FK directly in all tables -- no local users table. Simple approach for < 100 users.
- **D-08:** Use Neon WebSocket driver (not HTTP) to support multi-statement transactions (required for approval/unlock workflows in later phases)
- **D-09:** Sidebar layout -- left sidebar with nav links + main content area for both teacher and student views
- **D-10:** Visual style follows Innovator's brand CI -- user will provide Figma reference later. Start with clean shadcn/ui defaults, adjust when Figma arrives.
- **D-11:** Teacher dashboard shell: sidebar with nav (Classrooms, Submissions, Settings), empty main area with welcome message
- **D-12:** Student dashboard shell: sidebar with nav (My Classrooms, My Progress), empty main area with welcome message
- **D-13:** Hardcoded Thai strings directly in components -- no i18n library. UI is Thai-only with English technical terms mixed in naturally.
- **D-14:** Use `Intl.DateTimeFormat('th-TH')` for Thai Buddhist calendar dates -- handles BE year automatically. Use consistently everywhere, no manual year arithmetic.

### Claude's Discretion
- Database table naming conventions (snake_case, singular/plural)
- Drizzle schema file organization (single file vs per-table)
- R2 presigned URL implementation details (copied from web-cocoon patterns)
- Middleware vs layout-based route protection structure
- shadcn/ui component selection for dashboard shell

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Teacher can sign in and access teacher dashboard | Clerk `clerkMiddleware()` + route groups + role check in layout |
| AUTH-02 | Student can sign in and access student view | Same Clerk setup; student role immediately active after signup |
| AUTH-03 | Clerk enforces role-based access (teacher vs student) on all routes and actions | `publicMetadata.role` in session claims + middleware + layout guards |
| AUTH-04 | Authorization checked in Server Actions, not just middleware | `auth()` call at top of every Server Action + `requireRole()` helper |
| L10N-01 | UI is Thai primary with English technical terms mixed in | Hardcoded Thai strings; no i18n library needed |
| L10N-02 | Dates displayed in Thai Buddhist calendar format (BE) | `Intl.DateTimeFormat('th-TH')` verified working -- outputs BE year automatically |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- GSD workflow enforcement: Do not make direct repo edits outside a GSD workflow unless user explicitly asks
- No conventions established yet -- Phase 1 sets all patterns
- Architecture not yet mapped -- follow patterns from research docs
- Locked stack: Next.js 15 (App Router), Neon Postgres, Drizzle ORM, Clerk, Cloudflare R2, Resend, Vercel
- Reuse patterns from web-cocoon (R2 uploads, form+zod), don't couple the apps
- Domain: `build.innovators.co.th` -- CNAME to Vercel

## Standard Stack

### Core (Phase 1 installs)

| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| @clerk/nextjs | 7.9.4 | Auth + RBAC | Locked stack. Provides `clerkMiddleware()`, `auth()`, `<ClerkProvider>`, `<SignIn>`, `<SignUp>` |
| drizzle-orm | 0.45.2 | Database ORM | Locked stack. Type-safe queries, relations, migrations |
| drizzle-kit | 0.31.10 | DB migrations | `drizzle-kit push` for dev, `drizzle-kit generate + migrate` for prod |
| @neondatabase/serverless | 1.1.0 | Neon Postgres driver | WebSocket mode for transaction support (D-08) |
| ws | 8.21.3 | WebSocket polyfill | Required by @neondatabase/serverless in Node.js for WebSocket connections |
| aws4fetch | 1.0.20 | R2 presigned URLs | Lightweight S3 v4 signer. Used by web-cocoon. Framework-free. |
| @paralleldrive/cuid2 | 3.3.0 | ID generation | URL-safe, collision-resistant IDs for all table PKs |
| zod | 4.6.5 | Schema validation | Validates Server Action inputs. Shared between client forms and server |
| date-fns | 4.4.0 | Date manipulation | Thai date formatting utility wraps `Intl.DateTimeFormat` |

### UI (Phase 1 installs)

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| shadcn/ui | latest (CLI) | Component library -- sidebar, button, card, avatar, separator |
| lucide-react | latest | Icons -- default for shadcn/ui |
| sonner | 2.0.8 | Toast notifications via shadcn wrapper |

### Dev Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| @types/ws | latest | TypeScript types for ws package |

### Not Needed in Phase 1

| Library | Phase | Reason |
|---------|-------|--------|
| react-hook-form, @hookform/resolvers | Phase 2+ | No user-facing forms in Phase 1 beyond Clerk's built-in |
| @tanstack/react-query | Phase 2+ | No client-side mutations yet |
| motion | Phase 5 | Duolingo path animations |
| @tiptap/* | Phase 2+ | Rich text not needed for dashboard shells |
| react-dropzone | Phase 3 | File upload UI |
| zustand, nuqs | Phase 2+ | No complex client state yet |

**Installation (Phase 1):**
```bash
# Auth
npm install @clerk/nextjs

# Database
npm install drizzle-orm @neondatabase/serverless ws @paralleldrive/cuid2
npm install -D drizzle-kit @types/ws

# R2 file infrastructure
npm install aws4fetch

# Validation
npm install zod

# Date utilities
npm install date-fns

# UI (via shadcn CLI)
npx shadcn@latest init
npx shadcn@latest add button card sidebar avatar separator sonner
```

## Architecture Patterns

### Recommended Project Structure (Phase 1)

```
src/
├── app/
│   ├── (auth)/                          # Public Clerk pages
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/                     # Protected route group
│   │   ├── layout.tsx                   # Sidebar + role-based nav + auth guard
│   │   ├── teacher/                     # Teacher routes
│   │   │   └── page.tsx                 # Teacher dashboard shell
│   │   ├── student/                     # Student routes
│   │   │   └── page.tsx                 # Student dashboard shell
│   │   └── admin/                       # Superadmin routes
│   │       └── page.tsx                 # Teacher approval queue
│   ├── layout.tsx                       # Root: ClerkProvider + Toaster
│   └── page.tsx                         # Landing / redirect to dashboard
├── db/
│   ├── schema/
│   │   ├── classrooms.ts               # classrooms + classroomMembers
│   │   ├── groups.ts                    # groups + groupMembers
│   │   ├── phases.ts                    # phases table
│   │   ├── todos.ts                     # todos + todoAttachments
│   │   ├── submissions.ts              # submissions + submissionFiles
│   │   ├── comments.ts                 # comments table
│   │   └── relations.ts                # All Drizzle relation defs (centralized)
│   └── index.ts                         # Drizzle client + db export
├── lib/
│   ├── auth.ts                          # requireRole(), getCurrentUser()
│   ├── r2.ts                            # Presign helpers (copied from web-cocoon)
│   ├── ids.ts                           # createId() wrapper around cuid2
│   ├── format.ts                        # formatDate(), formatDateTime() Thai utilities
│   └── constants.ts                     # Role enums, config values
├── components/
│   ├── ui/                              # shadcn/ui generated components
│   ├── app-sidebar.tsx                  # Sidebar component with role-based nav
│   └── user-nav.tsx                     # User button/avatar in sidebar
├── middleware.ts                         # Clerk middleware: protect dashboard routes
└── types/
    └── globals.d.ts                     # CustomJwtSessionClaims type augmentation
```

### Pattern 1: Clerk Role Architecture (Three Roles)

**What:** Users self-select role at signup. Students are immediately active. Teachers start as "pending" and require superadmin approval.

**Implementation:**

1. **Signup flow:** Custom sign-up page with role selector. Role stored in `unsafeMetadata.role` during signup.

2. **Post-signup promotion:** After signup, a Clerk webhook (`user.created`) or an after-auth redirect triggers a Server Action that:
   - For students: immediately sets `publicMetadata.role = 'student'` via Clerk Backend API
   - For teachers: sets `publicMetadata.role = 'teacher_pending'`
   - Superadmin: manually set via Clerk Dashboard for user jharit

3. **Session token customization:** In Clerk Dashboard > Sessions, add custom claims:
```json
{
  "metadata": "{{user.public_metadata}}"
}
```

4. **Type augmentation:**
```typescript
// types/globals.d.ts
export type UserRole = 'superadmin' | 'teacher' | 'teacher_pending' | 'student';

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: UserRole;
    };
  }
}
```

5. **Server-side role check:**
```typescript
// lib/auth.ts
import { auth } from '@clerk/nextjs/server';

export type UserRole = 'superadmin' | 'teacher' | 'teacher_pending' | 'student';

export async function getCurrentRole(): Promise<UserRole | null> {
  const { sessionClaims } = await auth();
  return (sessionClaims?.metadata?.role as UserRole) ?? null;
}

export async function requireRole(...allowed: UserRole[]) {
  const role = await getCurrentRole();
  if (!role || !allowed.includes(role)) {
    throw new Error('Unauthorized');
  }
  return role;
}
```

**Confidence:** HIGH -- verified against Clerk's official RBAC documentation.

### Pattern 2: Neon WebSocket + Drizzle Setup

**What:** Use Neon's WebSocket driver to enable `db.transaction()` for multi-statement atomicity.

```typescript
// db/index.ts
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';

// Required for Node.js (not needed in Cloudflare Workers)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool, { schema });
```

```typescript
// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
```

**Key detail:** Use `DATABASE_URL` (pooled, with `-pooler` suffix) for the app runtime. Use `DATABASE_URL_UNPOOLED` (direct) for `drizzle-kit` migrations. Neon provides both connection strings.

**Confidence:** HIGH -- verified against Neon and Drizzle official docs.

### Pattern 3: Clerk Middleware (Route Protection)

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

**Important:** Middleware provides convenience redirects only. The real security boundary is `requireRole()` in Server Actions and Server Components (per AUTH-04 and CVE-2025-29927 pitfall).

### Pattern 4: R2 Presigned URL Infrastructure (from web-cocoon)

Copy `web-cocoon/src/cocoon/apply/r2.ts` and adapt:
- Replace `objectKey()` with Duo-specific paths: `submissions/{userId}/{todoId}/{filename}`
- Keep `getR2Config()`, `presignPut()`, `presignGet()`, `deleteObject()` as-is
- Add file type allowlist and size limit validation before signing
- Framework-free module (no `'use server'`, no React imports)

```typescript
// lib/r2.ts -- adapted from web-cocoon
import { AwsClient } from 'aws4fetch';

// Env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// getR2Config(), presignPut(), presignGet() -- same pattern as web-cocoon

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'application/zip',
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function validateFile(contentType: string, size: number): boolean {
  return ALLOWED_TYPES.has(contentType) && size <= MAX_FILE_SIZE;
}
```

### Pattern 5: Thai Date Formatting Utility

```typescript
// lib/format.ts
const thaiDateLong = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' });
const thaiDateShort = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' });
const thaiDateTime = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(date: Date | string): string {
  return thaiDateLong.format(new Date(date));
  // e.g., "17 กันยายน 2569"
}

export function formatDateShort(date: Date | string): string {
  return thaiDateShort.format(new Date(date));
  // e.g., "17 ก.ย. 2569"
}

export function formatDateTime(date: Date | string): string {
  return thaiDateTime.format(new Date(date));
}
```

**Verified:** Node.js v20.20.2 on this machine outputs correct Buddhist Era dates (2026 CE = 2569 BE). No manual +543 arithmetic needed.

### Anti-Patterns to Avoid

- **Auth only in middleware:** CVE-2025-29927 showed middleware can be bypassed. Always check `auth()` in Server Actions.
- **Local users table syncing Clerk:** At <100 users, store only `userId` as text FK. Fetch display names from Clerk when rendering.
- **Single schema file:** Split by domain to avoid 500+ line files and merge conflicts.
- **HTTP Neon driver:** Cannot do transactions. Use WebSocket driver from day one.
- **Storing presigned URLs in DB:** Store only R2 object keys. Generate fresh presigned URLs on each request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth UI (sign-in/sign-up) | Custom login forms | Clerk `<SignIn>` / `<SignUp>` components | Handles OAuth, MFA, email verification, session management |
| Role-based middleware | Custom JWT parsing | `clerkMiddleware()` + `createRouteMatcher()` | Battle-tested, handles edge cases |
| S3 presigning | Manual AWS v4 signature | `aws4fetch` AwsClient | SigV4 is complex; aws4fetch handles it in 1 line |
| ID generation | `uuid()` or `Math.random()` | `@paralleldrive/cuid2` | URL-safe, sortable, collision-resistant |
| Buddhist calendar dates | `year + 543` manual arithmetic | `Intl.DateTimeFormat('th-TH')` | Native API handles it correctly; manual math is error-prone |
| Sidebar component | Custom CSS sidebar | shadcn/ui `sidebar` component | Handles responsive, collapsible, keyboard navigation |

## Common Pitfalls

### Pitfall 1: Clerk Session Token Doesn't Include Custom Metadata by Default

**What goes wrong:** You set `publicMetadata.role` on the user but `sessionClaims.metadata` is undefined when checking in Server Actions.
**Why it happens:** Clerk doesn't include `publicMetadata` in session tokens by default. You must configure custom claims in the Clerk Dashboard.
**How to avoid:** Go to Clerk Dashboard > Sessions > Customize session token. Add `{ "metadata": "{{user.public_metadata}}" }`. Without this step, role checks fail silently.
**Warning signs:** `sessionClaims?.metadata` returning `undefined` despite the user having `publicMetadata` set.

### Pitfall 2: Teacher Pending State Not Handled Cleanly

**What goes wrong:** A teacher signs up and can immediately access teacher routes because the code only checks `role === 'teacher'` and the default is set before approval happens.
**Why it happens:** The gap between signup and superadmin approval isn't modeled in the role system.
**How to avoid:** Use `teacher_pending` as a distinct role value. Teacher routes check for `role === 'teacher'` (approved only). Pending teachers see a "waiting for approval" screen. Superadmin approval action changes `teacher_pending` to `teacher` via Clerk Backend API.
**Warning signs:** New teacher signups can access classrooms before approval.

### Pitfall 3: Neon Connection String Confusion (Pooled vs Direct)

**What goes wrong:** `drizzle-kit push` hangs or fails when using the pooled connection string. Or the app fails to create WebSocket connections when using the direct connection string.
**Why it happens:** Neon provides two connection strings. The pooled one (with `-pooler`) works with the app runtime but not with migration tools. The direct one works with migration tools but may have connection limits.
**How to avoid:** Use two env vars: `DATABASE_URL` (pooled, for app) and `DATABASE_URL_UNPOOLED` (direct, for drizzle-kit). Document this in `.env.example`.
**Warning signs:** "connection timeout" errors from drizzle-kit, or "too many connections" in production.

### Pitfall 4: unsafeMetadata Role Stored But Never Promoted

**What goes wrong:** User selects "teacher" at signup, it goes into `unsafeMetadata`, but nobody promotes it to `publicMetadata`. The session token never gets the role, so all role checks fail.
**Why it happens:** The promotion step (webhook or post-signup Server Action) is forgotten or not wired up.
**How to avoid:** Implement role promotion as the very first Server Action. Use Clerk's `afterSignUpUrl` to redirect to an onboarding page that calls a Server Action to promote the role. Alternative: use a Clerk webhook on `user.created`.
**Warning signs:** New users stuck on a blank page after signup; `publicMetadata` is empty in Clerk Dashboard despite signup being complete.

### Pitfall 5: Schema Relations Circular Import

**What goes wrong:** Drizzle relation definitions reference multiple tables, causing circular imports when each table is in its own file.
**Why it happens:** `classrooms.ts` imports from `groups.ts` for the relation, and `groups.ts` imports from `classrooms.ts`.
**How to avoid:** Put ALL Drizzle relation definitions in a single `db/schema/relations.ts` file. Table definitions stay in their own files. The barrel export (`db/schema/index.ts`) exports everything.
**Warning signs:** "Cannot access X before initialization" errors at import time.

## Code Examples

### Clerk Provider Setup (Root Layout)

```typescript
// src/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/sonner';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="th">
        <body>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### Dashboard Layout with Role-Based Navigation

```typescript
// src/app/(dashboard)/layout.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.metadata?.role;

  if (!role) redirect('/sign-in');

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <main className="flex-1 p-6">{children}</main>
    </SidebarProvider>
  );
}
```

### Server Action with Auth Check (AUTH-04 Pattern)

```typescript
// src/server/actions/admin.ts
'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/auth';

export async function approveTeacher(teacherUserId: string) {
  await requireRole('superadmin');

  const client = await clerkClient();
  await client.users.updateUserMetadata(teacherUserId, {
    publicMetadata: { role: 'teacher' },
  });

  return { success: true };
}
```

### Drizzle Schema Example (Classrooms)

```typescript
// src/db/schema/classrooms.ts
import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { createId } from '@/lib/ids';

export const classrooms = pgTable('classrooms', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classroomMembers = pgTable('classroom_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['teacher', 'student'] }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.classroomId, t.userId),
]);
```

### ID Generation Utility

```typescript
// src/lib/ids.ts
import { init } from '@paralleldrive/cuid2';

export const createId = init({ length: 24 });
```

## Schema Decisions (Claude's Discretion)

### Table Naming: snake_case, plural

All tables use `snake_case` and plural names (e.g., `classrooms`, `classroom_members`, `todo_attachments`). This follows PostgreSQL conventions and matches the existing research schema.

### Schema File Organization: Split by Domain

One file per entity group in `db/schema/`:
- `classrooms.ts` -- classrooms + classroom_members
- `groups.ts` -- groups + group_members
- `phases.ts` -- phases
- `todos.ts` -- todos + todo_attachments
- `submissions.ts` -- submissions + submission_files
- `comments.ts` -- comments
- `relations.ts` -- ALL relation definitions (prevents circular imports)
- `index.ts` -- barrel export

### Route Protection: Middleware + Layout + Server Action (Defense in Depth)

Three layers:
1. **Middleware** (`middleware.ts`): Redirects unauthenticated users. Convenience only, not security.
2. **Layout** (`(dashboard)/layout.tsx`): Checks role exists, redirects if missing. Prevents rendering for wrong roles.
3. **Server Actions**: Every action calls `requireRole()` at the top. This is the real security boundary.

### shadcn/ui Components for Dashboard Shell

Install these components for the dashboard shell:
- `sidebar` -- main navigation (shadcn has a full Sidebar component)
- `button` -- actions
- `card` -- dashboard cards
- `avatar` -- user display
- `separator` -- visual dividers
- `sonner` -- toast notifications
- `badge` -- role indicators (pending/approved)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected -- needs setup |
| Config file | None -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Teacher sign-in reaches teacher dashboard | smoke/manual | Manual -- requires Clerk session | N/A |
| AUTH-02 | Student sign-in reaches student view | smoke/manual | Manual -- requires Clerk session | N/A |
| AUTH-03 | Role-based route protection | unit | `npx vitest run src/lib/__tests__/auth.test.ts -t "requireRole"` | Wave 0 |
| AUTH-04 | Server Action auth check | unit | `npx vitest run src/lib/__tests__/auth.test.ts -t "server action"` | Wave 0 |
| L10N-01 | Thai UI text renders | manual-only | Visual inspection -- hardcoded strings | N/A |
| L10N-02 | Buddhist Era date format | unit | `npx vitest run src/lib/__tests__/format.test.ts -t "formatDate"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest` + `@vitejs/plugin-react` -- install test framework
- [ ] `vitest.config.ts` -- configure with path aliases matching tsconfig
- [ ] `src/lib/__tests__/auth.test.ts` -- unit tests for requireRole(), getCurrentRole()
- [ ] `src/lib/__tests__/format.test.ts` -- unit tests for formatDate(), formatDateShort(), formatDateTime()
- [ ] `src/db/__tests__/schema.test.ts` -- schema smoke test (tables export correctly, relations defined)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | Yes | v20.20.2 | -- |
| npm | Package management | Yes | 10.8.2 | -- |
| git | Version control | Yes | 2.39.3 | -- |
| Neon Postgres | Database | External service | -- | Must configure via dashboard |
| Clerk | Authentication | External service | -- | Must configure via dashboard |
| Cloudflare R2 | File storage | External service | -- | Graceful no-op via getR2Config() |

**Missing dependencies with no fallback:**
- Neon database must be provisioned and `DATABASE_URL` / `DATABASE_URL_UNPOOLED` env vars set
- Clerk application must be created and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` env vars set
- Clerk session token must be customized to include `publicMetadata` (Dashboard > Sessions)

**Missing dependencies with fallback:**
- R2 bucket -- `getR2Config()` returns null gracefully when unconfigured (dev can proceed without it)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@clerk/nextjs` v5 `authMiddleware()` | v6+ `clerkMiddleware()` | 2025 | New API, `createRouteMatcher()` pattern |
| Neon HTTP driver default | WebSocket driver for transactions | Ongoing | HTTP cannot do `db.transaction()` |
| framer-motion package name | `motion` package | 2025 | Import from `motion/react` not `framer-motion` |
| Zod v3 | Zod v4 (4.6.5) | 2025-2026 | New API, better TypeScript inference |
| Drizzle schema single file | Split by domain + centralized relations | Best practice | Prevents 500+ line files and circular imports |

**Deprecated/outdated:**
- `authMiddleware()` from @clerk/nextjs v5 -- replaced by `clerkMiddleware()` in v6+
- `neon-http` driver for apps needing transactions -- use WebSocket driver
- Manual `year + 543` for Buddhist Era -- use `Intl.DateTimeFormat('th-TH')`

## Open Questions

1. **Clerk Webhook vs Post-Signup Redirect for Role Promotion**
   - What we know: `unsafeMetadata` is set at signup. Must be promoted to `publicMetadata` server-side.
   - Options: (a) Clerk webhook `user.created` -- reliable but requires webhook endpoint and Svix verification. (b) Post-signup redirect to onboarding page that calls a Server Action -- simpler, no webhook infra needed.
   - Recommendation: Use post-signup redirect (option b). Simpler for <100 users. The redirect page can call a Server Action to read `unsafeMetadata.role` and promote to `publicMetadata` via Clerk Backend API. If the user navigates away before promotion, the dashboard layout catches it and redirects back.

2. **Superadmin Bootstrap**
   - What we know: Superadmin is user jharit. Must be set manually.
   - Recommendation: Set `publicMetadata.role = 'superadmin'` directly in Clerk Dashboard for the first user. No code path needed for superadmin creation.

3. **Neon Region**
   - What we know: STATE.md flags "Neon region (Singapore/ap-southeast-1) must be verified during Phase 1 setup"
   - Recommendation: When provisioning Neon database, select Singapore region for lowest latency to Thai users. Verify Vercel deployment region matches.

## Sources

### Primary (HIGH confidence)
- [Clerk RBAC with publicMetadata](https://clerk.com/docs/guides/secure/basic-rbac) -- role setup, session claims customization, Server Action patterns
- [Clerk clerkMiddleware() Reference](https://clerk.com/docs/reference/nextjs/clerk-middleware) -- middleware setup and route matchers
- [Neon + Drizzle Guide](https://neon.com/docs/guides/drizzle) -- WebSocket driver setup, Pool configuration
- [Drizzle ORM Neon Connection](https://orm.drizzle.team/docs/connect-neon) -- HTTP vs WebSocket driver docs
- [web-cocoon r2.ts](~/Desktop/Innovators%20Tech/web-cocoon/src/cocoon/apply/r2.ts) -- battle-tested R2 presign pattern
- [web-cocoon create-upload-url.ts](~/Desktop/Innovators%20Tech/web-cocoon/src/cocoon/apply/create-upload-url.ts) -- Zod validation + presign Server Action pattern

### Secondary (MEDIUM confidence)
- [Clerk User Metadata Docs](https://clerk.com/docs/guides/users/extending) -- unsafeMetadata vs publicMetadata distinction
- [Clerk Webhooks Guide](https://clerk.com/blog/webhooks-getting-started) -- webhook setup for user.created events

### Tertiary (LOW confidence)
- None -- all findings verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry on 2026-09-17
- Architecture: HIGH -- patterns from official Clerk/Drizzle/Neon docs + battle-tested web-cocoon code
- Pitfalls: HIGH -- documented in project's own research/PITFALLS.md + verified against official sources
- Thai localization: HIGH -- `Intl.DateTimeFormat('th-TH')` tested on this machine, outputs correct BE dates

**Research date:** 2026-09-17
**Valid until:** 2026-10-17 (30 days -- stable stack, no fast-moving dependencies)
