---
phase: quick-260928-jkg
plan: 01
subsystem: ui-shell, auth, student-ui, teacher-ui
tags: [cocoon, desktop, design-mac, clerk, sign-up, otp, node-path, teacher, admin]
requires:
  - 260928-iwi (Cocoon student mobile UI, submission layer)
  - 6ca2b6a (onboarding redirect-loop fix, merged before restyling onboarding)
provides:
  - AppShell (role-aware; DesktopHeader lg / BottomTabBar <lg) + navItemsFor(role)
  - PageHeader, ProfileCard, cocoon/ui.ts class tokens, illustrations (hand, target)
  - Desktop 2-column auth, OtpBoxes/OtpCodeForm, custom Clerk sign-up (CocoonSignUp)
  - parseDeliverables (สิ่งที่ต้องส่ง from notes bullets)
  - NodePathDesktop, NodeIcon/NodeRing, TodoDetailView, SubmissionRejectedView, SubmissionStatusDesktop
  - StudentTodoScreen (presentational to-do screen, ?step=upload)
  - reviewerComment (read-only) on SubmissionHistoryEntry
  - /teacher/review (placeholder), /teacher/profile
affects:
  - src/app/(dashboard)/layout.tsx (no sidebar for any role)
  - every teacher/admin page, onboarding, student to-do page
tech-stack:
  added: []
  patterns:
    - "Desktop = lg (>=1024). Mobile markup kept verbatim under lg:hidden where a separate desktop tree was simpler; one shared state."
    - "Presentational/data split for screenshotable screens (StudentTodoScreen)."
    - "Cocoon class constants in a plain module (cocoon/ui.ts) usable by server and client components."
key-files:
  created:
    - src/components/cocoon/{nav-items.ts,app-shell.tsx,desktop-header.tsx,page-header.tsx,profile-card.tsx,illustrations.tsx,ui.ts}
    - src/components/auth/{auth-parts.tsx,otp-boxes.tsx,cocoon-sign-up.tsx}
    - src/app/(dashboard)/teacher/{review,profile}/page.tsx
    - src/lib/todo-deliverables.ts
    - src/lib/__tests__/todo-deliverables.test.ts
    - src/components/student/{node-icons.tsx,node-path-desktop.tsx,todo-detail-view.tsx,submission-rejected-view.tsx}
  modified:
    - src/app/globals.css, vitest.config.ts
    - src/app/(dashboard)/layout.tsx, src/app/(auth)/layout.tsx, sign-up page
    - src/components/auth/cocoon-sign-in.tsx
    - src/components/cocoon/{bottom-tab-bar,cocoon-header,decor-background,status-pill,coming-soon-card}.tsx
    - src/components/student/{node-path,phase-stepper,student-todo-view,todo-submit-view,submission-status-view,submission-file-row,group-phase-view}.tsx
    - src/server/queries/submission.ts (additive reviewerComment only)
    - student pages, todo page, all teacher/admin pages, onboarding, classroom/group/phase/todo/template components
  deleted:
    - src/components/cocoon/student-shell.tsx, src/components/app-sidebar.tsx, src/components/user-nav.tsx
decisions:
  - "Hand (ต้องแก้ไข) and target (ผ่านแล้ว) are inline SVGs: no isolated hand/target exists in public/figma (987f9 is an eye, 867e9/3b971/b579c are pill shapes)."
  - "Ring sweep per status: orange/blue ≈105°, yellow 180°, green full circle — measured from home/home-5/home-6/home-10."
  - "StatusPill gains size='xl' for the desktop title-row pill instead of adding a border to the existing lg pill (keeps mobile ref 05 unchanged)."
  - "TodoSubmitView keeps the exact iwi mobile markup (lg:hidden) plus a desktop subtree; state, handlers and confirm dialog are shared."
  - "Desktop node path centres nodes+inner connectors in the 1152 column; the trailing → overflows right (matches home.png x1194..1250). Below xl it is zoomed to 0.85 so 3 nodes fit at 1024–1279."
  - "OTP code step: when all 6 digits are filled the green resend button is replaced by orange ยืนยัน (login-3); a small 'ส่ง OTP อีกครั้ง' text link stays available next to the back link."
  - "'Verification Code' uses the Thai sans (IBM Plex Sans Thai Looped), not League Spartan, because that matches the PNG glyphs."
metrics:
  duration: ~75 min
  completed: 2026-09-28
  tasks: 3
  commits: 5
---

# Quick 260928-jkg Plan 01: Desktop Cocoon shell, student desktop and teacher/admin CI Summary

All roles now share one Cocoon shell. Desktop (≥1024px) has a top header with the logo, role nav and bell, plus a 2px divider. Below that the 260928-iwi mobile shell and bottom tab bar are unchanged.

Other changes:

