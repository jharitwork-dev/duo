# Quick Task 260928-iwi: Cocoon UI redesign from Figma — student flow - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the default-shadcn **student** UI with the Cocoon-branded design from Figma file
`gqu9PQ17xf7wePVeMOciMN` ("Innovator's Track"), page "Iphone" (node 10:5765), and ship the
Phase 3 file-submission loop behind it:

1. Student app shell (decor background + bottom tab bar) — students only; teachers/admin keep the
   existing sidebar layout untouched.
2. Custom login screen (Google + email OTP) replacing Clerk's `<SignIn />` card.
3. Student home = node-path view (phase stepper + to-do nodes with submission status).
4. To-do page for students: upload files → confirm dialog → submitted/pending state + history.
5. Placeholder tabs: งานของฉัน, กำหนดส่ง, โปรไฟล์ (profile must include sign-out).

OUT of scope: teacher review screens (Phase 4, separate task), link/text submissions (design has
files only), notifications bell behaviour (render icon only), sign-up / OTP-verification screen
restyle beyond what the custom login flow needs.

**Figma budget:** the Figma Starter plan allows 20 MCP requests/month and ~15 are used.
DO NOT call Figma MCP tools. Everything needed is in this file, in `refs/*.png` (visual targets)
and in `public/figma/*` (assets, already committed).
</domain>

<decisions>
## Implementation Decisions (locked by user)

- Student home uses the **node path** variant (Figma frames 142:1589 / 167:2213), not the card grid.
- **Fully responsive**: at ≤ 430px wide it must match Figma (402×874 frames). Tablet/desktop layout
  is Claude's design: same components, centered content column (max-w ~ 640–720px), decor
  shapes pinned to the left/right viewport edges (already handled by `DecorBackground`), tab bar
  becomes a centered floating pill at md+.
- Work runs as this GSD quick task with atomic commits.

## Already done (commit 2113746)

- `src/app/globals.css`: Google Fonts import (IBM Plex Sans Thai Looped 400/500/700, League Spartan
  500/700); `--font-sans` = IBM Plex Sans Thai Looped; `--font-latin` = League Spartan; color tokens
  `cocoon-cream #fffaf3, cocoon-blue #0069a6, cocoon-blue-soft #f0f9ff, cocoon-orange #ef4924,
  cocoon-yellow #faa819, cocoon-green #1a9e55 (approximation, not from Figma), cocoon-ink #1d2531,
  cocoon-heading #213547, cocoon-muted #878ea8, cocoon-subtle #64717c, cocoon-disabled #9da1a6,
  cocoon-line #e4e1dc, cocoon-track #efece7`, `shadow-cocoon-node`. Use these as Tailwind classes
  (`bg-cocoon-cream`, `text-cocoon-blue`, `font-latin`, ...).
- `src/components/cocoon/decor-background.tsx` → `<DecorBackground />` (fixed, -z-10, cream bg).
- `public/figma/*` assets (see asset table below).

## Design spec (Figma px @ 402×874; content gutter = 33px each side → 336px content width)

### Global
- Page bg cream `#fffaf3` + `<DecorBackground />`. White cards: `bg-white border border-cocoon-line rounded-[12px]`.
- Primary button: `bg-cocoon-orange text-white font-bold text-[16px] h-[55px] rounded-[12px] w-full`.
- Logo: `/figma/3a22e.png` (759×353) rendered at 176×82.
- Back button: `/figma/be57a.svg` 20×20, at left gutter, vertically centred with logo.
- Figma status bar / home indicator are iOS chrome — do NOT render them.
- Text is `leading-normal`. Weights: Bold=700, Medium=500.

### Bottom tab bar (frame 50:965, ref 06)
- `bg-white border-t border-cocoon-line px-6 py-3 flex justify-between`, 4 tabs, each column
  `gap-1`, icon 22px, label 11px bold. Active = `text-cocoon-orange`, inactive = `text-cocoon-muted`.
- Icons are Feather icons → use lucide-react `House`/`Home`, `SquareCheck`, `Calendar`, `User`
  (strokeWidth ~1.75) so colour follows `currentColor`. (Figma SVGs f3131/67ea4/39a61/55514 have
  baked-in colours; lucide is the codebase-native equivalent.)
