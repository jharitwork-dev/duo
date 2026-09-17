# Pitfalls Research

**Domain:** Project-based learning platform (classroom/group/submission/approval workflow)
**Researched:** 2026-09-17
**Confidence:** HIGH (domain-specific patterns well-documented across LMS ecosystem)

## Critical Pitfalls

### Pitfall 1: File Uploads Through Server Actions Hit Hard Limits on Vercel

**What goes wrong:**
Students upload assignment files (PDFs, images, project archives) through a Next.js Server Action. Anything over ~1MB fails silently or throws a cryptic "Body exceeded 1mb limit" error. Vercel serverless functions have a hard 4.5MB body size cap that cannot be configured away. Students lose work, blame the platform, and stop trusting it.

**Why it happens:**
Developers build a simple `<input type="file">` wired to a Server Action during prototyping. It works for tiny test files. Nobody tests with a real 15MB PDF or a zip of project assets until a student hits it in production.

**How to avoid:**
Use presigned URLs from day one. The Server Action authenticates the user, generates a short-lived R2 presigned URL, and the client uploads directly to R2 -- the file bytes never touch Vercel. Store only the R2 object key in the database. Generate fresh presigned download URLs on demand (never store the presigned URL itself).

**Warning signs:**
- Any `formData.get('file')` in a Server Action that passes file bytes to the server
- No presigned URL generation code in the codebase
- Upload tests only use small files (<500KB)

**Phase to address:**
Phase 1 (Foundation/Infrastructure) -- file upload architecture must be presigned-URL-based from the start. Retrofitting is painful because every submission record's storage reference changes.

---

### Pitfall 2: Neon HTTP Driver Cannot Do Multi-Statement Transactions

**What goes wrong:**
The teacher approves a submission, which should atomically: (1) update submission status, (2) mark the to-do as complete, (3) check if all to-dos in the phase are done, (4) unlock the next phase. With `drizzle-orm/neon-http`, step 2 succeeds but step 4 fails, leaving the database in an inconsistent state -- the to-do shows complete but the phase never unlocks.

**Why it happens:**
Neon's HTTP driver (`@neondatabase/serverless` over HTTP) is optimized for single-query latency in serverless. It does not support interactive/multi-statement transactions. Developers pick it because Drizzle's Neon setup guide defaults to HTTP mode for serverless, and it works perfectly for simple CRUD -- until you need atomicity.

**How to avoid:**
Use the Neon WebSocket driver (`@neondatabase/serverless` with `neonConfig.useSecureWebSocket = true`) for your Drizzle client. This supports full `db.transaction()`. The latency difference is negligible for your scale (<100 users). Alternatively, use Neon's connection pooler with the standard `pg` driver over TCP if not deploying to edge runtime.

**Warning signs:**
- `neon-http` in your Drizzle config
- Any multi-step state change (approval workflows, phase transitions) without `db.transaction()`
- Inconsistent states in production data (submission approved but phase not unlocked)

**Phase to address:**
Phase 1 (Database Setup) -- choose the WebSocket driver before writing any schema or queries. Switching drivers later requires auditing every database call.

---

### Pitfall 3: Authorization Only in Middleware (CVE-2025-29927 Pattern)

**What goes wrong:**
You check `auth().sessionClaims.role === 'teacher'` only in Next.js middleware to protect teacher routes. An attacker (or a curious student) adds an `x-middleware-subrequest` header and bypasses all middleware checks entirely. Students can approve their own submissions, modify other groups' data, or access teacher-only views.

**Why it happens:**
Clerk's middleware integration is convenient and feels like "the right place" for auth. The CVE-2025-29927 vulnerability demonstrated that middleware can be bypassed entirely. Even after patching, the principle holds: middleware is a convenience layer, not a security boundary.

**How to avoid:**
Enforce authorization at three layers:
1. **Middleware** -- redirect unauthenticated users (convenience, not security)
2. **Server Actions / Route Handlers** -- call `auth()` and check roles at the top of every mutation. This is the real security boundary.
3. **Database queries** -- scope all queries with `WHERE classroom_id = ? AND user_role = ?` so even if auth is bypassed, data access is constrained.