- **Auth:** sign-in, sign-up and OTP follow the `design/mac/login*.png` 2-column layout. There is a new custom Clerk sign-up (Google, or display name + email, then a 6-box OTP, then `/onboarding`).
- **Student:** the student screens match `home*.png`: a horizontal node path, status icons and rings, and the new detail step. The upload, submitted and rejected screens use 2 columns, and the reviewer comment is shown read-only.
- **Teacher/admin:** every teacher and admin screen uses the same card, button and segmented-tab language. There is no sidebar any more.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | e85c51e | feat(quick-260928-jkg): Cocoon CI tokens, role-aware shell and desktop auth |
| 2 (RED) | 28aeb8d | test(quick-260928-jkg): add failing tests for parseDeliverables |
| 2 (GREEN) | 84d12c0 | feat(quick-260928-jkg): implement parseDeliverables for สิ่งที่ต้องส่ง |
| 2 | 706ce84 | feat(quick-260928-jkg): student desktop path, status nodes and to-do states |
| 3 | 3d3ea6a | feat(quick-260928-jkg): teacher and admin screens in the Cocoon language |

## Verification (run in this worktree)

- `npx tsc --noEmit`: clean. A stale `.next/dev/types` entry for the deleted preview route had to be cleared first; `.next` is gitignored.
- `npm test` (vitest run): 5 files, 58 tests passed. That includes 7 new `parseDeliverables` tests; RED was confirmed failing before GREEN.
- `npx eslint .`: 10 errors, 16 warnings. The errors are the unchanged pre-existing baseline; warnings went down from 20.
- `npm run build` (Next 16.3.5 Turbopack): compiled; TypeScript OK; 16/16 static pages. `/teacher/review` and `/teacher/profile` are listed.
- `grep -rn "StudentShell|AppSidebar|SidebarProvider" src/app`: no matches.
- `src/app/preview-jkg` is absent and `src/middleware.ts` is identical to 6ca2b6a. Neither was ever committed.
- No changes to `src/server/actions/**`, `src/db/**`, `package.json` or `package-lock.json`. `submission.ts` only gained `reviewerComment`.
- My dev server (port 3100) was stopped. The main checkout's server on port 3000 was not touched.

## Screenshot comparison (headless Chrome via CDP; mock data through a temporary preview route)

Desktop 1280×832 vs `design/mac`:

- **Auth**
  - login: card x676..1184 y171..735 matches; controls are within ~5px; the hero title and blue bar line up.
  - sign-up (login-1): matches after spacing tuning.
  - OTP empty and filled (login-2/3): layout matches. The design has 4 boxes; we render 6 at 64×80 (locked decision).
- **Header** (home.png / home-13): the logo artwork lands at x84 y25. The logo PNG carries its own padding, so it renders at its natural 176×82 from x64 y16. Nav links and bell are in place.
- **Student home**
  - home, home-5, home-6, home-10: the stepper, title, 3 nodes with + / → connectors and the hint text match, with node centres within ~20px.
  - Rings: orange/blue ≈105°, yellow 180°, full green.
  - Icons: magnifier composite; the hand and target are inline SVG approximations.
- **To-do screens**
  - home-1: detail cards.
  - home-2/3: upload with 0 or 2 files. Files were injected with CDP `setFileInputFiles`.
  - home-4: submitted.
  - home-7: rejected with the yellow reviewer card.
  - home-8: resubmit with the yellow confirm button.
  - home-9: round 2 with "คำแนะนำครั้งก่อน".
  - All of these match in structure, sizes and colours within a few px.
- **Teacher** (no design; checked against the home-11/13 language): dashboard with 0 and 3 classrooms, classroom groups and settings tabs (segmented pill), group editor with phases and to-dos expanded, template picker, read-only group overview, teacher to-do page, admin approvals. All look consistent.

Mobile 402×874 vs iwi refs:

- Login matches ref 01, which is unchanged markup.
- Home matches ref 02. The only difference is the intended status icon/ring logic; the `none` arc still uses c7ea2.svg.
- Upload with files matches ref 03 and the confirm dialog matches ref 04. The shadcn tokens did not change the dialog.
- Pending matches ref 05.
- Bottom tab bar matches ref 06. Teachers get 3 tabs and superadmins 4.
- A pixel diff of the student mobile screens before and after Task 3 shows only antialiasing noise.

Residual differences, all intentional or decor-only:

- Decor shapes are approximately placed (CONTEXT says not to chase pixel-perfect decor).
- The hand and target icons are hand-drawn SVGs.
- The book in the auth hero uses `cbd85.svg`, which has no separate long pencil.
- The trailing → on the desktop path only appears when another line follows. The design shows one after 3 nodes, which implies more to-dos.
- The OTP step shows 6 boxes.

## Deviations from Plan

### Auto-fixed / added