- Tabs: หน้าแรก → `/student`, งานของฉัน → `/student/tasks`, กำหนดส่ง → `/student/deadlines`,
  โปรไฟล์ → `/student/profile`. Home tab is active for `/student/**` group pages and `/todo/**`.
- Mobile: fixed bottom, full width, safe-area padding. md+: floating centred pill
  (`rounded-full shadow`, max-w-md, bottom-6). Content needs bottom padding so nothing hides behind it.

### Login (frame 18:5805, ref 01)
- Logo top-left at (13, 75). Title "เข้าสู่ระบบ" 36px bold orange at (30, 141).
- Blue highlight bar `bg-cocoon-blue` 316×39 at (33, 197) with "พร้อมไปต่อกับโปรเจกต์ของคุณ" 20px bold white (inline highlight, text starts 3px in).
- Card: white, border line, radius 16, 336 wide, top 278, h 357, inner padding ~19–20px.
  - Google button: 297×56, white, border line, radius 8; Google "G" `/figma/0938b.png` 20×20 + "เข้าสู่ระบบด้วย Google" 14 bold black, centred.
  - Divider: two lines `rgba(0,0,0,.25)` 1px with "หรือ" 12 medium `rgba(0,0,0,.25)` between.
  - Label "อีเมลหรือเบอร์โทร" 14 medium black; input 297×56 radius 8 border line, placeholder "กรอกอีเมลหรือเบอร์โทร" 14 medium `rgba(0,0,0,.25)`, text padding-left 14.
  - Helper "รับรหัส OTP เพื่อเข้าสู่ระบบ" 12 medium `rgba(0,0,0,.25)`.
  - Orange button 297×55 radius 12 "รับรหัส OTP".
- Below card: "ยังไม่มีบัญชี ?" 14 medium `rgba(0,0,0,.3)` + link "สมัครสมาชิก" 14 medium blue underline → `/sign-up`. (Figma typo "สมัครสมาชิค" — use correct spelling.)
- Flow (Clerk custom flow using `useSignIn` from `@clerk/nextjs/legacy`, Clerk 7.9):
  - Google: `signIn.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/sign-in/sso-callback', redirectUrlComplete: '/' })`
    + an `sso-callback` page rendering `<AuthenticateWithRedirectCallback />`.
  - Email/phone OTP: `signIn.create({ identifier })` → pick `email_code` or `phone_code` first factor → `prepareFirstFactor` → step 2 shows a 6-digit code entry styled in the same card (Figma has a "Verification Code / We have sent the verification code to your email address" screen, frames 18:5807/18:5809 — reuse login styling, title "ยืนยันรหัส OTP") → `attemptFirstFactor` → `setActive({ session })` → `router.push('/')`.
  - Show Clerk errors inline in Thai-friendly text (e.g. account not found → suggest สมัครสมาชิก). If a strategy is not enabled in the Clerk instance, show the error message; do not crash.
  - `/sign-in/[[...sign-in]]` catch-all must still serve the sso-callback sub-route.
- Page has the decor background; responsive: centred column max-w-[402px] on desktop.

### Student home — node path (frames 142:1589 / 167:2213, ref 02)
Header: logo top-left (14, 73); bell icon (`/figma/2bba0.svg` 26×30, blue) top-right at (343, 98).

Phase stepper (y≈140–187):
- Track `bg-black/5` h-[11px] rounded-[12px], from first circle centre to last circle centre; progress
  fill `bg-cocoon-blue` over it up to the current phase.
- Circles 47px: current/completed = filled `bg-cocoon-blue` + white number; not reached = white fill,
  1px blue border, blue number. Number: `font-latin font-bold text-[24px]`.
- Label under current circle: "Phase {n}" 12px bold blue.
- Circles distribute evenly (justify-between) for any N phases (Figma shows 3 at x≈23+10, 170, 322).
- Clicking an unlocked/completed/free-access phase circle switches the viewed phase (`?phase=<id>`);
  locked phases are not clickable. Default = first `active` phase, else last completed, else first.

Section title "งานของฉัน" 20px bold blue at (33, 236).