Use Clerk's `authorize()` helper at the top of every Server Action. Never rely solely on middleware.

**Warning signs:**
- Auth checks only in `middleware.ts`
- Server Actions that don't call `auth()` before mutating
- No `userId` or `classroomId` scoping in database queries

**Phase to address:**
Phase 1 (Auth Setup) -- establish the pattern in the very first Server Action. Create a helper like `requireTeacher()` that throws if the user isn't a teacher, and use it consistently.

---

### Pitfall 4: Group vs Individual Submission Flag Designed as Afterthought

**What goes wrong:**
You build submissions assuming "one submission per to-do" and later bolt on the group/individual flag. The schema doesn't cleanly answer: "Has this group completed this to-do?" vs "Has this student completed this to-do?" Phase progression logic breaks because completion checks don't account for the submission mode. Teachers see confusing states -- a group to-do shows 3 submissions when there should be 1, or an individual to-do shows "complete" when only 1 of 4 members submitted.

**Why it happens:**
Group submissions and individual submissions have fundamentally different data models. Group: one submission record linked to a group. Individual: N submission records linked to N students, all for the same to-do. Developers treat this as a UI flag rather than a schema-level distinction.

**How to avoid:**
Design the schema upfront with the submission mode in mind:
- `todos` table has a `submission_mode: 'group' | 'individual'` column
- `submissions` table has both `group_id` and `user_id` columns
- For group submissions: `group_id` is set, `user_id` is the submitter (for audit), completion = 1 approved submission
- For individual submissions: `user_id` is set, `group_id` is set (for context), completion = all members have approved submissions
- Phase unlock logic queries differently based on mode

**Warning signs:**
- Submission table has only `user_id` or only `group_id`, not both
- No `submission_mode` column on the to-do table
- Phase completion logic doesn't branch on submission mode
- Tests only cover one submission mode

**Phase to address:**
Phase 1 (Schema Design) -- this is a data model decision that cascades through every feature. Get it right in the schema before building any UI.

---

### Pitfall 5: Phase Progression Logic Becomes an Unmaintainable Tangle

**What goes wrong:**
Teachers want flexibility: some phases require approval, some are free-access. Some to-dos are required, some are optional. The "can this student access this phase?" check starts as a simple boolean and grows into a nested conditional nightmare that nobody can reason about. Edge cases appear: What if a teacher unlocks a phase manually? What if they reorder phases? What if they add a new to-do to an already-completed phase?

**Why it happens:**
Progression logic is distributed across the codebase -- checked in the UI (show/hide), in Server Actions (allow/deny), and in the database (status columns). Each location implements its own version of the rules, and they drift apart.

**How to avoid:**
Centralize progression logic in a single pure function: `canAccessPhase(phase, group, submissions) => { accessible: boolean, reason: string }`. This function is the single source of truth, called from UI (to show locks), Server Actions (to gate access), and tests. Store phase order as an explicit `sort_order` integer, not implicit array position. Make "free-access" a boolean on the phase, not a separate code path.

**Warning signs:**
- Multiple places in the codebase computing "is this phase accessible?"
- No single function that answers the progression question
- Phase ordering relies on array index or creation timestamp
- Teachers report inconsistent lock/unlock states

**Phase to address:**
Phase 2 (Core Features) -- when building phase progression, extract the logic into a shared utility before wiring it to any UI or API.

---

### Pitfall 6: Clerk Role Sync and Token TTL Cause Stale Permissions

**What goes wrong:**
A teacher demotes a student from a group admin role, but the student's JWT still carries the old role for up to 60 minutes (Clerk's default token TTL). During that window, the student can still perform privileged actions. Alternatively, you store roles in Clerk metadata AND in your database, and they get out of sync.

**Why it happens:**
JWTs are stateless -- once issued, they're valid until expiry. Clerk's session tokens cache role claims. Developers assume role changes take effect immediately.

