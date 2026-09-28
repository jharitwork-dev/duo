---
phase: quick-260928-iwi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/r2.ts
  - src/lib/format.ts
  - src/lib/node-path.ts
  - src/lib/__tests__/format.test.ts
  - src/lib/__tests__/node-path.test.ts
  - src/server/queries/submission.ts
  - src/server/actions/submission.ts
  - src/components/cocoon/cocoon-logo.tsx
  - src/components/cocoon/cocoon-header.tsx
  - src/components/cocoon/bottom-tab-bar.tsx
  - src/components/cocoon/student-shell.tsx
  - src/components/cocoon/status-pill.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/student/tasks/page.tsx
  - src/app/(dashboard)/student/deadlines/page.tsx
  - src/app/(dashboard)/student/profile/page.tsx
  - src/components/student/profile-sign-out.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
  - src/app/(auth)/sign-in/sso-callback/page.tsx
  - src/components/auth/cocoon-sign-in.tsx
  - src/app/(dashboard)/student/page.tsx
  - src/app/(dashboard)/student/classroom/[classroomId]/page.tsx
  - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
  - src/components/student/phase-stepper.tsx
  - src/components/student/node-path.tsx
  - src/app/(dashboard)/todo/[todoId]/page.tsx
  - src/components/student/todo-submit-view.tsx
  - src/components/student/submission-confirm-dialog.tsx
  - src/components/student/submission-status-view.tsx
  - src/components/student/submission-file-row.tsx
  - src/components/ui/dialog.tsx
autonomous: true
requirements: [SUB-01, SUB-04, SUB-05, SUB-06, UI-01, UI-02, UI-03, UI-04]

must_haves:
  truths:
    - "A signed-in student sees the Cocoon shell (cream decor background + 4-tab bottom bar) on every dashboard page; teachers/admins still see the unchanged sidebar layout"
    - "Unauthenticated users see the Cocoon login screen with Google and email/phone OTP sign-in (no Clerk <SignIn /> card)"
    - "Student group home shows a phase stepper plus a 1-2-1-2 node path of to-dos with lock state and submission status pills"
    - "A student can pick PDF/DOC/DOCX files (click or drag), confirm in a dialog, upload to R2 and land on the submitted/pending view with history"
    - "Group to-dos accept one submission for the whole group; individual to-dos are scoped per student"
    - "A new submission is blocked while the latest is pending or approved; a rejected one re-opens upload"
    - "Layout matches refs/*.png at 402px and is a centred column with floating pill tab bar at md+"
  artifacts:
    - path: "src/server/actions/submission.ts"
      provides: "createSubmissionUploadUrl, createSubmission, getSubmissionFileUrl"
      exports: ["createSubmissionUploadUrl", "createSubmission", "getSubmissionFileUrl"]
    - path: "src/server/queries/submission.ts"
      provides: "getTodoSubmissionStatuses, getSubmissionHistory, resolveStudentTodoAccess"
    - path: "src/lib/node-path.ts"
      provides: "Pure row/lock/current-node/default-phase logic (unit tested)"
    - path: "src/components/cocoon/student-shell.tsx"
      provides: "Student-only app shell"
    - path: "src/components/auth/cocoon-sign-in.tsx"
      provides: "Custom Clerk sign-in flow (Google + OTP)"
    - path: "src/components/student/node-path.tsx"
      provides: "Node path renderer"
    - path: "src/components/student/todo-submit-view.tsx"
      provides: "Upload state + confirm dialog wiring"
  key_links:
    - from: "src/app/(dashboard)/layout.tsx"
      to: "StudentShell"
      via: "role === ROLES.STUDENT branch"
      pattern: "StudentShell"
    - from: "src/components/student/todo-submit-view.tsx"
      to: "createSubmissionUploadUrl -> fetch PUT -> createSubmission"
      via: "server actions + presigned PUT"
      pattern: "createSubmissionUploadUrl|createSubmission\\("
    - from: "src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx"
      to: "getTodoSubmissionStatuses + src/lib/node-path.ts"
      via: "server fetch then pure lock/status computation"
      pattern: "getTodoSubmissionStatuses"
---

<objective>
Replace the default-shadcn STUDENT UI with the Cocoon Figma design (shell + bottom tab bar, custom login,
node-path home, to-do upload/confirm/submitted views) and ship the Phase-3 file-submission backend behind it.
Teacher/admin UI must remain pixel-for-pixel unchanged.

Purpose: Thai students (mostly on phones) get the branded Duolingo-style path and can actually submit work.
Output: submission server layer + pure tested helpers, student shell/login/placeholder tabs, node-path home, student to-do submission page.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./AGENTS.md
@.planning/quick/260928-iwi-cocoon-ui-redesign-from-figma-student-fl/260928-iwi-CONTEXT.md

Visual targets (open with Read to compare at 402px):
- refs/01-login.png, refs/02-home-node-path.png, refs/03-submit-upload.png,
  refs/04-submit-confirm-dialog.png, refs/05-submitted-pending.png, refs/06-bottom-tab-bar.png
  (all under .planning/quick/260928-iwi-cocoon-ui-redesign-from-figma-student-fl/)