Node path (content box 336 wide, starts y≈290):
- Rows alternate 1 node, 2 nodes, 1, 2, … filled from the phase's to-dos in orderIndex.
- Node = 152×149 outer ellipse `bg-cocoon-cream shadow-cocoon-node rounded-full` with inner white
  ellipse 142×141 inset (5,4). Single-node row: centred. Two-node row: left node at x=0, right at x=184.
- Row pitch 264px (node 149 + 115 gap).
- Connectors (behind nodes), colour `cocoon-track #efece7`, 6px thick:
  between row A and row B at junction y = midpoint of the gap + ~10px: vertical from each node centre in
  A down to junction, horizontal bar spanning min→max centre x of both rows, vertical from junction
  down to each node centre in B. At the junction centre (x=168) draw a 56px circle `bg-cocoon-cream`
  1px blue border with a "↓" (IBM Plex bold 32px, `text-cocoon-disabled`) — i.e. the "→" rotated 90°.
- Node content (centred column): icon, title 14 bold `text-cocoon-ink` (or black for the active node),
  subtitle 12 medium `text-cocoon-muted` (first line of `todo.description`, truncate), status pill.
  - Unlocked icon: briefcase `/figma/c64bc.svg` 50×45. Locked icon: lock `/figma/8f1f5.svg` 32×41 (grey).
  - Current task (first unlocked & not-yet-submitted node, or rejected) gets the orange progress arc
    `/figma/c7ea2.svg` (73.7×84.5) overlaid at node offset (76, 2).
- Status pills (rounded-[26px], dot + text, `px-2`):
  - `none` "ยังไม่ส่ง": bg `rgba(255,27,15,.2)`, text 10px medium orange, dot 8px orange.
  - `locked` "ยังไม่ปลดล็อค": bg `rgba(15,23,42,.05)`, text 12px medium `#9da1a6`, dot 7px `rgba(29,37,49,.4)`.
  - `pending` "รอตรวจ": bg `rgba(0,105,166,.2)`, text/dot blue.
  - `rejected` "ต้องแก้ไข": bg `rgba(250,168,25,.2)`, text/dot yellow (use a darker yellow text e.g. `#c98200` if contrast is poor).
  - `approved` "สำเร็จแล้ว": bg `rgb(26 158 85 / .15)`, text/dot green.
  - Pill also has a large variant (text 16px medium, dot 17px, h-[31px]) used on the submitted page.
- Node click → `/todo/{todoId}`; locked nodes are `aria-disabled`, not links.
- Empty states (no phases / no todos / no group / no classroom) keep existing logic but restyle to a
  white card on the cream background.

Locking rule (to-do level, derived — no schema change):
- If the phase is `locked` and not `isFreeAccess` → every node locked.
- If phase `completed` or `isFreeAccess` → no node locked.
- Otherwise row 0 is unlocked; row r is unlocked when every to-do in rows < r has a submission
  (any status). NOTE: switch to "approved" once Phase 4 review exists — leave a TODO comment.

Submission status per to-do (latest submission wins):
- group to-do: latest submission where `todoId` = todo and `groupId` = student's group.
- individual to-do: latest submission where `todoId` = todo and `submittedBy` = current user.
- No submission → `none`; `pending` → รอตรวจ; `rejected` → ต้องแก้ไข; `approved` → สำเร็จแล้ว.

### To-do page for students (frames 18:5821 upload, 118:2216 confirm, 56:1761 submitted; refs 03–05)
`/todo/[todoId]` keeps the current teacher/admin view unchanged; students get the new view.
Header: back arrow at (33, 108) → back to the group home; logo centred at (113, 75).
Title = todo.title 32px bold blue at (31, 149); subtitle = description first line 12px bold muted.

A. Upload state (no submission yet, or latest is `rejected`):
- Dropzone 336×162 radius 12 `bg-cocoon-blue-soft border border-dashed border-cocoon-blue`, top 224:
  cloud icon `/figma/7b064.svg` 60×60 centred; "เพิ่มไฟล์" 20 bold blue; "ลากไฟล์มาวางที่นี่ หรือกดเลือกไฟล์"
  and "รองรับไฟล์ PDF, DOC, DOCX (ไม่เกิน 10 MB)" 10 medium `rgba(0,105,166,.5)`. Click opens file picker,
  drag-and-drop supported, multiple files. Drag-over state: bg `rgba(73,188,255,.1)`.