**How to avoid:**
- Keep roles simple: use Clerk's `publicMetadata.role` for the primary teacher/student distinction (set during onboarding, rarely changes)
- For granular permissions (group membership, classroom access), use your own database as the source of truth, checked on every Server Action -- not JWT claims
- If you need instant role revocation, use Clerk's `sessions.revokeSession()` API, but this is heavy-handed; better to check the database for fine-grained permissions

**Warning signs:**
- Role checks that only read from `auth().sessionClaims` without database verification
- Duplicate role data in Clerk metadata and database
- No plan for "what happens when a teacher changes a student's role mid-session?"

**Phase to address:**
Phase 1 (Auth Setup) -- decide the role architecture once: Clerk for identity + coarse role, database for permissions and group membership.

---

### Pitfall 7: Thai Calendar and Date Display Inconsistencies

**What goes wrong:**
Submission timestamps show "2026" (Gregorian) in some places and "2569" (Buddhist Era) in others. Teachers using Thai locale see Buddhist year in the browser's native date picker but Gregorian year in your custom UI. Deadlines get misinterpreted -- a teacher sets a deadline thinking it's BE 2569 but the system stores it as CE 2569 (543 years in the future).

**Why it happens:**
Thailand uses the Buddhist calendar (BE = CE + 543). JavaScript's `Intl.DateTimeFormat` with `th-TH` locale automatically formats dates in Buddhist Era. But date inputs, database timestamps (always CE), and any hardcoded date formatting create a mismatch.

**How to avoid:**
- Store all dates as UTC timestamps in the database (standard practice)
- Display dates using `Intl.DateTimeFormat('th-TH', { dateStyle: 'long' })` consistently -- it handles BE conversion automatically
- Never manually add/subtract 543 years -- use the Intl API
- For date inputs, use a Thai-aware date picker component or clearly label the calendar system
- Test with Thai locale set in the browser

**Warning signs:**
- Mix of `new Date().toLocaleDateString()` and custom date formatting
- Any code that does `year + 543` or `year - 543` manually
- Date inputs using native HTML date picker without locale consideration
- No Thai locale testing in the QA process

