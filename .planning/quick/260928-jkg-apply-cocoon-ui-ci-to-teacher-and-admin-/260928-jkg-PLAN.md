---
phase: quick-260928-jkg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1 — theme, shell, nav, auth
  - vitest.config.ts
  - src/app/globals.css
  - src/components/cocoon/nav-items.ts
  - src/components/cocoon/app-shell.tsx
  - src/components/cocoon/desktop-header.tsx
  - src/components/cocoon/bottom-tab-bar.tsx
  - src/components/cocoon/cocoon-header.tsx
  - src/components/cocoon/decor-background.tsx
  - src/components/cocoon/page-header.tsx
  - src/components/cocoon/profile-card.tsx
  - src/components/cocoon/student-shell.tsx          # deleted (replaced by app-shell)
  - src/components/app-sidebar.tsx                   # deleted if unused
  - src/components/user-nav.tsx                      # deleted if unused
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/student/profile/page.tsx
  - src/app/(dashboard)/teacher/review/page.tsx
  - src/app/(dashboard)/teacher/profile/page.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
  - src/components/auth/auth-parts.tsx
  - src/components/auth/otp-boxes.tsx
  - src/components/auth/cocoon-sign-in.tsx
  - src/components/auth/cocoon-sign-up.tsx
  # Task 2 — student desktop alignment
  - src/lib/todo-deliverables.ts
  - src/lib/__tests__/todo-deliverables.test.ts
  - src/server/queries/submission.ts
  - src/components/cocoon/status-pill.tsx
  - src/components/student/node-icons.tsx
  - src/components/student/node-path.tsx
  - src/components/student/node-path-desktop.tsx
  - src/components/student/phase-stepper.tsx
  - src/components/student/student-todo-view.tsx
  - src/components/student/todo-detail-view.tsx
  - src/components/student/todo-submit-view.tsx
  - src/components/student/submission-status-view.tsx
  - src/components/student/submission-rejected-view.tsx
  - src/components/student/submission-file-row.tsx
  - src/app/(dashboard)/todo/[todoId]/page.tsx
  - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
  - src/app/(dashboard)/student/page.tsx
  - src/app/(dashboard)/student/classroom/[classroomId]/page.tsx
  # Task 3 — teacher/admin management restyle
  - src/app/(dashboard)/teacher/page.tsx
  - src/app/(dashboard)/teacher/classroom/new/page.tsx
  - src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx
  - src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx
  - src/app/(dashboard)/admin/page.tsx
  - src/app/(dashboard)/admin/admin-actions.tsx
  - src/app/(auth)/onboarding/page.tsx
  - src/components/classroom/*.tsx
  - src/components/group/*.tsx
  - src/components/phase/*.tsx
  - src/components/todo/*.tsx
  - src/components/template/template-picker.tsx
  - src/components/student/group-phase-view.tsx
autonomous: true
requirements: [UI-01, UI-03, UI-04, SUB-06]

must_haves:
  truths:
    - "At >=1024px every signed-in role sees a top header (logo left, nav links + bell right, 2px #f1ece5 divider) and NO bottom tab bar; below 1024px the 260928-iwi mobile shell + bottom tab bar is unchanged for students"
    - "Teachers/superadmins get the Cocoon shell (no sidebar): tabs หน้าแรก/ทีมของฉัน /teacher, ตรวจงาน /teacher/review, โปรไฟล์ /teacher/profile, + แอดมิน /admin for superadmin"
    - "Login, sign-up and OTP pages render the 2-column desktop layout at lg (login*.png) and the current single column on mobile; sign-up is a custom Clerk flow (Google or display name + email -> 6-box OTP -> /onboarding)"
    - "Student home at lg renders a horizontal node row with ring connectors (-> between rows, + inside a parallel pair) matching home.png; nodes show status-specific icon + ring on both mobile and desktop (orange arc / blue arc + magnifier / yellow arc + hand / full green ring + target, pill ผ่านแล้ว)"
    - "A student opening a to-do with no submission sees the detail step (รายละเอียดงาน + สิ่งที่ต้องส่ง cards, orange เลือกไฟล์) and ?step=upload shows the upload view; rejected shows คำแนะนำจากผู้ตรวจ + yellow แก้ไขงาน -> re-upload (แก้ไขงาน / ยืนยันส่งอีกครั้ง); pending/approved shows the 2-column submitted view at lg"
    - "Teacher management pages (dashboard, new classroom, classroom tabs/settings/groups, group phase/to-do editor, teacher to-do page, admin, onboarding) use the Cocoon page pattern and CI tokens with unchanged behaviour"
    - "npx tsc --noEmit clean, npm run lint still 10 errors, npm test green, npm build succeeds"
  artifacts:
    - path: "src/components/cocoon/app-shell.tsx"
      provides: "Role-aware responsive shell (DecorBackground + DesktopHeader lg + BottomTabBar <lg)"
      exports: ["AppShell"]
    - path: "src/components/cocoon/nav-items.ts"
      provides: "Per-role nav definitions shared by BottomTabBar and DesktopHeader"
      exports: ["NavRole", "navItemsFor"]
    - path: "src/components/auth/cocoon-sign-up.tsx"
      provides: "Custom Clerk sign-up (Google + name + email OTP)"
      exports: ["CocoonSignUp"]
    - path: "src/components/auth/otp-boxes.tsx"
      provides: "6-box OTP input shared by sign-in and sign-up"
      exports: ["OtpBoxes"]
    - path: "src/lib/todo-deliverables.ts"
      provides: "parseDeliverables(notes) for สิ่งที่ต้องส่ง"
      exports: ["parseDeliverables"]
    - path: "src/components/student/node-path-desktop.tsx"
      provides: "Horizontal desktop node path"
      exports: ["NodePathDesktop"]
    - path: "src/components/student/todo-detail-view.tsx"
      provides: "To-do detail step (home-1)"
      exports: ["TodoDetailView"]
    - path: "src/components/student/submission-rejected-view.tsx"
      provides: "Rejected state with reviewer comment (home-7)"
      exports: ["SubmissionRejectedView"]
    - path: "src/app/(dashboard)/teacher/review/page.tsx"
      provides: "ตรวจงาน placeholder (ComingSoonCard until Phase 4)"
    - path: "src/app/(dashboard)/teacher/profile/page.tsx"
      provides: "Teacher profile with sign-out"
  key_links:
    - from: "src/app/(dashboard)/layout.tsx"
      to: "src/components/cocoon/app-shell.tsx"
      via: "AppShell role prop for student/teacher/superadmin"
      pattern: "<AppShell role="
    - from: "src/components/cocoon/bottom-tab-bar.tsx"
      to: "src/components/cocoon/nav-items.ts"
      via: "navItemsFor(role)"
      pattern: "navItemsFor"
    - from: "src/app/(auth)/sign-up/[[...sign-up]]/page.tsx"
      to: "src/components/auth/cocoon-sign-up.tsx"
      via: "renders CocoonSignUp"
      pattern: "CocoonSignUp"
    - from: "src/components/student/student-todo-view.tsx"
      to: "src/server/queries/submission.ts"
      via: "getSubmissionHistory entries carry reviewerComment"
      pattern: "reviewerComment"
    - from: "src/components/student/todo-detail-view.tsx"
      to: "src/lib/todo-deliverables.ts"
      via: "parseDeliverables(todo.notes)"
      pattern: "parseDeliverables"
---

<objective>
Bring the Mac (desktop) frames in `design/mac/*.png` to the app. That covers the shared Cocoon shell for all roles, the auth pages and the student screens. Also apply the Cocoon CI to the teacher and admin management screens, which have no design.

Purpose: the product currently looks right only for students on phones. Teachers still see the default shadcn sidebar UI, and nothing matches the desktop designs. Phase 4 (teacher review, home-11..17) will build on this shell and on these tokens.

Output: a token theme, a role-aware responsive shell, desktop auth screens plus a custom sign-up, the student desktop screens with the new detail and rejected states, and restyled teacher/admin pages. Behaviour and data flow do not change, except for the new sign-up flow and one read-only reviewer-comment field.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260928-jkg-apply-cocoon-ui-ci-to-teacher-and-admin-/260928-jkg-CONTEXT.md
@.planning/quick/260928-iwi-cocoon-ui-redesign-from-figma-student-fl/260928-iwi-CONTEXT.md
@.planning/quick/260928-iwi-cocoon-ui-redesign-from-figma-student-fl/260928-iwi-SUMMARY.md
@AGENTS.md

Visual targets (1280×832, view at full resolution and pixel-measure):
- Auth: design/mac/login.png, login-1.png (sign-up), login-2.png (OTP empty), login-3.png (OTP filled)
- Student: design/mac/home.png, home-5/6/10.png (node states), home-1.png (detail), home-2/3.png (upload),
  home-4.png / home-9.png (submitted r1/r2), home-7.png (rejected), home-8.png (re-upload)
- Teacher header variant + segmented tabs language: design/mac/home-11.png, home-13.png, home-16.png (Phase 4 screens: use ONLY for the header link and the tab/card language, do not build them)
- Mobile regression refs (402px): .planning/quick/260928-iwi-.../refs/01..06 and .planning/quick/260928-jkg-.../refs/02..06

Colours measured by the planner from the PNGs (use these):
- green (resend button, ผ่านแล้ว dot/ring): `#00a86b`
- desktop page divider: `#f1ece5`, 2px at y=115..116, x 64..1216
- orange `#ef4924`, button blue `#0269a7` (use `cocoon-blue` #0069a6, which is visually the same)
- yellow button `#fba919` (use `cocoon-yellow`), reviewer card bg `#fff4df`, border `#fbe6b8`, title text `#a86a00`-ish (dark yellow, measure)
- OTP box: bg `#fffaf3`, border `#f1ece5`; filled box border green (≈`#80d1af` antialiased → use `border-[#00a86b]/60` or measure)
- file row bg `#fafbfc` (≈ existing `#f8fafc`), card border on desktop ≈`#f1ece5`/`#ece9e4` (existing `cocoon-line` #e4e1dc is acceptable)
- stepper track `#ece8e2`

<interfaces>
Existing code the executor builds on (do not re-explore beyond what's listed):

src/lib/constants.ts
```ts
export const ROLES = { SUPERADMIN:'superadmin', TEACHER:'teacher', TEACHER_PENDING:'teacher_pending', STUDENT:'student' } as const;
export type UserRole = (typeof ROLES)[keyof typeof ROLES];
export const ROUTES = { SIGN_IN:'/sign-in', SIGN_UP:'/sign-up', ONBOARDING:'/onboarding', TEACHER_DASHBOARD:'/teacher', STUDENT_DASHBOARD:'/student', ADMIN_DASHBOARD:'/admin' } as const;
```

src/app/(dashboard)/layout.tsx (current): auth() → getCurrentRole() → teacher_pending → /onboarding;
student → `<StudentShell>`; others → SidebarProvider + AppSidebar + SidebarInset (to be replaced).

src/components/cocoon/*:
```ts
export function StudentShell({ children })            // DecorBackground + <main max-w-[402px] md:max-w-[680px] pb-…> + BottomTabBar
export function BottomTabBar()                        // 'use client', hard-coded student TABS {href,label,icon,isActive(pathname)}; fixed bottom <md, floating pill md+
export function CocoonHeader(props: {variant:'home'} | {variant:'back'; backHref:string}) // mobile headers rendered by each page
export function CocoonLogo({ className })             // /figma/3a22e.png 176×82
export function DecorBackground()                     // fixed -z-10 cream bg + edge shapes
export type PillStatus = 'none'|'locked'|'pending'|'rejected'|'approved';
export function StatusPill({ status, size?, className })  // approved label currently 'สำเร็จแล้ว'
export function ComingSoonCard({ description }: { description: string })
```

src/components/student/*:
```ts
export function PhaseStepper({ phases: {id,status:'locked'|'active'|'completed',isFreeAccess}[], selectedId })
export interface PathTodo { id: string; title: string; description: string | null }
export function NodePath({ rows: PathTodo[][], statuses: Record<string, SubmissionStatus>, locked: Set<string>, currentId: string | null })
export async function StudentTodoView({ todoId, userId })  // server comp; branches upload / locked / status
export interface StudentSubmission { id; status:'pending'|'approved'|'rejected'; createdAt: Date; attempt: number; files: {id,fileName,contentType,fileSize}[] }
export const PRIMARY_BUTTON_CLASS: string
export function HistoryCard({ submissions }); export function SubmittedFiles({ files }); export function SubmissionStatusView({ latest, history, backHref })
export function TodoSubmitView({ todoId, title, rejected, history }: {…})   // 'use client', dropzone + file list + confirm dialog + presigned upload
export function ProfileSignOut()
```

src/lib/node-path.ts: `SubmissionStatus` ('none'|'pending'|'approved'|'rejected'), `buildNodeRows`, `computeLockedTodoIds`, `pickCurrentTodoId`, `pickDefaultPhaseId`, `isPhaseViewable`, `pickCurrentPhaseIndex`.

src/server/queries/submission.ts:
```ts
export interface SubmissionHistoryEntry { id; status:'pending'|'approved'|'rejected'; createdAt: Date; attempt: number; files: {...}[] }
export async function getSubmissionHistory(todoId, userId): Promise<{ todo /* with attachments, notes, description */, phase, groupId, classroomId, submissions: SubmissionHistoryEntry[] } | null>
// uses db.query.submissions.findMany({ where: eq(submissions.todoId, todoId), orderBy: [desc(submissions.createdAt)], with: { files: true } })
```
src/db/schema/comments.ts: `comments { id, submissionId (fk submissions, cascade), userId, content, createdAt, updatedAt }`; relations.ts already has `comments: many(comments)` on submissions.

src/components/auth/cocoon-sign-in.tsx: `'use client'`, `useSignIn` from `@clerk/nextjs/legacy`, steps 'identifier'|'code', 6-digit single `<input inputMode="numeric" autoComplete="one-time-code">`, Google via `authenticateWithRedirect({ strategy:'oauth_google', redirectUrl:'/sign-in/sso-callback', redirectUrlComplete:'/' })`, exported `normaliseIdentifier` (tested).

middleware.ts public routes: '/', '/register(.*)', '/sign-in(.*)', '/sign-up(.*)', '/api/webhooks(.*)'.
</interfaces>
</context>

<conventions>
- Next.js 16.3.5: `params`/`searchParams` are Promises. Read `node_modules/next/dist/docs/` before using any API you are unsure of. Fonts stay on CSS @import (do not switch to next/font).
- Tailwind v4 classes, `cn` from 'cn', lucide-react icons, base-ui `render` prop on Button (not asChild), `nativeButton={false}` when rendering a Link.
- Plain `<img>` for `/public/figma/*` assets, with `/* eslint-disable @next/next/no-img-element -- static Figma assets */` at the top.
- Breakpoint: desktop = `lg` (≥1024px). Every mobile-only element uses `lg:hidden`, every desktop-only element uses `hidden lg:*`. Do not change spacing classes below `lg` in student components unless the task says so (mobile must not regress).
- Desktop page frame: the content column is `lg:max-w-[1152px] lg:mx-auto lg:px-0`, inside a shell with `lg:px-16`. Page pattern, which `PageHeader` implements: "‹ {parent}" link 14px blue at y≈154, title 30px bold `text-cocoon-blue` (home-1 title ≈30px, y≈190..225), subtitle 16px `text-cocoon-muted`, cards `rounded-[16px] border border-[#f1ece5] bg-white` with 28px padding on desktop.
- Server actions, queries (except the additive `reviewerComment` field) and access checks stay unchanged. No schema changes, no DB pushes, no Figma MCP calls, no new npm dependencies.
- Screenshot harness (every task): start `npm run dev`. Add a TEMPORARY public route `src/app/preview-jkg/[screen]/page.tsx`, add `'/preview-jkg(.*)'` to `isPublicRoute` in middleware.ts, and render the presentational components with mock data inside `<AppShell role=…>` or the auth layout markup. Capture with headless Chrome (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1280,832 --screenshot=… URL` for desktop, and CDP device emulation at 402×874 DPR 1 for mobile, as 260928-iwi did). Compare side by side with the refs, then fix the differences. BEFORE EACH COMMIT delete `src/app/preview-jkg/`, revert the middleware.ts line, and confirm with `git status` that neither is staged. Keep the screenshots in the session scratchpad, not in the repo.
- Presentational/data split: data-fetching server components pass plain props to presentational components so the preview route can render them with mock data.
- Commit after each task: `feat(quick-260928-jkg): …`, with the attribution trailer from the system reminder.
</conventions>

<tasks>

<task type="auto">
  <name>Task 1: CI token theme, role-aware responsive shell + nav, teacher tabs/pages, desktop auth + custom sign-up</name>
  <files>vitest.config.ts, src/app/globals.css, src/components/cocoon/{nav-items.ts,app-shell.tsx,desktop-header.tsx,bottom-tab-bar.tsx,cocoon-header.tsx,decor-background.tsx,page-header.tsx,profile-card.tsx}, src/components/cocoon/student-shell.tsx (delete), src/components/app-sidebar.tsx + src/components/user-nav.tsx (delete if unused), src/app/(dashboard)/layout.tsx, src/app/(dashboard)/student/profile/page.tsx, src/app/(dashboard)/teacher/{review,profile}/page.tsx, src/app/(auth)/layout.tsx, src/app/(auth)/sign-up/[[...sign-up]]/page.tsx, src/components/auth/{auth-parts.tsx,otp-boxes.tsx,cocoon-sign-in.tsx,cocoon-sign-up.tsx}</files>
  <action>
**A. Housekeeping + tokens (CONTEXT item 4, 6)**
- `vitest.config.ts`: add `exclude: [...configDefaults.exclude, '.claude/**']` (import `configDefaults` from 'vitest/config').
- `src/app/globals.css` `:root`: replace the oklch shadcn values with the locked CI: `--background #fffaf3; --foreground #1d2531; --card #fff; --card-foreground #1d2531; --popover #fff; --popover-foreground #1d2531; --primary #ef4924; --primary-foreground #fff; --secondary #f0f9ff; --secondary-foreground #0069a6; --muted #f5f3ef; --muted-foreground #878ea8; --accent #fff0ea; --accent-foreground #ef4924; --border #e4e1dc; --input #e4e1dc; --ring #0069a6; --radius 0.75rem`. Keep `--destructive` (red) and the chart/sidebar vars as they are. Set `--color-cocoon-green: #00a86b` (measured). Do not touch `.dark`.
- Check that the student screens still look the same. They use explicit `cocoon-*` classes, but check the shadcn-based dialog, toaster and inputs in the 402px screenshots.

**B. Nav definitions: `src/components/cocoon/nav-items.ts`** (no 'use client'; pure data plus icon components, imported only by client components)
```ts
export type NavRole = 'student' | 'teacher' | 'superadmin';
export interface NavItem { href: string; label: string; desktopLabel?: string; icon: LucideIcon; match: (pathname: string) => boolean }
export function navItemsFor(role: NavRole): NavItem[]
```
- student: the four existing TABS moved here unchanged (หน้าแรก /student, งานของฉัน /student/tasks, กำหนดส่ง /student/deadlines, โปรไฟล์ /student/profile, with the same active rules).
- teacher: หน้าแรก `/teacher` (desktopLabel "ทีมของฉัน", House, active for `/teacher` exactly plus `/teacher/classroom/**`, `/student/classroom/**`, `/todo/**`), ตรวจงาน `/teacher/review` (ClipboardCheck), โปรไฟล์ `/teacher/profile` (User).
- superadmin: the teacher items plus แอดมิน `/admin` (ShieldCheck), inserted before โปรไฟล์.

**C. BottomTabBar** takes a `role: NavRole` prop and renders `navItemsFor(role)`. Keep the existing classes exactly and add `lg:hidden`. The md floating pill stays (md is still the mobile layout).

**D. DesktopHeader** (`'use client'`, `hidden lg:block`), measured from home.png / home-13.png: a full-width row inside the shell. Logo `CocoonLogo` scaled to ≈139×65 at left, offset x≈20 inside the 64px gutter (logo left edge ≈ x84, top ≈ y23; measure). Right side: nav links for the role (14px medium, `text-cocoon-muted`, active `text-cocoon-orange font-bold`, gap-8, using `desktopLabel ?? label`, placed like "ทีมของฉัน" at x≈940). Then the bell `/figma/2bba0.svg` ≈32×38 in grey `#8a8a8a` as in the Mac frames: use the same svg and apply `opacity-60 grayscale`, or use the lucide `Bell` at 36px strokeWidth 1.5 `text-[#8b8b8b]` if that matches better, with the bell's right edge at ≈x1184. Below the row: 2px `bg-[#f1ece5]` divider from x64 to x1216, top at y115. Header height ≈116px. For students, the desktop nav shows หน้าแรก / งานของฉัน / กำหนดส่ง / โปรไฟล์ as text links (Claude's discretion per CONTEXT).

**E. AppShell** (`src/components/cocoon/app-shell.tsx`, server component) `({ role, children }: { role: NavRole; children })`. It renders `<DecorBackground/>`, `<DesktopHeader role/>`, and `<main className="mx-auto w-full max-w-[402px] pb-[calc(96px+env(safe-area-inset-bottom))] md:max-w-[680px] md:pb-32 lg:max-w-[1280px] lg:px-16 lg:pb-16">`, then `<BottomTabBar role/>`. The <lg classes must be identical to the current StudentShell. Delete `student-shell.tsx` and update its imports.
- `CocoonHeader`: add `lg:hidden` to both variants (the desktop header replaces it).
- `DecorBackground`: add a desktop arrangement (`hidden lg:block` group, keep the existing mobile group with `lg:hidden`). Use the existing `/figma/*` shapes and place them as in home.png: yellow hand top-right (≈x1185..1280, y230..395), orange briefcase right edge (≈x1150..1280, y540..700), blue puzzle left edge (≈x0..50, y450..590), green blob bottom-left, yellow star bottom (x235..340), green lightbulb/eye bottom-centre (x495..730), blue book+pencil bottom-right (x935..1120). Approximate placement is fine (CONTEXT). Keep `-z-10` and `pointer-events-none`.
- `PageHeader` (`src/components/cocoon/page-header.tsx`): `({ backHref?, backLabel?, title, subtitle?, actions?, className? })`. It renders the desktop page pattern from the conventions, stacks the same way on mobile (`px-[33px] lg:px-0`), and puts `actions` right-aligned on the title row (used for status pills and buttons).
- `(dashboard)/layout.tsx`: keep the auth/role redirects. Student → `<AppShell role="student">`; teacher/superadmin → `<AppShell role={role}>`. Remove the Sidebar imports. Delete `src/components/app-sidebar.tsx` and `src/components/user-nav.tsx` if `grep -rn "app-sidebar\|user-nav" src` shows no other users. Leave `components/ui/sidebar.tsx` alone.
- Teacher pages that currently rely on the sidebar layout's `p-6` still render. Task 3 restyles them. For now, wrap nothing, but make sure `npm run build` passes.

**F. Profiles + placeholders (CONTEXT item 5)**
- Extract the body of `student/profile/page.tsx` into `src/components/cocoon/profile-card.tsx`: `ProfileCard({ name, contact, imageUrl, roleLabel })`, server-safe, which renders the avatar/name/contact card, a small role label, and `ProfileSignOut` (move it or keep importing it from student/). The student page uses `roleLabel="นักเรียน"`.
- `src/app/(dashboard)/teacher/profile/page.tsx`: `requireRole(ROLES.TEACHER, ROLES.SUPERADMIN)`, currentUser, ProfileCard with `roleLabel` = "ผู้ดูแลระบบ" for superadmin, otherwise "ครู".
- `src/app/(dashboard)/teacher/review/page.tsx`: same role guard; `CocoonHeader variant="home"`, `PageHeader title="ตรวจงาน"`, `ComingSoonCard description="หน้าตรวจงานจะเปิดให้ใช้งานเร็ว ๆ นี้"`.

**G. Auth desktop + custom sign-up (CONTEXT item 3)**
- `src/components/auth/auth-parts.tsx`:
  - `AuthDesktopHeader`: logo plus the 2px divider, no bell, `hidden lg:block`.
  - `AuthHero`: `hidden lg:block`. "เข้าสู่ระบบ" ≈64px bold orange at x84 y≈245..305. Blue highlight `bg-cocoon-blue` block x84..614, y330..395 with "พร้อมไปต่อกับโปรเจกต์ของคุณ" ≈36px bold white. Illustration row at y≈410..585: rocket, book+pencil and lightbulb, reusing `/figma/*` decor SVGs; inspect the files to find them, and if one can't be found, omit it.
  - `AuthCard`: white card, `rounded-[16px] border border-[#f1ece5]`. Desktop ≈508×565 at x676..1184, y171..735, inner padding 40px, 429px-wide controls. Mobile keeps the current 336px card styles.
  - `GoogleButton({ label, onClick, disabled })` and `OrDivider`.
  - Layout at lg: `grid grid-cols-[1fr_508px] gap-[62px]` in a 1152 frame.
- `src/components/auth/otp-boxes.tsx` (`'use client'`): `OtpBoxes({ value, onChange, length = 6, disabled, autoFocus })`. Six boxes of `bg-[#fffaf3] border border-[#f1ece5] rounded-[12px]`. Desktop box size ≈64×80 with 6 boxes across 429px (design shows 4 at 95×81; 6 boxes → ≈64 wide, gap 9). Mobile ≈44×56. Latin 28px bold digits. A filled box gets a green border (`border-cocoon-green/60`). Handle digit-only input, auto-advance, Backspace to the previous box, paste of a full code, `autoComplete="one-time-code"` on the first box, `inputMode="numeric"`, and `aria-label="รหัส OTP หลักที่ n"`.
- `cocoon-sign-in.tsx`:
  - Keep all Clerk logic and `normaliseIdentifier`. Render inside AuthHero plus AuthCard at lg.
  - The mobile identifier step must still match ref 01, so keep its current classes below lg.
  - Code step per login-2/3: title "Verification Code" ≈30px bold orange (League Spartan), subtitle "กรอกรหัส OTP ที่ส่งไปยัง{อีเมล|เบอร์โทร}ของคุณ" 16px muted, OtpBoxes, green `bg-cocoon-green` "ส่ง OTP อีกครั้ง" full-width h-[49px] rounded-[12px] (re-run prepareFirstFactor), and an orange "ยืนยัน" button that is shown and enabled when 6 digits are entered (login-3; auto-submit on the 6th digit is optional). Add the link "ย้อนกลับไปแก้ไขอีเมล" (use "…อีเมล/เบอร์โทร" when the identifier was a phone) with 14px blue underline behaviour.
  - Desktop card: remove the in-card sign-up prompt position mismatch. In login.png the prompt "ยังไม่มีบัญชี? สมัครสมาชิก" is centred 14px blue at y≈618.
- `cocoon-sign-up.tsx` (`'use client'`), per login-1:
  - Title "สมัครสมาชิก" ≈30px bold orange. GoogleButton "สมัครด้วย Google" calls `signUp.authenticateWithRedirect({ strategy:'oauth_google', redirectUrl:'/sign-in/sso-callback', redirectUrlComplete:'/onboarding' })`.
  - OrDivider, then the label "ชื่อที่แสดง" with input placeholder "ชื่อที่ต้องการแสดง", and the label "อีเมล" with input placeholder "กรอกอีเมลของคุณ".
  - Orange "รับรหัส OTP" button, then the prompt "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" → `/sign-in`.
  - Flow with `useSignUp` from `@clerk/nextjs/legacy`: `signUp.create({ emailAddress, firstName: displayName })`. If Clerk rejects `first_name` (error code `form_param_unknown` / param `first_name`), retry `create({ emailAddress })` and remember the name. Then `prepareEmailAddressVerification({ strategy: 'email_code' })` → code step (the same OTP UI as sign-in, with resend calling prepare again) → `attemptEmailAddressVerification({ code })`. If `status === 'complete'`, call `setActive({ session: createdSessionId })`. If the name was not accepted at create, try `clerk.user?.update({ firstName })` in a try/catch. Then `router.push('/onboarding')`. If the status is `missing_requirements`, show the Thai error "ต้องกรอกข้อมูลเพิ่มเติม: {missingFields}".
  - Errors in Thai: `form_identifier_exists` → "อีเมลนี้มีบัญชีแล้ว" plus a เข้าสู่ระบบ link; `form_code_incorrect` → "รหัสไม่ถูกต้อง"; anything else → the Clerk longMessage.
  - Validate the email with zod `z.email()` and require a display name of 1–50 chars before calling Clerk.
- `(auth)/sign-up/[[...sign-up]]/page.tsx` renders `<CocoonSignUp />`.
- `(auth)/layout.tsx`: keep DecorBackground and the centred mobile column. At lg render `AuthDesktopHeader` and put the children in the 1152 frame (children decide their own 2-column grid). The onboarding page must still centre inside it; Task 3 restyles it.
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx tsc --noEmit && npm test && npx eslint . 2>&1 | tail -1 | grep -q "10 errors" && echo LINT_OK</automated>
    Plus screenshots using the harness: login/sign-up/OTP(empty + filled) at 1280×832 vs login.png, login-1.png, login-2.png, login-3.png; login at 402px vs iwi ref 01; the preview shell (student + teacher + superadmin nav) at 1280 vs home.png/home-13.png header; the student shell at 402px with the bottom bar vs ref 06; a teacher at 402px showing 3 tabs.
  </verify>
  <done>
    - Tokens are applied and the vitest exclude is added.
    - One `AppShell` serves all roles: the desktop header appears at lg, the bottom bar appears below lg with role-specific tabs, and the sidebar code is gone.
    - `/teacher/review` and `/teacher/profile` exist.
    - Sign-in and sign-up match the login*.png targets at 1280, and sign-in matches ref 01 at 402.
    - Sign-up is a custom Clerk flow that ends at /onboarding.
    - tsc, tests and lint (10 errors) all pass.
    - The preview route and middleware edit are removed, and the work is committed.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Student desktop alignment: horizontal path + status node icons/rings, detail step, 2-col upload, submitted/rejected/re-upload with read-only reviewer comment</name>
  <files>src/lib/todo-deliverables.ts, src/lib/__tests__/todo-deliverables.test.ts, src/server/queries/submission.ts, src/components/cocoon/status-pill.tsx, src/components/student/{node-icons.tsx,node-path.tsx,node-path-desktop.tsx,phase-stepper.tsx,student-todo-view.tsx,todo-detail-view.tsx,todo-submit-view.tsx,submission-status-view.tsx,submission-rejected-view.tsx,submission-file-row.tsx}, src/app/(dashboard)/todo/[todoId]/page.tsx, src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx (student branch only), src/app/(dashboard)/student/page.tsx, src/app/(dashboard)/student/classroom/[classroomId]/page.tsx</files>
  <behavior>
    parseDeliverables(notes: string | null): { items: string[]; rest: string }
    - null / '' → { items: [], rest: '' }
    - "- สรุปผลการสัมภาษณ์\n• ข้อมูลปัญหาที่พบ\n✓ หลักฐานประกอบ" → items ['สรุปผลการสัมภาษณ์','ข้อมูลปัญหาที่พบ','หลักฐานประกอบ'], rest ''
    - mixed "นำข้อมูลไปวิเคราะห์\n- ไฟล์ A\n\n- ไฟล์ B" → items ['ไฟล์ A','ไฟล์ B'], rest 'นำข้อมูลไปวิเคราะห์'
    - leading whitespace before the marker is allowed ("  - x" → 'x'); CRLF handled; a marker with empty text ("- ") is dropped; "-5 องศา" (no space after '-') stays in rest
  </behavior>
  <action>
**A. TDD helper.** RED: write `src/lib/__tests__/todo-deliverables.test.ts` with the cases above, run `npx vitest run src/lib/__tests__/todo-deliverables.test.ts` and confirm it fails, then commit `test(quick-260928-jkg): …`. GREEN: implement `src/lib/todo-deliverables.ts` (regex `^\s*[-•✓]\s+(.+)$` per line; rest = non-item lines joined with '\n' and trimmed, with runs of blank lines collapsed).

**B. Reviewer comment (read-only, additive).** In `getSubmissionHistory`, add `comments: { orderBy: [desc(comments.createdAt)], limit: 1, columns: { content: true } }` to the `with`, and add `reviewerComment: string | null` to `SubmissionHistoryEntry` and `StudentSubmission`. Do not change the access logic.

**C. Status visuals (both breakpoints).**
- `StatusPill`: the approved label becomes "ผ่านแล้ว" and the approved colours use `cocoon-green` (#00a86b) with bg `rgb(0 168 107/.15)`. The rejected pill text stays readable (`#c98200`). Add a `size="lg"` desktop look as used in home-4/7/9: pill with 1px border in the status colour, bg of the status colour at ~15%, 14px bold. If the existing large variant already exists, add a border.
- `src/components/student/node-icons.tsx`:
  - `NodeIcon({ status, locked, size })`: locked → lock `/figma/8f1f5.svg`; none → briefcase `/figma/c64bc.svg`; pending → magnifier composite `/figma/ff79c.svg` + `/figma/c536c.svg` scaled to ≈60px; rejected → hand (first look through `public/figma/*.svg` for the yellow hand from the decor; if it can't be isolated, use lucide `Hand` filled `text-cocoon-yellow` strokeWidth 1.75); approved → target (composite `/figma/987f9.svg`, `867e9`, `3b971`, `b579c` if they compose into the target in home-10, otherwise an inline SVG of concentric green/blue/red rings with an orange arrow ≈70px).
  - `NodeRing({ status, diameter })`: an SVG overlay. Partial arcs start at 12 o'clock and run clockwise ≈90° (as in home.png: orange from 12 to ≈3 o'clock; home-5 blue; home-6 yellow), stroke ≈5px (desktop) / match c7ea2 on mobile, colour orange/blue(`#0069a6`)/yellow(`#faa819`). Approved = a full green `#00a86b` circle, stroke ≈6px.
  - The mobile orange arc must stay pixel-equivalent to ref 02: keep rendering `/figma/c7ea2.svg` for the mobile `none` case and use NodeRing only for the other statuses on mobile.
  - Ring rules (both layouts): currentId node with status none → orange arc; any unlocked node with pending → blue arc; rejected → yellow arc; approved → full green ring. Locked nodes get no ring.
- `node-path.tsx` (mobile): use NodeIcon/NodeRing and add `lg:hidden` to the root. Don't change the geometry.

**D. Desktop path `node-path-desktop.tsx`** (`hidden lg:block`, same props as NodePath). Measured from home.png:
- Nodes ≈220px outer circle (cream ring plus inner white circle, `shadow-cocoon-node`). The node row's vertical centre is ≈y498; the title "งานของฉัน" is at y≈270..305 (28px bold blue) and the row sits ~80px below it.
- Node content: icon ≈60px, title 16px bold ink (active node black 14px bold in the design, use 16px for all), subtitle 12px muted, pill at the bottom. Locked/active colours are the same as mobile.
- Flatten `rows` in order. Between two nodes of the SAME 2-node row insert a "+" connector (56px circle, cream bg, 1px `#9da1a6` border, lucide Plus 28px `text-cocoon-disabled`). Between nodes of DIFFERENT rows insert a "→" connector (56px circle, cream bg, 1px `cocoon-blue` border, lucide ArrowRight 28px `text-cocoon-disabled`).
- A 6px `bg-cocoon-track` line runs behind at the node centre line, from the first node centre to the last element of each line.
- Wrap: at most 3 nodes per visual line. When a line ends and more nodes follow, render the connector at the end of that line (trailing → as in home.png at x≈1222) and start the next line with the next node (a vertical gap of 64px between lines).
- Centre each line in the 1152 column. With 3 nodes the first centre lands ≈x252, i.e. node spacing: centres 252 → 620 → 1003. Use a 56px gap between the node edge and the connector edge.
- Hint text "เลือกงานเพื่อดูรายละเอียด ไฟล์ที่ส่ง และผลตรวจล่าสุด" 14px muted, left-aligned, 80px below the last line (home.png y≈708).
- Nodes are Links to `/todo/{id}` except locked ones (`aria-disabled`).

**E. Stepper + home page.**
- `PhaseStepper` at lg: full 1152 width (the first circle's left edge ≈x70 → an inset of 6px from the column, the last circle's right edge ≈x1201), circles ≈51px with a 1.5px border, track `#ece8e2` h≈8px. Labels "Phase n" show under EVERY circle at lg (12px bold; current/selected blue, the rest `text-cocoon-muted`). Keep the <lg classes as they are (only the selected label on mobile). Implement with `lg:` overrides and a second label element `hidden lg:block` for the non-selected circles.
- Student group page (student branch only): wrap the gutters in `lg:mx-0 lg:px-0`, render the "งานของฉัน" title with lg sizing, render `<NodePath …/>` plus `<NodePathDesktop …/>`, and leave the teacher branch untouched (Task 3). Restyle the `/student` and `/student/classroom/[id]` empty-state and card pages to the lg column (`lg:mx-0`, grid of white cards at lg) without changing the mobile look.

**F. To-do page states (the student branch of `/todo/[todoId]`).**
- `todo/[todoId]/page.tsx`: accept `searchParams: Promise<{ step?: string }>` and pass `step` to `StudentTodoView`. The teacher render is unchanged in this task.
- `StudentTodoView` (server) fetches, derives `latest`, `canUpload`, `phaseViewable` and `previousComment` (the reviewerComment of the most recent rejected submission older than latest), and computes `{ items, rest } = parseDeliverables(todo.notes)`. It picks a presentational view:
  1. `latest` pending|approved → submitted view (G).
  2. `latest` rejected and `step !== 'upload'` → `SubmissionRejectedView` (H).
  3. `step === 'upload'` and (`!latest` or rejected) and phase viewable → `TodoSubmitView` with `mode = rejected ? 'resubmit' : 'new'`.
  4. Otherwise → `TodoDetailView` (no submission, or phase not viewable).
  - Mobile header: `CocoonHeader variant="back"`. backHref = the group home, but from the upload step go back to `/todo/{id}`.
  - Desktop: `PageHeader backHref={groupHome} backLabel="งานของฉัน"`.
- `TodoDetailView` (home-1): PageHeader(title = todo.title, subtitle = the first description line), then at lg `grid grid-cols-[664px_1fr] gap-8` (cards x64..728 and 760..1216, height ≈350).
  - Card "รายละเอียดงาน" (20px bold blue): the rest of the description (16px ink), `rest` notes (16px muted), and the teacher attachments list as "ไฟล์จากครู" if any. This replaces the old "รายละเอียดจากครู" card on mobile too.
  - Card "สิ่งที่ต้องส่ง": each item as "✓ item" 16px ink with 26px spacing (lucide Check 16px), then an orange full-width "เลือกไฟล์" button (h-[49px] rounded-[12px]) pinned to the card bottom that links to `?step=upload`. If the phase is not viewable, replace the button with the muted text "Phase นี้ยังไม่ปลดล็อค — รอครูปลดล็อคก่อนจึงจะส่งงานได้".
  - Mobile: the cards stack with `mx-[33px]` gaps of 16px, same content.
- `TodoSubmitView` (home-2/3, home-8): ONE client tree (don't duplicate the state) with responsive classes. Props become `{ todoId, title, subtitle, mode: 'new'|'resubmit', history }`.
  - At lg the title comes from PageHeader: "ส่งงาน" / "แก้ไขงาน", subtitle "{title} · {firstLine}". The server view renders PageHeader before the client component.
  - lg grid `grid-cols-[552px_1fr] gap-8` (x64..616 and 648..1216, cards height ≈380).
  - Left card at lg: a centred ↑ (lucide ArrowUp 40px blue), "อัปโหลดไฟล์งาน" (or "อัปโหลดไฟล์ฉบับแก้ไข") 24px bold blue, "ลากไฟล์มาวาง หรือกดเลือกไฟล์จากเครื่อง" 16px muted, and a solid blue button "เลือกไฟล์" / "เลือกไฟล์ฉบับแก้ไข" (245×49 rounded-[10px]) that opens the picker. Support text "รองรับ PDF, DOC, DOCX · ไม่เกิน 10 MB ต่อไฟล์" 13px muted. The whole card stays a dropzone. Below lg keep the existing dashed dropzone markup and classes exactly (ref 03).
  - Right card: "ไฟล์ที่เลือก ({n} ไฟล์)" 20px bold blue. Rows use SubmissionFileRow with a new `action` prop: `{ kind:'remove', onRemove } | { kind:'open', onOpen | href }`. On lg a selected row shows "เปิด" (open a local `URL.createObjectURL(file)` in a new tab and revoke it after 60s) and keeps a small × remove; mobile keeps the ×.
  - Also on the right card: a "เพิ่มไฟล์" 16px bold blue text button that opens the picker, and the hint "ตรวจสอบรายการไฟล์ให้ครบก่อนยืนยันส่งงาน" 14px muted. When there are 0 files, show the empty text "ยังไม่ได้เลือกไฟล์" (see home-2).
  - The confirm button at lg is right-aligned, 293×49 at the bottom (y≈704): mode new = orange "ยืนยันส่งงาน", resubmit = yellow `bg-cocoon-yellow` "ยืนยันส่งอีกครั้ง"; disabled = grey `bg-[#d9d9d9] text-white` (home-2). Mobile keeps the full-width button, with the resubmit label/colour applied too.
  - Keep the existing confirm dialog, validation, presigned upload and toasts unchanged.
  - On mobile in resubmit mode, keep the previous yellow notice. The history card below stays on mobile only (at lg the history is in the submitted/rejected views).
- **G. Submitted view (home-4 / home-9).** Keep the current mobile `SubmissionStatusView` (ref 05) inside `lg:hidden`. Add a desktop block `hidden lg:block`:
  - PageHeader title = todo.title, subtitle, and actions = large StatusPill (pending "รอตรวจ" / approved "ผ่านแล้ว").
  - Grid `grid-cols-[684px_1fr] gap-8` (x64..748 and 780..1216, height ≈338).
  - Left card: "ส่งครั้งที่ {n}" 24px bold blue, the date "18 ก.ย. · 16:20" 16px muted (reuse formatSubmissionDate but render the " · " separator per the design; if the helper output is "18 ก.ย. 16.20", accept that format rather than changing the tested helper), and file rows with a "เปิด" link (existing `getSubmissionFileUrl` flow used by SubmittedFiles).
  - Right card: "ประวัติการส่ง" 20px bold blue. Entries are "● ครั้งที่ n · {label}" 16px bold in the status colour, with the date 14px muted beneath and 20px between entries.
  - If `previousComment` is set: a yellow card "คำแนะนำครั้งก่อน" (bg `#fff4df`, border `#fbe6b8`, title 16px bold dark-yellow, text 16px ink) under the left card, width 684 (home-9).
  - Footer row: left "รอผู้ตรวจตรวจงาน แล้วจะแจ้งผลให้ทราบ" (approved: "งานนี้ผ่านการตรวจแล้ว") 16px muted; right an orange "กลับหน้าหลัก" link-button 313×49 → group home (home-9 x904..1216).
  - On mobile, add the "คำแนะนำครั้งก่อน" card above the history when present.
- **H. `SubmissionRejectedView`** (home-7), responsive single tree:
  - PageHeader with the rejected large pill "ต้องแก้ไข".
  - lg grid as in G: the left card is the latest submission (ส่งครั้งที่ n + files with เปิด) and the right card is the history.
  - The yellow card "คำแนะนำจากผู้ตรวจ" shows `latest.reviewerComment`; if null, show "ผู้ตรวจส่งงานกลับให้แก้ไข" in muted text.
  - Footer: a yellow "แก้ไขงาน" button 313×49 right → `?step=upload`.
  - Mobile: stacked, with the yellow card first, then the submission card, the history, and the full-width yellow button (h-[55px] rounded-[12px], matching the mobile primary button).
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx vitest run src/lib/__tests__/todo-deliverables.test.ts && npx tsc --noEmit && npm test && npx eslint . 2>&1 | tail -1 | grep -q "10 errors" && echo LINT_OK</automated>
    Plus harness screenshots with mock data (make views presentational so the preview can pass mock `todo`, `submissions`, `statuses`):
    - 1280×832 vs home.png (none current), home-5 (pending), home-6 (rejected), home-10 (approved), home-1 (detail), home-2 (0 files), home-3 (2 files), home-4 (submitted r1), home-7 (rejected), home-8 (resubmit), home-9 (r2 with previous comment).
    - 402×874 vs iwi refs 02 (home), 03 (upload), 04 (dialog), 05 (pending); check that nothing regressed apart from the intended status icon/ring changes and the new detail/rejected states.
    - Also a 5-node phase at 1280 to check wrapping.
  </verify>
  <done>
    - parseDeliverables is tested (RED then GREEN commits).
    - Nodes show status icons and rings on both layouts; the desktop path is horizontal, wraps after 3 nodes, and matches home*.png.
    - The detail → upload → submitted and rejected → re-upload → round-2 flow matches home-1..10 at 1280, and mobile matches the iwi refs at 402.
    - The reviewer comment is displayed read-only.
    - Server actions and access checks are unchanged.
    - tsc, tests and lint (10 errors) pass; the preview is removed and the work is committed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Teacher/admin management screens in the Cocoon language (behaviour unchanged) + final build</name>
  <files>src/app/(dashboard)/teacher/page.tsx, src/app/(dashboard)/teacher/classroom/new/page.tsx, src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx, src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx, src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx (teacher branch), src/app/(dashboard)/todo/[todoId]/page.tsx (teacher branch), src/app/(dashboard)/admin/{page.tsx,admin-actions.tsx}, src/app/(auth)/onboarding/page.tsx, src/components/classroom/{classroom-card,classroom-settings-form,create-classroom-form,invite-code-display}.tsx, src/components/group/{assign-student-dialog,create-group-form,group-card}.tsx, src/components/phase/{inline-add-phase,phase-edit-form,phase-item,phase-list}.tsx, src/components/todo/{inline-add-todo,todo-attachments-list,todo-detail,todo-edit-form,todo-item,todo-list}.tsx, src/components/template/template-picker.tsx, src/components/student/group-phase-view.tsx</files>
  <action>
This is a styling-only pass (CONTEXT item 5). Don't change any server action call, prop contract, form schema, state logic or query. Classes, markup wrappers and copy for headings may change. Each page:
- `CocoonHeader variant="home"` for the mobile header (it's hidden at lg).
- `PageHeader` with a "‹ parent" back link, title and subtitle.
- Content column `px-[33px] lg:px-0`, 16px vertical rhythm on mobile, 32px on desktop.

Visual language (from home-11/13 and the student screens):
- Cards: `rounded-[16px] border border-[#f1ece5] bg-white p-5 lg:p-7`.
- Card titles: 20px bold `text-cocoon-blue`. Meta text: 14px `text-cocoon-muted`.
- Primary buttons: orange (`bg-primary`, already themed), h-[49px] rounded-[12px] font-bold. Secondary/info: solid blue `bg-cocoon-blue text-white` (like "เช็คงาน"). Tertiary: white with a `border-cocoon-line` border.
- Inputs/textarea: `rounded-[12px] bg-[#fffaf3] border-[#f1ece5] h-12`.
- Dialogs: white rounded-[20px] panels like home-13 (title 26px bold centred ink, subtitle muted, a full-width primary button, then a text-only "ยกเลิก" in blue).
- Empty states: a white card with a centred message and an orange CTA. The shadcn dashed border goes.

Per screen:
1. `/teacher` (dashboard): PageHeader title "ทีมของฉัน", subtitle "ห้องเรียนทั้งหมดของคุณ", action "+ สร้างห้องเรียน" (orange). Classroom cards in a `grid gap-4 lg:grid-cols-2 lg:gap-8` (home-11 card proportions: 564px wide, name 24px bold ink, "สมาชิก n คน · n กลุ่ม" 14 muted, blue "เปิดห้องเรียน" button bottom-right). Restyle `classroom-card.tsx`.
2. `/teacher/classroom/new`: PageHeader back "ทีมของฉัน" → /teacher, title "สร้างห้องเรียน"; `create-classroom-form` in a single card (max-w 640 at lg).
3. `/teacher/classroom/[id]`: PageHeader back "ทีมของฉัน" → /teacher, title = classroom name, subtitle = description.
   - Tabs become the home-11 segmented pill: TabsList `rounded-full border border-[#f1ece5] bg-white p-0 h-[47px]`; each trigger `rounded-full px-8 text-[16px] font-bold text-cocoon-blue` with active `bg-cocoon-blue text-white`. Pass the classes at the call site; don't change `ui/tabs.tsx` defaults. The pill is right-aligned on the title row at lg and full-width on mobile.
   - Groups tab: "กลุ่มทั้งหมด (n)" plus the CreateGroupForm trigger, and group cards (`group-card.tsx`: name 20px bold ink, member count, avatars/list as it has now, blue "จัดการ Phase" button, and the assign-student dialog trigger as a tertiary button).
   - Settings tab: InviteCodeDisplay (big League Spartan code 32px bold blue in a `bg-cocoon-blue-soft` rounded-[12px] box, copy/regenerate as tertiary buttons) and ClassroomSettingsForm in cards stacked on mobile, `lg:grid-cols-2`.
4. Group editor (`/teacher/classroom/[id]/group/[gid]` + `phase-*`, `todo-*`, `inline-add-*`, `template-picker`): PageHeader back = classroom name → classroom page, title = group name, subtitle "จัดการ Phase และงานของกลุ่ม".
   - PhaseList: each phase is a card with a header row (Latin "Phase n" 12px bold blue, name 20px bold ink, a status pill reusing StatusPill-like classes: active blue / locked grey / completed green, and the existing controls restyled as icon buttons) and the TodoList inside. Todo items are rows `rounded-[12px] bg-[#fafbfc] border border-[#e4e8ee] px-4 py-3` with the title 16 bold ink, meta (mode/deadline) 13 muted, and actions on the right.
   - Inline add rows use a dashed `border-cocoon-blue/40 bg-cocoon-blue-soft` "+ เพิ่ม Phase / + เพิ่มงาน" button.
   - Attachments list rows use the same file-row style as the student side (type tag orange).
   - TemplatePicker: cards grid `lg:grid-cols-3`, template name 18 bold, orange "ใช้เทมเพลตนี้".
   - Keep the drag-and-drop (@dnd-kit) wiring intact.
5. Teacher branch of the student group page (`student/classroom/.../group/[gid]` when role is teacher): PageHeader(title = group.name) and the empty-state TemplatePicker; `group-phase-view.tsx` restyled with the same phase/todo card language (read-only view).
6. Teacher branch of `/todo/[todoId]`: replace the breadcrumb and shadcn cards with PageHeader (back = group name → teacher group page, title = todo.title, subtitle "{classroom} · {group} · {phase}", actions = a tertiary "แก้ไข" button and mode/deadline pills). Then a lg `grid-cols-[664px_1fr]` with the "รายละเอียดงาน" card (TodoDetail, restyled) and "ไฟล์แนบ" / "สิ่งที่ต้องส่ง" (use parseDeliverables from Task 2 to show the ✓ list). Also a muted card "การตรวจงานจะเปิดให้ใช้ใน Phase ถัดไป" in place of the two placeholder cards.
7. `/admin` + `admin-actions.tsx`: PageHeader title "แอดมิน", subtitle "อนุมัติบัญชีครู". Pending-teacher rows are cards with name/email, a green "อนุมัติ" button (`bg-cocoon-green`) and a tertiary "ปฏิเสธ" button if it exists, plus an empty state.
8. `(auth)/onboarding/page.tsx`: the loading/pending/error states as a centred white Cocoon card (max-w-[440px], rounded-[16px], an hourglass `lucide Hourglass` in an orange-soft tile `bg-[#fff0ea]` for pending, 22px bold heading, muted body). It sits inside the Task 1 auth layout. Keep the effect logic as it is.

After restyling, grep for leftover default-shadcn page chrome in these files (`text-2xl font-bold`, `border-dashed p-12`, `text-muted-foreground` headings) and replace any that remain.

Final checks: `npm run build` must pass (Next 16 Turbopack). If `node_modules` is a symlink, Turbopack fails (see the iwi SUMMARY), so use a real clone.
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx tsc --noEmit && npm test && npx eslint . 2>&1 | tail -1 | grep -q "10 errors" && npm run build && echo ALL_OK</automated>
    Plus harness screenshots with mock data at 1280×832 and 402×874 of: the teacher dashboard (0 and 3 classrooms), the classroom groups + settings tabs, the group editor with 2 phases / 3 todos, the template picker empty state, the teacher to-do page, admin, and onboarding-pending. Compare with the home-11/13 language (header link "ทีมของฉัน", segmented pill, cards, buttons). Re-shoot the student home and upload at 402 to confirm the token change caused no regression.
  </verify>
  <done>
    - Every teacher, admin and onboarding screen uses the Cocoon shell, PageHeader, cards and themed buttons, with no sidebar and no default-shadcn page chrome.
    - The create classroom/group, assign student, invite code, settings, phase/todo CRUD, drag reorder, attachments, templates and admin approve flows behave as before.
    - `npm run build` passes, lint is still 10 errors, and tests are green.
    - The preview route and middleware edit are removed, and the work is committed.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit`, `npm test` (includes todo-deliverables), `npx eslint .` → "10 errors" (the unchanged baseline), `npm run build` succeeds.
- `grep -rn "StudentShell\|AppSidebar\|SidebarProvider" src/app` → no matches.
- `git status` after the final commit: no `src/app/preview-jkg`, `middleware.ts` unchanged vs HEAD~3.
- Screenshot sets (desktop 1280×832 vs design/mac, mobile 402×874 vs the iwi/jkg refs) were reviewed for every screen listed in the task verifies. The executor lists any residual differences in the SUMMARY.
- Invariants: no changes to `src/server/actions/**`, `src/db/**`, `package.json`, `package-lock.json`; `src/server/queries/submission.ts` changes are only the additive `reviewerComment`.
</verification>

<success_criteria>
- Desktop (≥1024px) for all roles follows design/mac: the header shell, the auth 2-column layout, the student home/detail/upload/submitted/rejected/re-upload screens, and teacher/admin in the same language.
- Mobile (<1024px) still matches the 260928-iwi refs. The only intended changes are the status-specific node icons/rings, the new detail step, and the rejected/reviewer-comment states.
- Teachers have Cocoon tabs (หน้าแรก/ทีมของฉัน, ตรวจงาน, โปรไฟล์, +แอดมิน) with working placeholder/profile pages.
- Sign-up is a custom Clerk flow with 6-box OTP.
- Behaviour and data flow are unchanged; Phase 4 review stays out of scope.
</success_criteria>

<output>
After completion, create `.planning/quick/260928-jkg-apply-cocoon-ui-ci-to-teacher-and-admin-/260928-jkg-SUMMARY.md`
</output>