- Files card: white, border line, radius 12, 336 wide, p≈20: heading "ไฟล์ที่เลือก" 16 bold black
  (Figma says "ไฟล์ที่ส่งไปแล้ว" but these are not sent yet), then rows.
- File row: 297×49, `bg-[#f8fafc] border border-[#e4e8ee] rounded-[8px]`: type tag ("PDF"/"DOC"/…) 10 bold
  `#f04a24`; filename `font-latin` 12 medium `#161c24` (truncate); size 11 medium muted; remove "×"
  `/figma/e2ca4.svg` 9×9 button. Gap 7px between rows.
- Warning banner 336×45 radius 12 `bg-[rgba(250,168,25,.2)] border border-cocoon-yellow`: icon
  `/figma/a189d.svg` 13×13 + "ตรวจสอบไฟล์ก่อนยืนยันส่ง" 14 medium yellow. Show only when ≥1 file selected.
- Primary button "ยืนยันส่งไฟล์" at the bottom (disabled + 50% opacity when no files) → opens confirm dialog.
- If latest is `rejected`: show a small yellow notice "งานถูกส่งกลับให้แก้ไข — อัปโหลดไฟล์ใหม่" above the dropzone,
  plus the history card (section B) below.
- Validation: allowed = PDF, DOC, DOCX, plus the existing R2 allow-list (images, pptx, xlsx, zip, mp4);
  max 10 MB per file; reject others with a toast (sonner).

B. Confirm dialog (ref 04) — use existing `src/components/ui/dialog.tsx`, restyled:
- Overlay `rgba(20,32,43,.48)`. Panel white radius 16, 354 wide (max-w-[354px] w-[calc(100%-48px)]), p-6.
- Icon tile 40×40 radius 12 `bg-[#fff0ea]` with orange check (`/figma/0d869.svg` 21×19).
- "ยืนยันส่งงาน?" 22 bold `text-cocoon-heading`; todo title 17 bold `#0269a7`;
  "ตรวจสอบรายการไฟล์ให้ครบก่อนยืนยันส่งงาน" 14 regular `text-cocoon-subtle`.
- Summary box `bg-cocoon-cream border border-[#ebe5dd] rounded-[10px] p-4`: "เลือกแล้ว {n} ไฟล์ · {total}" 14 bold
  heading colour; each file "name · size" 12 regular subtle.
- Buttons full width: primary orange h-12 rounded-[10px] "ยืนยันส่งงาน" (shows spinner / "กำลังส่ง…" while
  uploading, disabled); secondary white `border border-[#dce1e5]` h-[45px] rounded-[10px] "กลับไปตรวจไฟล์"
  15 regular `#53616b` closes dialog.

C. Submitted state (latest `pending` or `approved`, ref 05):
- Status card white radius 12, 336 wide, p≈20: magnifier illustration (`/figma/ff79c.svg` 86×86 circle +
  `/figma/c536c.svg` 38×38 handle, handle overlapping bottom-right) left; right side large pill
  ("รอตรวจ" blue / "ผ่านการตรวจ" green) + text 14 medium muted ("รอตรวจงานแล้วแจ้งผลให้ทราบ" /
  "งานนี้ผ่านการตรวจแล้ว"); divider `border-cocoon-line`; "ส่งครั้งที่ {n}" 16 bold + date 14 medium muted
  right-aligned; submitted file rows (same row style) with "↗" (16px `#0269a7`) opening a presigned GET
  URL in a new tab instead of the remove button.
- History card white radius 12, p≈20: "ประวัติการส่ง" 16 bold; one row per submission (newest first):
  `h-[55px] rounded-[10px] border border-cocoon-line bg-[rgba(245,245,245,.3)] px-4`: "● ครั้งที่ {n} · {status}"
  12 regular blue (colour follows status) left, date 12 medium muted right.
- Primary button "กลับหน้าหลัก" → group home.
- Date format "18 ก.ย. 13.59": th-TH day + short month, then HH.mm (24h, dot separator). Add a helper
  to `src/lib/format.ts` (+ unit test in `src/lib/__tests__/format.test.ts`).