**Phase to address:**
Phase 2 (UI Implementation) -- create a single `formatDate()` utility that wraps `Intl.DateTimeFormat` with Thai locale, and use it everywhere.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing files via Server Action (not presigned URL) | Simpler code, faster to build | 1MB limit, full rewrite of upload flow | Never -- presigned URLs are equally simple with a helper |
| Single admin/student role (no classroom-scoped roles) | Simpler auth logic | Cannot have a student who is a teacher in another classroom | Acceptable for v1 if Innovator's Academy and Cocoon have separate teacher pools |
| Hardcoding phase order by array index | No `sort_order` column needed | Reordering phases requires rewriting all progression records | Never -- add `sort_order` integer from day one |
| Using `drizzle-kit push` in production | Fast iteration, no migration files | No rollback path, no audit trail of schema changes | Only during initial prototyping (first 2 weeks) |
| Skipping optimistic UI for submissions | Less client-side complexity | Students double-click submit, or think upload failed and re-upload | Acceptable for v1 but add loading states at minimum |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Clerk + Next.js | Checking auth only in middleware | Check auth in middleware (redirect) AND in every Server Action (security boundary) |
| Clerk metadata | Storing frequently-changing data (group membership) in Clerk metadata | Use Clerk for identity + coarse role only. Store group membership and permissions in your Neon database |
| R2 presigned URLs | Storing the presigned URL in the database | Store the R2 object key. Generate fresh presigned URLs on each download request (they expire) |
| R2 CORS | Forgetting CORS config for direct browser uploads | Configure R2 bucket CORS via Wrangler CLI before implementing client-side uploads |
| Neon + Vercel | Database in US, Vercel function in Singapore | Deploy Neon database in the same region as your Vercel deployment (likely Singapore/ap-southeast-1 for Thai users) |
| Resend | Sending emails in Server Actions synchronously | Queue email sends or fire-and-forget. Don't block the submission response on email delivery |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries on classroom dashboard (load groups, then load phases per group, then submissions per phase) | Dashboard takes 3-5 seconds to load | Use Drizzle's relational queries with `with` clause to load nested data in fewer queries | 10+ groups with 5+ phases each (~50 queries) |
| Loading all submissions to check phase completion | Phase unlock check slows down as submissions accumulate | Add a `completed_at` timestamp on the to-do record, updated when submission is approved. Check the to-do status, not submission count | 500+ submissions per classroom |
| R2 file listing to show submission attachments | Slow file browsing, R2 LIST is not fast | Store file metadata (name, size, type, R2 key) in database. Never call R2 LIST in user-facing flows | 100+ files per group |
| No database indexes on foreign keys | Queries slow down as data grows | Add indexes on `group_id`, `classroom_id`, `phase_id`, `user_id` in submission and to-do tables | 1000+ rows in any table |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No server-side file type validation on uploads | Students upload executable files disguised as PDFs; teachers download and run them | Validate file extension AND MIME type server-side before generating presigned URL. Allowlist: pdf, docx, xlsx, pptx, jpg, png, mp4, zip |
| Submission data accessible across groups | Student in Group A can view Group B's submissions by guessing submission IDs | Always scope database queries with `group_id` from the authenticated user's membership, not from request parameters |
| Teacher actions not scoped to their classrooms | A teacher in Classroom A can modify Classroom B's data | Every teacher mutation must verify `classroom_id` membership, not just `role === 'teacher'` |
| Presigned URLs shared between students | One student generates a presigned upload URL and shares it; another uploads malicious content under the first student's identity | Bind presigned URLs to the authenticated user's ID via object key path: `submissions/{userId}/{todoId}/{filename}` |
| No file size limit on presigned URL generation | Students upload 2GB video files, blowing R2 storage costs | Set `Content-Length` condition on presigned URL (e.g., max 50MB) |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No upload progress indicator | Student uploads a 20MB file, sees nothing for 30 seconds, thinks it failed, navigates away | Show upload progress bar for presigned URL uploads (XHR/fetch with progress events) |
| Submission status unclear after upload | Student submits, sees no confirmation. Did it work? They submit again, creating duplicates | Show clear success state: "Submitted -- waiting for teacher approval" with timestamp |
| Phase locked with no explanation | Student sees a locked phase icon but doesn't know why | Show "Complete [To-do X] and [To-do Y] to unlock this phase" -- specific, actionable |
| Teacher approval flow requires too many clicks | Teacher must: open group -> open phase -> open to-do -> open submission -> click approve. 5 clicks per submission, 50 submissions = exhaustion | Provide a teacher dashboard with a flat list of pending submissions, one-click approve/reject with optional comment |
| Mixed Thai/English without consistency | Some buttons say "Submit", others say "ส่ง". Same action, different labels | Establish a glossary: decide which terms stay English (technical: "Phase", "Submit") and which are Thai (navigational: "หน้าแรก"). Document the glossary and follow it |
| Duolingo-style path is visually fun but confusing | Students can't tell which node they're on, what's locked, what's optional | Use strong visual states: completed (filled + check), current (glowing/pulsing), locked (gray + lock icon), free-access (no lock, different border) |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **File Upload:** Often missing file size limits, file type validation, upload progress, and error recovery -- verify all four exist
- [ ] **Submission Flow:** Often missing duplicate submission prevention, confirmation state, and "undo/resubmit" -- verify students can't accidentally double-submit and can resubmit before approval
- [ ] **Phase Progression:** Often missing edge cases: what if teacher adds a new to-do to an already-completed phase? What if teacher reorders phases? -- verify these scenarios
- [ ] **Teacher Approval:** Often missing bulk actions, rejection with feedback, and the ability to un-approve (revert a mistaken approval) -- verify teachers can efficiently review at scale
- [ ] **Group Membership:** Often missing: what happens when a student is removed from a group mid-project? Their submissions stay? Get orphaned? -- verify the removal flow
- [ ] **Auth Scoping:** Often missing classroom-level isolation -- verify a teacher in Classroom A truly cannot see or modify Classroom B's data through API manipulation
- [ ] **Thai Dates:** Often missing Buddhist Era display -- verify all user-facing dates use `th-TH` locale formatting

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Files uploaded through Server Actions (not presigned) | MEDIUM | Add presigned URL flow alongside, migrate existing files by re-uploading to R2 with proper keys, update DB references, remove old flow |
| Neon HTTP driver used (no transactions) | MEDIUM | Switch to WebSocket driver, audit all multi-step mutations for atomicity, add transactions where needed |
| Auth only in middleware | LOW | Add `auth()` checks to all Server Actions (can be done incrementally), no data migration needed |
| Group/individual submission not in schema | HIGH | Schema migration to add `submission_mode`, backfill existing data, rewrite completion logic, re-test all progression |
| Phase progression logic scattered | MEDIUM | Extract to pure function, replace all call sites, add comprehensive tests for edge cases |
| Mixed date formats (CE vs BE) | LOW | Create `formatDate()` utility, find-and-replace all date formatting calls, visual QA pass |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| File upload via Server Action | Phase 1: Infrastructure | Presigned URL helper exists and is used in first upload feature |
| Neon HTTP transaction limitation | Phase 1: Database Setup | `drizzle.config.ts` uses WebSocket driver; approval workflow uses `db.transaction()` |
| Auth only in middleware | Phase 1: Auth Setup | Every Server Action starts with `auth()` check; helper functions like `requireTeacher()` exist |
| Group/individual schema confusion | Phase 1: Schema Design | `submission_mode` column on todos table; both `group_id` and `user_id` on submissions table |
| Phase progression tangle | Phase 2: Core Features | Single `canAccessPhase()` function exists with tests covering all modes (required, free-access, group, individual) |
| Clerk token TTL stale roles | Phase 1: Auth Setup | Fine-grained permissions (group membership) checked from DB, not JWT claims |
| Thai calendar inconsistency | Phase 2: UI Implementation | Single `formatDate()` utility using `Intl.DateTimeFormat('th-TH')`, used in all date displays |
| No file type/size validation | Phase 1: Infrastructure | Presigned URL generation validates file type allowlist and max size before signing |
| Submission cross-group access | Phase 1: Schema + Auth | All queries include `group_id` scope; tested with multi-group data |
| Teacher dashboard click fatigue | Phase 3: Teacher Experience | Flat pending-submissions view with one-click approve exists |