HARD RULES (from CONTEXT.md, LOCKED):
- DO NOT call any Figma MCP tool. CONTEXT.md + refs + public/figma/* are the only source of truth.
- Teacher/admin UI unchanged. `GroupPhaseView` is still rendered for TEACHERS on the shared
  `/student/classroom/[id]/group/[id]` page, so it must NOT be deleted.
- Fonts stay as CSS @import in globals.css (commit 63d4bb7) — never switch to next/font.
- Next.js is 16.3 (breaking changes). Before using an unfamiliar API (searchParams typing, route precedence,
  revalidatePath) read the relevant file under `node_modules/next/dist/docs/01-app/`.
- `motion` / `react-dropzone` are NOT installed — do not add them. Drag-and-drop uses native DOM events.
- Plain `<img>` is OK for /figma assets; put `/* eslint-disable @next/next/no-img-element */` at file top
  like `src/components/cocoon/decor-background.tsx`.
- Figma y-coordinates include a ~50px iOS status bar that we do NOT render. Convert top offsets as
  `figmaY - 50` and add `env(safe-area-inset-top)`; horizontal positions are used as-is at ≤430px.
- Brand tokens already exist as Tailwind classes: `bg-cocoon-cream text-cocoon-blue bg-cocoon-blue-soft
  bg-cocoon-orange text-cocoon-yellow text-cocoon-green text-cocoon-ink text-cocoon-heading text-cocoon-muted
  text-cocoon-subtle text-cocoon-disabled border-cocoon-line bg-cocoon-track shadow-cocoon-node font-latin`.

<interfaces>
Existing code the executor uses directly (no exploration needed):

src/lib/auth.ts
  getCurrentRole(): Promise<UserRole | null>
  requireRole(...allowed: UserRole[]): Promise<UserRole>   // throws 'Unauthorized'
  getCurrentUserId(): Promise<string>
src/lib/constants.ts
  ROLES = { SUPERADMIN, TEACHER, TEACHER_PENDING, STUDENT: 'student' }, ROUTES = { SIGN_IN:'/sign-in', SIGN_UP:'/sign-up', STUDENT_DASHBOARD:'/student', ... }
src/lib/r2.ts (framework-free)
  validateFile(contentType, size): boolean   // ALLOWED_TYPES set, 50MB (teacher attachments — keep behaviour)
  submissionKey(userId, todoId, filename) => `submissions/${userId}/${todoId}/${filename}`
  presignPut(key, contentType, expiresSec=1800): Promise<string>
  presignGet(key, expiresSec=3600, disposition?): Promise<string>
src/lib/ids.ts   createId()  (cuid2, length 24)
src/lib/format.ts  formatDate / formatDateShort / formatDateTime (Intl th-TH)
src/db/schema/submissions.ts
  submissions { id, todoId, submittedBy, groupId (nullable), status: 'pending'|'approved'|'rejected', textContent, linkUrl, reviewedBy, reviewedAt, createdAt, updatedAt }
  submissionFiles { id, submissionId, fileName, fileKey, contentType, fileSize, createdAt }
  relations: submissions.files (many), submissions.todo, submissions.group; submissionFiles.submission
src/db/schema/todos.ts   todos { id, phaseId, title, description, notes, orderIndex, submissionMode: 'group'|'individual', isArchived, deadline, ... }
src/db/schema/phases.ts  phases { id, groupId, name, orderIndex, status: 'locked'|'active'|'completed', isFreeAccess, isArchived, deadline }
src/db/schema/groups.ts  groups { id, classroomId, name }, groupMembers { groupId, userId }
src/db/schema/classrooms.ts classroomMembers { classroomId, userId }
src/server/queries/todo.ts   getTodoDetail(todoId, userId) -> todo with attachments + phase.group.classroom (throws if not classroom member)
src/server/queries/phase.ts  getActivePhases(groupId) -> phases (orderIndex asc) with todos (non-archived, orderIndex asc)
src/server/queries/group.ts  getGroupById(groupId, userId) -> group+members | null ; getStudentGroup(classroomId, userId)
src/server/queries/classroom.ts getStudentClassrooms(userId), getClassroomById(classroomId, userId)
src/server/actions/todo.ts   pattern: 'use server'; zod schema; requireRole(...); db.query...; presignGet(...)
src/components/ui/dialog.tsx  base-ui Dialog: Dialog, DialogContent (props: className, showCloseButton), DialogTitle, DialogDescription, DialogClose; DialogOverlay is internal to DialogContent (bg-black/10)
src/components/cocoon/decor-background.tsx  <DecorBackground />  (fixed, -z-10, cream bg)
Clerk 7.9: `useSignIn` from '@clerk/nextjs/legacy' ({ isLoaded, signIn, setActive });
           `AuthenticateWithRedirectCallback`, `useClerk`, `useUser`, `SignOutButton` from '@clerk/nextjs';
           `isClerkAPIResponseError` from '@clerk/nextjs/errors'. Check exact signatures in
           node_modules/@clerk/react/dist/*legacy*.d.ts / @clerk/types before coding.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Submission backend + pure helpers (format, node-path logic) with unit tests</name>
  <files>src/lib/r2.ts, src/lib/format.ts, src/lib/node-path.ts, src/lib/__tests__/format.test.ts, src/lib/__tests__/node-path.test.ts, src/server/queries/submission.ts, src/server/actions/submission.ts</files>
  <behavior>
    format.test.ts (append to existing file, keep existing tests passing):
    - formatSubmissionDate(new Date('2026-09-18T06:59:00Z')) === '18 ก.ย. 13.59'  (Asia/Bangkok, day + short Thai month, HH.mm 24h dot)
    - formatSubmissionDate(new Date('2026-01-05T17:05:00Z')) === '6 ม.ค. 00.05' (zero-padded, timezone rollover)
    - formatFileSize(2.4*1024*1024) === '2.4 MB'; formatFileSize(1536) === '1.5 KB'; formatFileSize(500) === '500 B'
    - fileTypeTag('market-v1.pdf') === 'PDF'; fileTypeTag('a.DOCX') === 'DOCX'; fileTypeTag('noext') === 'FILE'
    - validateSubmissionFile('application/pdf', 1000) true; ('application/msword', 1000) true; ('application/pdf', 11*1024*1024) false; ('text/html', 10) false
    - validateFile('application/msword', 1000) true (msword added to shared allow-list)
    node-path.test.ts:
    - buildNodeRows([a,b,c,d,e]) => [[a],[b,c],[d],[e]] ; buildNodeRows([]) => []
    - statusFromSubmission(undefined)==='none'; 'pending'->'pending'; 'rejected'->'rejected'; 'approved'->'approved'
    - computeLockedTodoIds: phase {status:'locked', isFreeAccess:false} => all ids locked;
      {status:'completed'} or isFreeAccess:true => none locked;
      active phase rows [[a],[b,c],[d]] with statuses {a:'pending'} => b,c unlocked, d locked;
      statuses {a:'pending', b:'approved'} => d still locked (c has no submission); all submitted => none locked
    - pickCurrentTodoId: first unlocked todo whose status is 'none' or 'rejected' (orderIndex order); null if none
    - pickDefaultPhaseId(phases, requested?): requested id returned only if that phase is viewable (not locked, or isFreeAccess, or completed);
      otherwise first 'active', else last 'completed', else first; null for []
  </behavior>
  <action>
    RED first: write the tests above, run `npx vitest run src/lib/__tests__` and confirm they fail; then implement.

    1. `src/lib/r2.ts`: add `'application/msword'` to ALLOWED_TYPES. Export `SUBMISSION_MAX_FILE_SIZE = 10 * 1024 * 1024`
       and `validateSubmissionFile(contentType, size)` = `ALLOWED_TYPES.has(contentType) && size > 0 && size <= SUBMISSION_MAX_FILE_SIZE`
       (allow-list = PDF, DOC, DOCX + existing images/pptx/xlsx/zip/mp4 per CONTEXT "A. Upload state → Validation").
       Also export `SUBMISSION_ACCEPT` string for `<input accept>`: `.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.pptx,.xlsx,.zip,.mp4`
       plus the MIME types. Keep `validateFile` 50MB behaviour for teacher attachments.
    2. `src/lib/format.ts`: add
       - `formatSubmissionDate(date)`: `Intl.DateTimeFormat('th-TH', { day:'numeric', month:'short', timeZone:'Asia/Bangkok' })`
         + `' '` + HH + '.' + mm from `Intl.DateTimeFormat('en-GB', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Bangkok' })`
         (use formatToParts; do not rely on the host TZ so SSR and client agree).
       - `formatFileSize(bytes)` (B / KB / MB with 1 decimal, same thresholds as todo-attachments-list.tsx; strip nothing — '2.4 MB').
       - `fileTypeTag(fileName)` → uppercase extension or 'FILE'.
    3. `src/lib/node-path.ts` (pure, no DB/React imports): export
       `type SubmissionStatus = 'none'|'pending'|'rejected'|'approved'`,
       `buildNodeRows<T>(todos: T[]): T[][]` (alternating 1,2,1,2… in given order),
       `statusFromSubmission(status?: 'pending'|'approved'|'rejected'): SubmissionStatus`,
       `computeLockedTodoIds(phase: {status, isFreeAccess}, rows: {id:string}[][], statuses: Record<string, SubmissionStatus>): Set<string>`
       implementing CONTEXT "Locking rule": locked&!free → all; completed||free → none; else row 0 unlocked, row r unlocked iff every todo in rows < r has status !== 'none'.
       Add comment `// TODO(Phase 4): require 'approved' instead of any submission once teacher review ships.`
       `pickCurrentTodoId(rows, locked, statuses): string | null`,
       `pickDefaultPhaseId(phases: {id,status,isFreeAccess}[], requested?: string): string | null`.
    4. `src/server/queries/submission.ts` (server-only, NO 'use server'):
       - `resolveStudentTodoAccess(todoId, userId)`: load todo (non-archived) with phase → group; require a `classroomMembers` row for
         group.classroomId AND a `groupMembers` row (groupId = phase.groupId, userId). Return `{ todo, phase, groupId, classroomId }` or null.
       - `getTodoSubmissionStatuses(groupId, userId, todos: {id, submissionMode}[]): Promise<Record<string, SubmissionStatus>>`:
         return {} if user is not in groupMembers for groupId or todos empty. One query: submissions where todoId IN ids ordered by createdAt desc;
         for each todo pick the first row matching scope — group mode: `row.groupId === groupId`; individual: `row.submittedBy === userId` (SUB-04/SUB-05).
         Missing → 'none'.
       - `getSubmissionHistory(todoId, userId)`: uses resolveStudentTodoAccess (null → return null); same scope rule; returns
         `{ groupId, classroomId, submissions: Array<{ id, status, createdAt, attempt: number, files: {id,fileName,contentType,fileSize}[] }> }`
         newest first, `attempt` = chronological 1-based index (oldest = 1). Use `db.query.submissions.findMany({ with: { files: true } })`.
    5. `src/server/actions/submission.ts` ('use server'; every action starts `await requireRole(ROLES.STUDENT)` + `getCurrentUserId()`; zod-validated).
       Return discriminated unions `{ ok: true, ... } | { ok: false, error: string }` with Thai messages for expected failures
       (Next strips thrown error messages in prod), only throw for auth failures.
       - `createSubmissionUploadUrl({ todoId, fileName (1-255), contentType, size (int > 0) })`: validateSubmissionFile else
         `{ok:false,error:'ไฟล์ไม่รองรับหรือใหญ่เกิน 10 MB'}`; resolveStudentTodoAccess else 'ไม่มีสิทธิ์ส่งงานนี้';
         reject if phase.status==='locked' && !phase.isFreeAccess ('Phase นี้ยังไม่ปลดล็อค');
         `safeName = fileName.replace(/[^\w.\-]/g, '_').slice(-100)`; key = `submissionKey(userId, todoId, \`${createId()}-${safeName}\`)`;
         return `{ ok:true, key, url: await presignPut(key, contentType) }`.
       - `createSubmission({ todoId, files: [{ key, fileName, contentType, size }] (min 1, max 10) })`: re-run access + lock check;
         every key must start with `submissions/${userId}/${todoId}/` and pass validateSubmissionFile; find latest submission in scope
         (same group/individual rule) — if status is 'pending' or 'approved' return `{ok:false,error:'มีงานที่ส่งแล้วรอตรวจหรือผ่านแล้ว'}`;
         `db.transaction`: insert submissions `{ todoId, submittedBy:userId, groupId, status:'pending' }` returning id, then insert submission_files rows.
         `revalidatePath(\`/todo/${todoId}\`)` and `revalidatePath(\`/student/classroom/${classroomId}/group/${groupId}\`)`. Return `{ok:true, submissionId}`.
       - `getSubmissionFileUrl({ fileId })`: load file with submission; resolveStudentTodoAccess(submission.todoId); check scope
         (group todo: submission.groupId === groupId; individual: submission.submittedBy === userId) else `{ok:false}`;
         `presignGet(fileKey, 3600, \`inline; filename="${encodeURIComponent(fileName)}"\`)` → `{ok:true,url}`.
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx vitest run src/lib/__tests__ && npx tsc --noEmit && npm run lint && npm test</automated>
  </verify>
  <done>All new + existing unit tests pass; tsc, lint, test green; three server actions and three query helpers exported with the signatures above; msword allowed. Commit: `feat(quick-260928-iwi): submission backend and node-path helpers`.</done>
</task>

<task type="auto">
  <name>Task 2: Student shell, bottom tab bar, placeholder tabs, Cocoon auth layout + custom login flow</name>
  <files>src/components/cocoon/cocoon-logo.tsx, src/components/cocoon/cocoon-header.tsx, src/components/cocoon/bottom-tab-bar.tsx, src/components/cocoon/student-shell.tsx, src/components/cocoon/status-pill.tsx, src/app/(dashboard)/layout.tsx, src/app/(dashboard)/student/tasks/page.tsx, src/app/(dashboard)/student/deadlines/page.tsx, src/app/(dashboard)/student/profile/page.tsx, src/components/student/profile-sign-out.tsx, src/app/(auth)/layout.tsx, src/app/(auth)/sign-in/[[...sign-in]]/page.tsx, src/app/(auth)/sign-in/sso-callback/page.tsx, src/components/auth/cocoon-sign-in.tsx</files>
  <action>
    Shared primitives (used again in Task 3):
    - `cocoon-logo.tsx`: `<CocoonLogo className?/>` → `<img src="/figma/3a22e.png" alt="innovator's Cocoon" width={176} height={82}>` (w-[176px] h-[82px]).
    - `cocoon-header.tsx`: `<CocoonHeader variant="home" | "back" backHref? />` with top padding `pt-[calc(env(safe-area-inset-top)+23px)]` (Figma logo y 73 − 50).
      home: logo at left 14px, bell `/figma/2bba0.svg` 26×30 right-aligned so its left edge is at x=343 (i.e. `pr-[33px]`), vertically centred with logo; bell is a non-interactive `<img alt="การแจ้งเตือน">` (behaviour out of scope).
      back: logo centred (x=113 on 402), back `<Link href={backHref}>` with `/figma/be57a.svg` 20×20 at left 33px vertically centred with logo, `aria-label="ย้อนกลับ"`.
    - `status-pill.tsx`: `<StatusPill status: 'none'|'locked'|'pending'|'rejected'|'approved' size?: 'sm'|'lg' label? />` exactly per CONTEXT "Status pills":
      rounded-[26px] px-2 inline-flex items-center gap-1; none: bg-[rgba(255,27,15,.2)] text-[10px] font-medium text-cocoon-orange dot 8px bg-cocoon-orange "ยังไม่ส่ง";
      locked: bg-[rgba(15,23,42,.05)] text-[12px] font-medium text-[#9da1a6] dot 7px bg-[rgba(29,37,49,.4)] "ยังไม่ปลดล็อค";
      pending: bg-[rgba(0,105,166,.2)] text-cocoon-blue "รอตรวจ"; rejected: bg-[rgba(250,168,25,.2)] text-[#c98200] dot bg-cocoon-yellow "ต้องแก้ไข";
      approved: bg-[rgb(26_158_85/.15)] text-cocoon-green "สำเร็จแล้ว". sm = text 10–12px per status; lg = h-[31px] text-[16px] font-medium dot 17px.
      `label` overrides text (Task 3 uses "ผ่านการตรวจ" for approved on the submitted page).

    Shell (CONTEXT "Bottom tab bar" + "Routing / layout"):
    - `bottom-tab-bar.tsx` ('use client', `usePathname`): 4 `<Link>` tabs — หน้าแรก `/student` (lucide `House`), งานของฉัน `/student/tasks` (`SquareCheck`),
      กำหนดส่ง `/student/deadlines` (`Calendar`), โปรไฟล์ `/student/profile` (`User`); icons size 22 strokeWidth 1.75; label text-[11px] font-bold; column `flex flex-col items-center gap-1`.
      Active = text-cocoon-orange, else text-cocoon-muted; `aria-current="page"` on active. Home active when pathname is `/student`, starts with `/student/classroom`, or starts with `/todo`;
      other tabs active on exact prefix match. Mobile: `fixed inset-x-0 bottom-0 z-40 bg-white border-t border-cocoon-line px-6 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex justify-between`.
      md+: `md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-6 md:w-full md:max-w-md md:rounded-full md:border md:shadow-lg md:px-10`. Match refs/06-bottom-tab-bar.png.
    - `student-shell.tsx`: `<StudentShell>{children}</StudentShell>` → `<div className="relative min-h-svh w-full font-sans text-cocoon-ink"><DecorBackground /><main className="mx-auto w-full max-w-[402px] md:max-w-[680px] pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-32">{children}</main><BottomTabBar /></div>`.
      No horizontal padding in the shell — pages apply the 33px gutter (`px-[33px]`) themselves because headers use other x offsets.
    - `(dashboard)/layout.tsx`: after the existing auth/role/teacher_pending checks, `if (role === ROLES.STUDENT) return <StudentShell>{children}</StudentShell>;`
      Leave the Sidebar branch byte-for-byte unchanged for teacher/superadmin.
    - Placeholder pages (each `await requireRole(ROLES.STUDENT)`): `/student/tasks` heading "งานของฉัน", `/student/deadlines` heading "กำหนดส่ง" — heading 20px bold text-cocoon-blue under `<CocoonHeader variant="home"/>`,
      then white card `bg-white border border-cocoon-line rounded-[12px] p-6 text-center` with "เร็ว ๆ นี้" + muted 14px line.
      `/student/profile`: heading "โปรไฟล์"; server component using `currentUser()` from '@clerk/nextjs/server' → avatar (imageUrl, 72px rounded-full, plain img), full name 20px bold, primary email/phone 14px muted,
      then `<ProfileSignOut />` ('use client', `useClerk().signOut({ redirectUrl: '/sign-in' })`) styled as the Cocoon primary button (`bg-cocoon-orange text-white font-bold text-[16px] h-[55px] rounded-[12px] w-full`) labelled "ออกจากระบบ".

    Auth (CONTEXT "Login"):
    - `(auth)/layout.tsx`: `<div className="relative flex min-h-svh w-full flex-col items-center justify-center"><DecorBackground />{children}</div>` (sign-up + onboarding keep Clerk components, now on cream decor).
    - `sign-in/[[...sign-in]]/page.tsx` renders `<CocoonSignIn />`. `sign-in/sso-callback/page.tsx` renders `<AuthenticateWithRedirectCallback />` (static segment beats the optional catch-all —
      confirm in node_modules/next/dist/docs routing docs; if the catch-all wins, instead branch inside the catch-all on `params['sign-in']?.[0] === 'sso-callback'`).
    - `cocoon-sign-in.tsx` ('use client'): root `min-h-svh w-full max-w-[402px] self-stretch mx-auto` (so it is top-aligned despite layout centering), positions converted with figmaY−50:
      logo at left 13px top 25px+safe-area; title "เข้าสู่ระบบ" text-[36px] font-bold text-cocoon-orange at x=30 (≈66px below logo top);
      highlight "พร้อมไปต่อกับโปรเจกต์ของคุณ" `inline-block bg-cocoon-blue text-white text-[20px] font-bold pl-[3px] pr-2 h-[39px] leading-[39px]` at x=33, 56px below title top;
      card `mx-[33px] mt-[42px] bg-white border border-cocoon-line rounded-[16px] px-[19px] py-5` (336 wide) containing:
      Google button (h-[56px] w-full bg-white border border-cocoon-line rounded-[8px], `/figma/0938b.png` 20×20 + "เข้าสู่ระบบด้วย Google" 14px bold black, centred);
      divider (two `h-px flex-1 bg-black/25` + "หรือ" 12px medium text-black/25);
      label "อีเมลหรือเบอร์โทร" 14px medium; input h-[56px] rounded-[8px] border border-cocoon-line pl-[14px] text-[14px] font-medium placeholder:text-black/25 placeholder "กรอกอีเมลหรือเบอร์โทร";
      helper "รับรหัส OTP เพื่อเข้าสู่ระบบ" 12px medium text-black/25; orange primary button h-[55px] rounded-[12px] "รับรหัส OTP".
      Below card, centred: "ยังไม่มีบัญชี ?" 14px medium text-black/30 + `<Link href="/sign-up" className="text-cocoon-blue underline">สมัครสมาชิก</Link>`. Compare with refs/01-login.png.
      Flow (per CONTEXT, `useSignIn` from '@clerk/nextjs/legacy'):
        Google → `signIn.authenticateWithRedirect({ strategy:'oauth_google', redirectUrl:'/sign-in/sso-callback', redirectUrlComplete:'/' })`.
        OTP step 1 → normalise identifier (trim; if it matches /^0\d{8,9}$/ convert to `+66` + rest; digits-only with + → phone) → `signIn.create({ identifier })` →
        find `supportedFirstFactors` entry with strategy 'email_code' (use emailAddressId) or 'phone_code' (phoneNumberId) → `prepareFirstFactor(...)` → step 2.
        Step 2 in the same card: title changes to "ยืนยันรหัส OTP", highlight text "เราส่งรหัสยืนยันไปที่ {identifier}", 6-digit input (`inputMode="numeric" autoComplete="one-time-code" maxLength={6}`, tracking-[0.5em] centred),
        button "ยืนยัน", links "ส่งรหัสอีกครั้ง" (re-prepare) and "เปลี่ยนอีเมล/เบอร์" (back to step 1) → `attemptFirstFactor({ strategy, code })` → if `status==='complete'` `setActive({ session: createdSessionId })` then `router.push('/')`.
      Errors: `isClerkAPIResponseError(err)` → map `form_identifier_not_found` → "ไม่พบบัญชีนี้ — สมัครสมาชิก" (with link), `form_code_incorrect` → "รหัสไม่ถูกต้อง ลองอีกครั้ง",
      no email_code/phone_code factor → "บัญชีนี้ยังไม่รองรับการเข้าสู่ระบบด้วย OTP", otherwise `errors[0].longMessage ?? message`; show inline under the button in 12px text-cocoon-orange. Never throw; disable buttons + "กำลังดำเนินการ…" while pending; guard on `!isLoaded`.
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx tsc --noEmit && npm run lint && npm test && git diff --quiet HEAD -- src/components/app-sidebar.tsx src/app/\(dashboard\)/teacher</automated>
  </verify>
  <done>Students get StudentShell + tab bar on all dashboard routes; teacher/superadmin branch unchanged; /student/tasks, /student/deadlines, /student/profile render (profile signs out); /sign-in shows the Cocoon login with working Google redirect and email/phone OTP two-step flow; /sign-in/sso-callback resolves. tsc/lint/test green. Commit: `feat(quick-260928-iwi): Cocoon student shell, tab bar and custom login`.</done>
</task>

<task type="auto">
  <name>Task 3: Node-path student home + student to-do submission page (upload, confirm dialog, submitted/history)</name>
  <files>src/app/(dashboard)/student/page.tsx, src/app/(dashboard)/student/classroom/[classroomId]/page.tsx, src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx, src/components/student/phase-stepper.tsx, src/components/student/node-path.tsx, src/app/(dashboard)/todo/[todoId]/page.tsx, src/components/student/todo-submit-view.tsx, src/components/student/submission-confirm-dialog.tsx, src/components/student/submission-status-view.tsx, src/components/student/submission-file-row.tsx, src/components/ui/dialog.tsx</files>
  <action>
    A. Home (CONTEXT "Student home — node path", ref 02):
    - Group page: keep role gate + `getGroupById`. If role is teacher/superadmin keep the CURRENT rendering exactly (TemplatePicker / empty / `GroupPhaseView`) — do not delete group-phase-view.tsx.
      Student branch: accept `searchParams: Promise<{ phase?: string }>`; `phases = getActivePhases(groupId)`; `selectedId = pickDefaultPhaseId(phases, phase)`;
      `statuses = getTodoSubmissionStatuses(groupId, userId, selected.todos)`; `rows = buildNodeRows(selected.todos)`; `locked = computeLockedTodoIds(...)`; `currentId = pickCurrentTodoId(...)`.
      Render `<CocoonHeader variant="home"/>`, `<PhaseStepper>`, section title "งานของฉัน" (text-[20px] font-bold text-cocoon-blue px-[33px], Figma y 236), `<NodePath>`.
      Empty states (no phases / phase with no todos) → white card `bg-white border border-cocoon-line rounded-[12px] p-6 text-center mx-[33px]` with existing Thai copy.
    - Restyle the student `/student` (0-classroom join card, multi-classroom list) and `/student/classroom/[id]` (waiting-for-group) pages: same logic/redirects, Cocoon header + white cards on cream; headings text-cocoon-blue bold.
    - `phase-stepper.tsx` ('use client' only if needed; Links are fine server-side): container `relative mx-[23px] mt-[-15px]` (logo png has transparent bottom padding; stepper circles span Figma y 140–187);
      circles 47px `flex justify-between` for N phases; track `absolute h-[11px] rounded-[12px] bg-black/5` from first circle centre to last circle centre (left/right 23.5px, top 18px);
      fill `bg-cocoon-blue` width = (indexOf(currentPhase)/(N-1))*100% where currentPhase = first active else last completed else first (fill 0 when N==1).
      Circle filled (bg-cocoon-blue text-white) when completed or is/before current; else `bg-white border border-cocoon-blue text-cocoon-blue`; number `font-latin font-bold text-[24px]`.
      Viewable circles (not locked, or isFreeAccess, or completed) are `<Link href={?phase=id} scroll={false}>`; locked ones are `<span aria-disabled>`. Selected circle gets `ring-2 ring-cocoon-orange/40` and label "Phase {n}" text-[12px] font-bold text-cocoon-blue centred under it.
    - `node-path.tsx`: content box `relative mx-auto w-[336px] mt-[38px]` (Figma node area starts y≈290). Row pitch 264px (node 149 + gap 115). Absolute layout computed in TS:
      single row → node left = (336-152)/2 = 92; two-node row → lefts 0 and 184; node centre x = left + 76, centre y = rowIndex*264 + 74.5. Container height = rows*264 − 115.
      Connectors drawn first (z-0) as absolutely-positioned `bg-cocoon-track` divs 6px thick: for rows A→B, junctionY = A.top + 149 + 115/2 + 10; vertical from each A centre to junctionY,
      horizontal bar from min to max of all A∪B centre x at junctionY, vertical from junctionY to each B centre. At (168, junctionY) a 56px circle `bg-cocoon-cream border border-cocoon-blue rounded-full`
      with "↓" (font-bold text-[32px] text-cocoon-disabled leading-none), centred. Nodes on top (z-10): outer `w-[152px] h-[149px] rounded-full bg-cocoon-cream shadow-cocoon-node`, inner
      `absolute left-[5px] top-[4px] w-[142px] h-[141px] rounded-full bg-white flex flex-col items-center justify-center px-3 text-center`:
      icon (unlocked `/figma/c64bc.svg` 50×45; locked `/figma/8f1f5.svg` 32×41), title 14px bold (text-black if current else text-cocoon-ink, line-clamp-1),
      subtitle first line of description 12px medium text-cocoon-muted truncate, `<StatusPill status={locked ? 'locked' : status}/>`.
      Current node: overlay `/figma/c7ea2.svg` absolutely at left 76px top 2px size 73.7×84.5 (pointer-events-none).
      Unlocked node wraps in `<Link href={/todo/{id}} aria-label={title}>`; locked node is a `<div aria-disabled="true">`. Match refs/02-home-node-path.png at 402px.

    B. To-do page (CONTEXT "To-do page for students", refs 03–05):
    - `todo/[todoId]/page.tsx`: keep the teacher/superadmin render EXACTLY as today (move it into a branch, no visual change). Student branch: `getSubmissionHistory(todoId, userId)`
      (null → redirect('/student')), back href = `/student/classroom/${classroomId}/group/${groupId}`. Header `<CocoonHeader variant="back" backHref/>`; title text-[32px] font-bold text-cocoon-blue px-[31px] leading-tight (-mt-2);
      subtitle first description line 12px bold text-cocoon-muted. latest = submissions[0]; if none or `rejected` → `<TodoSubmitView todoId title backHref rejected={latest?.status==='rejected'} history={...}/>`;
      else → `<SubmissionStatusView latest history backHref/>`. Keep teacher attachments visible to students? Render existing `TodoAttachmentsList` inside a white card "ไฟล์จากครู" below the title only if attachments exist (keeps prior feature).
    - `submission-file-row.tsx`: `h-[49px] bg-[#f8fafc] border border-[#e4e8ee] rounded-[8px] px-3 flex items-center gap-3`: tag `fileTypeTag()` 10px bold text-[#f04a24] w-8;
      name `font-latin text-[12px] font-medium text-[#161c24] truncate flex-1`; size `formatFileSize` 11px medium text-cocoon-muted; trailing slot = remove button (`/figma/e2ca4.svg` 9×9, aria-label "ลบไฟล์") or open button ("↗" 16px text-[#0269a7], aria-label "เปิดไฟล์").
    - `todo-submit-view.tsx` ('use client'), px-[33px], gaps per ref 03:
      rejected notice (yellow, small) "งานถูกส่งกลับให้แก้ไข — อัปโหลดไฟล์ใหม่";
      dropzone `<label>` wrapping hidden `<input type="file" multiple accept={SUBMISSION_ACCEPT}>`: h-[162px] rounded-[12px] bg-cocoon-blue-soft border border-dashed border-cocoon-blue flex-col centred;
      `/figma/7b064.svg` 60×60, "เพิ่มไฟล์" 20px bold text-cocoon-blue, two 10px medium lines text-[rgba(0,105,166,.5)] "ลากไฟล์มาวางที่นี่ หรือกดเลือกไฟล์" / "รองรับไฟล์ PDF, DOC, DOCX (ไม่เกิน 10 MB)";
      native onDragOver/onDragEnter (preventDefault, set dragging → bg-[rgba(73,188,255,.1)]), onDragLeave, onDrop. Validate each file with `validateSubmissionFile(file.type, file.size)` → `toast.error` (sonner) for rejects; de-dupe by name+size.
      Files card (only when ≥1 file) white border rounded-[12px] p-5: "ไฟล์ที่เลือก" 16px bold black, rows gap-[7px] with remove.
      Warning banner (only when ≥1 file) h-[45px] rounded-[12px] bg-[rgba(250,168,25,.2)] border border-cocoon-yellow: `/figma/a189d.svg` 13×13 + "ตรวจสอบไฟล์ก่อนยืนยันส่ง" 14px medium text-[#c98200].
      Primary button "ยืนยันส่งไฟล์" (disabled + opacity-50 with 0 files) opens `<SubmissionConfirmDialog>`. If `rejected`, render history card (from SubmissionStatusView's HistoryCard export) below.
      Submit handler: for each file sequentially `createSubmissionUploadUrl` → on `ok:false` toast + abort; `fetch(url, { method:'PUT', headers:{'content-type':file.type}, body:file })` → non-2xx toast "อัปโหลดไม่สำเร็จ";
      then `createSubmission({ todoId, files })`; on ok → close dialog, `toast.success('ส่งงานแล้ว')`, `router.refresh()`.
    - `submission-confirm-dialog.tsx`: existing `Dialog`/`DialogContent showCloseButton={false}` with className overrides: panel `w-[calc(100%-48px)] max-w-[354px] sm:max-w-[354px] rounded-[16px] bg-white p-6 ring-0 gap-4`;
      overlay colour rgba(20,32,43,.48) — DialogContent hardcodes the overlay, so add an optional `overlayClassName` prop to `src/components/ui/dialog.tsx` DialogContent passed to DialogOverlay (additive, default unchanged → teacher dialogs unaffected).
      Content: icon tile 40×40 rounded-[12px] bg-[#fff0ea] with `/figma/0d869.svg` 21×19; `DialogTitle` "ยืนยันส่งงาน?" 22px bold text-cocoon-heading; todo title 17px bold text-[#0269a7];
      `DialogDescription` "ตรวจสอบรายการไฟล์ให้ครบก่อนยืนยันส่งงาน" 14px text-cocoon-subtle; summary box bg-cocoon-cream border border-[#ebe5dd] rounded-[10px] p-4:
      "เลือกแล้ว {n} ไฟล์ · {formatFileSize(total)}" 14px bold text-cocoon-heading, each "name · size" 12px text-cocoon-subtle;
      buttons: primary h-12 rounded-[10px] bg-cocoon-orange text-white bold "ยืนยันส่งงาน" (while submitting: Loader2 spin + "กำลังส่ง…", disabled);
      secondary h-[45px] rounded-[10px] bg-white border border-[#dce1e5] text-[15px] text-[#53616b] "กลับไปตรวจไฟล์" closes (disabled while submitting). Match refs/04.
    - `submission-status-view.tsx` ('use client' for open-file transitions), ref 05: status card white border rounded-[12px] p-5:
      magnifier (`/figma/ff79c.svg` 86×86 + `/figma/c536c.svg` 38×38 absolutely at bottom-right overlapping) left; right: `<StatusPill size="lg" status=pending|approved label={approved?'ผ่านการตรวจ':undefined}/>`
      + 14px medium muted "รอตรวจงานแล้วแจ้งผลให้ทราบ" / "งานนี้ผ่านการตรวจแล้ว"; divider border-cocoon-line; row "ส่งครั้งที่ {attempt}" 16px bold + `formatSubmissionDate(createdAt)` 14px medium muted right;
      file rows with "↗" calling `getSubmissionFileUrl({fileId})` → `window.open(url,'_blank','noopener')`, toast on failure.
      Export `HistoryCard`: white border rounded-[12px] p-5, "ประวัติการส่ง" 16px bold, rows `h-[55px] rounded-[10px] border border-cocoon-line bg-[rgba(245,245,245,.3)] px-4 flex justify-between items-center`:
      left "● ครั้งที่ {n} · {status label}" 12px coloured by status (pending blue, approved green, rejected #c98200), right date 12px medium muted.
      Primary button "กลับหน้าหลัก" `<Link href={backHref}>` styled as the Cocoon primary button.
    Finally run the full gate including `npm run build`, then visually sanity-check at 402px against refs 02–05 if a dev server/browser is available (optional, not blocking).
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx tsc --noEmit && npm run lint && npm test && npm run build && test -f src/components/student/group-phase-view.tsx</automated>
  </verify>
  <done>Student group home shows stepper + node path with correct lock/status/current arc and `?phase=` switching; student to-do page supports select/drag files → confirm → R2 upload → pending view with history and file open links; rejected re-opens upload; teacher to-do page, teacher group view and other dialogs are visually unchanged. tsc, lint, test and build all pass. Commit: `feat(quick-260928-iwi): node-path home and student submission flow`.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit && npm run lint && npm test && npm run build` all pass after Task 3.
- `git diff` shows no changes to teacher pages (`src/app/(dashboard)/teacher/**`), `app-sidebar.tsx`, or the teacher branch markup of `todo/[todoId]/page.tsx` and the group page.
- No Figma MCP calls were made; no new npm dependencies added (`git diff package.json` empty).
</verification>

<success_criteria>
- Student flow (login → home node path → to-do upload → confirm → submitted/history) is implemented to CONTEXT.md spec and refs at 402px, responsive at md+.
- SUB-01/04/05/06 satisfied for file submissions with server-side access, scope, type/size and duplicate-submission checks.
- Pure logic (dates, sizes, rows, locking, default phase) covered by vitest.
</success_criteria>

<output>
After completion, create `.planning/quick/260928-iwi-cocoon-ui-redesign-from-figma-student-fl/260928-iwi-SUMMARY.md`
</output>