### Submission backend (Phase 3, SUB-01/04/05/06 — files only)
- `src/server/queries/submission.ts`: `getTodoSubmissionStatuses(groupId, userId, todos)` for the home
  path; `getSubmissionHistory(todoId, userId)` returning submissions + files for the page (scoped by the
  group/individual rule above). Verify access via classroom/group membership like existing queries.
- `src/server/actions/submission.ts` ('use server', zod-validated, `requireRole(ROLES.STUDENT)`):
  - `createSubmissionUploadUrl({ todoId, fileName, contentType, size })` → validates membership, type,
    size ≤ 10 MB; key = `submissionKey(userId, todoId, `${cuid}-${safeName}`)`; returns `{ key, url }` from `presignPut`.
  - `createSubmission({ todoId, files: [{ key, fileName, contentType, size }] })` → re-checks access, that
    keys start with `submissions/{userId}/{todoId}/`, blocks a new submission when the latest is
    `pending` or `approved`, inserts `submissions` (status pending, groupId = student's group) +
    `submission_files` in one transaction, `revalidatePath` for the todo and group pages.
  - `getSubmissionFileUrl({ fileId })` → access check → `presignGet(key, 3600, inline disposition)`.
- Client uploads with `fetch(url, { method: 'PUT', headers: { 'content-type': type }, body: file })`.
  Uses the same R2 bucket/CORS as teacher attachments.
- Add `'application/msword'` to the R2 allow-list in `src/lib/r2.ts`.

### Routing / layout
- `src/app/(dashboard)/layout.tsx`: if role is `student` → render `<StudentShell>` (DecorBackground +
  children in a centred column + bottom tab bar) instead of the Sidebar layout. Teachers/admin unchanged.
- `src/app/(auth)/layout.tsx`: cream bg + DecorBackground for sign-in (sign-up/onboarding can keep Clerk
  components but must sit on the same background).
- New placeholder pages `/student/tasks`, `/student/deadlines` (white card "เร็ว ๆ นี้"), `/student/profile`
  (Clerk user name/email/avatar + sign-out button using `SignOutButton` or `useClerk().signOut`).
- Remove the now-unused `GroupPhaseView` only if nothing else imports it.

### Asset table (public/figma)
| file | use |
|------|-----|
| 3a22e.png | Cocoon logo |
| 0938b.png | Google G logo |
| 2bba0.svg | bell (blue) |
| be57a.svg | back arrow |
| c64bc.svg | briefcase node icon |
| 8f1f5.svg | lock node icon |
| c7ea2.svg | orange active arc |
| 7b064.svg | upload cloud |
| a189d.svg | warning (yellow) |
| e2ca4.svg | remove × |
| 0d869.svg | orange check (dialog) |
| ff79c.svg + c536c.svg | magnifier illustration |
| everything else | decor shapes (used by DecorBackground) or superseded by CSS |

### Claude's Discretion
- Exact desktop layout details, animation (optional `motion` fade/scale on nodes is fine but not required
  — `motion` is NOT installed; do not add it just for this).
- Component file structure under `src/components/cocoon/` and `src/components/student/`.
- Loading/skeleton states.
</decisions>

<specifics>
## Specific Ideas

- Visual targets: `refs/01-login.png`, `02-home-node-path.png`, `03-submit-upload.png`,
  `04-submit-confirm-dialog.png`, `05-submitted-pending.png`, `06-bottom-tab-bar.png` (368×800 or
  402×874 renders). Compare implementation against these at 402px viewport.
- Next.js here is 16.3 with breaking changes — read `node_modules/next/dist/docs/` before using
  unfamiliar APIs (see AGENTS.md). Fonts are loaded via CSS @import on purpose (Turbopack build fix, commit 63d4bb7) — don't switch to next/font.
- Plain `<img>` is acceptable for the static SVG assets (add an eslint-disable comment like decor-background.tsx).
</specifics>

<canonical_refs>
## Canonical References

- Figma file `gqu9PQ17xf7wePVeMOciMN`, page node `10:5765` (do NOT query — budget exhausted)
- `.planning/ROADMAP.md` Phase 3 (SUB-01..06) and Phase 5 (UI-01..04)
- `src/lib/r2.ts`, `src/server/actions/todo.ts` (presign pattern), `src/server/queries/*` (access-check pattern)
</canonical_refs>