1. **[Rule 3 - Blocking] Worktree behind main.** Fast-forwarded to d2d7b51 at the start. When the orchestrator reported 6ca2b6a, I fast-forwarded again before touching onboarding. Only the onboarding markup was changed; the `useSession` / `session.reload()` / `getToken({ skipCache: true })` logic is untouched, and `auth.ts` is untouched.
2. **[Rule 3] Plan verify commands `cd` into the main checkout.** All checks were run in this worktree instead.
3. **[Rule 1 - Bug] Base UI `nativeButton={false}` console errors** on `DialogTrigger render={<Button …/>}`. These were pre-existing in create-group, assign-student and invite-code. `nativeButton={false}` was removed where the rendered element is a real `<button>`.
4. **[Rule 2] Clerk bot protection.** Added `<div id="clerk-captcha">` inside the custom sign-up form, which Clerk needs for custom sign-up flows.
5. **[Rule 2] Resend while filled.** Login-3 replaces the resend button with ยืนยัน. A small "ส่ง OTP อีกครั้ง" text link keeps resend reachable when all 6 digits are entered.
6. **Presentational split.** `StudentTodoView` now only fetches data, and `StudentTodoScreen` renders plain props, so every to-do state could be screenshotted with mocks. There is no behaviour change.
7. **After a successful submit** the client calls `router.replace('/todo/{id}')` before `refresh()`, which drops `?step=upload` from the URL. The submitted view would show anyway, because latest pending takes priority.
8. **Extra files beyond the plan list:**
   - `src/components/cocoon/illustrations.tsx` (hand and target SVGs).
   - `src/components/cocoon/ui.ts` (shared teacher/admin class tokens).
   - lg padding on the student `tasks`/`deadlines` placeholders and `ComingSoonCard`, so they sit in the desktop column.
9. **Teacher group overview.** It gets a "จัดการ Phase" button linking to the editor; previously there was no path from that page to the editor.
10. **Group editor back label.** It uses the existing `getClassroomById` query for the classroom name. `getGroupById` does not return it, and no query was changed.
11. **Todo edit form helper line.** Added "ขึ้นบรรทัดด้วย “- ” เพื่อเพิ่มรายการใน “สิ่งที่ต้องส่ง”…" so teachers know how deliverables are derived.

### Spec vs visual choices

- "Verification Code" is set in the Thai sans, not League Spartan, to match the PNG.
- The desktop submitted footer text is blue (the PNG shows blue; the plan said muted).
- The approved label is "ผ่านแล้ว" everywhere, including the mobile history. It was "ผ่านการตรวจ".
- The mobile resubmit dropzone label is "เพิ่มไฟล์ฉบับแก้ไข". The confirm button is yellow "ยืนยันส่งอีกครั้ง".

## Deferred Issues (out of scope, pre-existing)

- `SelectValue` in todo-edit-form and inline-add-todo shows the raw value (`group` / `individual`) instead of the Thai label. This is Base UI Select behaviour and needs an items map.
- `student-group-picker.tsx` still uses default shadcn classes. It is not in the plan's file list, and it inherits the new tokens.
- These items carry over from iwi:
  - 10 lint errors in `use-mobile.ts` and `auth.test.ts`.
  - `middleware.ts` → `proxy` deprecation, and Clerk's `createRouteMatcher` deprecation.
  - `getAttachmentDownloadUrl` has no membership check.
  - Row-level node locks are enforced in the UI only.

## Needs manual browser verification

1. **Custom sign-up with a real Clerk instance:**
   - Check whether `first_name` is accepted. If not, the fallback retries without it and sets the name after `setActive`.
   - Check the captcha widget renders in `#clerk-captcha`.
   - Test "อีเมลนี้มีบัญชีแล้ว", a wrong code, resend, and the redirect to `/onboarding`.
   - Test Google sign-up through `/sign-in/sso-callback` to `/onboarding`.
2. **Sign-in:**
   - OTP boxes: autofill (`one-time-code`), paste of the full code, Backspace across boxes, phone vs email wording.
   - Also on iOS Safari.
3. **Teacher and superadmin with real data:**
   - Header and tab active states.
   - Segmented tabs switching.
   - Dialogs: create group, assign student, regenerate invite code.
   - Phase/to-do drag reorder and inline edits.
   - Template apply.
   - Admin approve/reject.
   - `/teacher/profile` sign-out.
4. **Student with real data:**
   - Detail → `?step=upload` → submit → submitted.
   - Rejected state and reviewer comment. Set `status='rejected'` and insert a `comments` row manually until Phase 4 exists.
   - Round-2 "คำแนะนำครั้งก่อน".
   - A locked phase shows the muted notice instead of "เลือกไฟล์".
   - Local "เปิด" preview of selected files. It uses an object URL in a new tab and is revoked after 60s.
5. **Widths of 1024–1279px:** the node path zoom, 2-column grids (they switch to fractional columns below xl), and header nav crowding for superadmin.
6. **Onboarding pending card** inside the auth layout, with a real `teacher_pending` user.

## Known Stubs

- `/teacher/review` shows a ComingSoonCard. This is intentional; Phase 4 will build the review flow.
- `/student/tasks` and `/student/deadlines` are placeholders carried over from iwi.
- The notification bell is a static image, as in iwi.
- The teacher to-do page shows "การตรวจงานจะเปิดให้ใช้ใน Phase ถัดไป" in place of the review cards (Phase 4).

## Self-Check: PASSED

- Commits e85c51e, 28aeb8d, 84d12c0, 706ce84, 3d3ea6a present in `git log 6ca2b6a..HEAD`.
- Key created files present (app-shell, nav-items, cocoon-sign-up, otp-boxes, todo-deliverables, node-path-desktop, todo-detail-view, submission-rejected-view, teacher/review, teacher/profile).