## Sources

- [Vercel Serverless Function body size limits](https://vercel.com/docs/functions/limitations)
- [Next.js Server Actions 1MB body limit discussion](https://github.com/vercel/next.js/discussions/49891)
- [Drizzle ORM Neon driver documentation](https://orm.drizzle.team/docs/connect-neon)
- [Neon HTTP driver transaction limitation](https://community.neon.tech/t/how-do-i-handle-transactions/1067)
- [CVE-2025-29927 Next.js middleware bypass](https://clerk.com/articles/nextjs-authentication-guide-2026)
- [Clerk RBAC with Next.js](https://clerk.com/docs/guides/secure/basic-rbac)
- [Cloudflare R2 presigned URL file size limits](https://community.cloudflare.com/t/cloudflare-r2-presigned-url-limit-file-size/455122)
- [Next.js i18n pitfalls](https://dev.to/utlkit/6-pitfalls-of-building-a-multilingual-site-with-nextjs-15-from-query-strings-to-url-paths-51fh)
- [Canvas group submission design patterns](https://blogs.sussex.ac.uk/tel/2019/11/19/collaborative-assessment-group-submissions-in-canvas/)
- [Drizzle ORM PostgreSQL best practices](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)

---
*Pitfalls research for: Project-based learning platform (Duo)*
*Researched: 2026-09-17*
