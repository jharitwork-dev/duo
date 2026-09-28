---
phase: quick-260928-iwi
plan: 01
subsystem: student-ui, submissions
tags: [cocoon, figma, student, submissions, r2, clerk, node-path]
requires: [2113746 Cocoon tokens/assets/DecorBackground]
provides:
  - StudentShell + BottomTabBar (students only)
  - Custom Clerk sign-in (Google redirect + email/phone OTP) + /sign-in/sso-callback
  - Node-path student home (PhaseStepper + NodePath)
  - Student to-do submission page (upload -> confirm -> pending/approved + history)
  - Submission server layer (createSubmissionUploadUrl, createSubmission, getSubmissionFileUrl)
affects: [src/app/(dashboard)/layout.tsx, src/app/(auth)/*, src/app/(dashboard)/todo/[todoId]/page.tsx, group page]
tech-stack:
  added: []
  patterns:
    - "Server actions return { ok } | { ok:false, error } discriminated unions with Thai messages"
    - "Pure, unit-tested derivation (src/lib/node-path.ts) for rows/locks/current node/default phase"
    - "Presigned R2 PUT from the browser, DB rows written only after all uploads succeed"
key-files:
  created:
    - src/lib/node-path.ts
    - src/lib/__tests__/node-path.test.ts
    - src/server/queries/submission.ts
    - src/server/actions/submission.ts
    - src/components/cocoon/{cocoon-logo,cocoon-header,bottom-tab-bar,student-shell,status-pill,coming-soon-card}.tsx
    - src/components/auth/cocoon-sign-in.tsx
    - src/app/(auth)/sign-in/sso-callback/page.tsx
    - src/app/(dashboard)/student/{tasks,deadlines,profile}/page.tsx
    - src/components/student/{profile-sign-out,phase-stepper,node-path,student-todo-view,todo-submit-view,submission-confirm-dialog,submission-status-view,submission-file-row}.tsx
  modified:
    - src/lib/r2.ts
    - src/lib/format.ts
    - src/lib/__tests__/format.test.ts
    - src/app/(dashboard)/layout.tsx
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - src/app/(dashboard)/student/page.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/page.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/app/(dashboard)/todo/[todoId]/page.tsx
    - src/components/ui/dialog.tsx
decisions:
  - "Upload lock check is phase-level (locked && !isFreeAccess) on the server; row-level node locks are UI-only for now"
  - "Students may only open their own group's node path (redirect otherwise)"
  - "Sign-up prompt placed inside the login card to match ref 01 (spec text said below card)"
metrics:
  duration: ~20 min
  completed: 2026-09-28
  tasks: 3
  files: 34
---

# Quick 260928-iwi Plan 01: Cocoon student UI + file submissions Summary

The student side now uses the Cocoon design: a cream shell with a 4-tab bottom bar, a custom Google + OTP login, a node-path home with a phase stepper and derived to-do locks, and a to-do page with drag-and-drop upload, a confirm dialog, direct upload to R2 and a pending/history view. It all runs on a new, access-checked submission server layer. The teacher and admin UI is unchanged.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 (RED) | 6471ba3 | test(quick-260928-iwi): add failing tests for submission helpers and node-path logic |
| 1 (GREEN) | 145d9b5 | feat(quick-260928-iwi): submission backend and node-path helpers |
| 2 | a93ecd0 | feat(quick-260928-iwi): Cocoon student shell, tab bar and custom login |
| 3 | d523309 | feat(quick-260928-iwi): node-path home and student submission flow |
| polish | 98606bf | fix(quick-260928-iwi): tune node title and status card spacing to match refs at 402px |

## Verification

- `npx tsc --noEmit`: clean.
- `npm test`: 4 files, 51 tests passed. There are 25 new tests covering `formatSubmissionDate` (Bangkok timezone and day rollover), `formatFileSize`, `fileTypeTag`, `validateSubmissionFile`, msword allow-list, `buildNodeRows`, `computeLockedTodoIds`, `pickCurrentTodoId` and `pickDefaultPhaseId`.
- `npm run lint`: 10 errors and 20 warnings, all in files this plan did not touch (baseline before the plan was 10 errors and 23 warnings). The new and modified files produce no lint problems.
- `npm run build` (Next 16.3.5 Turbopack): compiled, 14/14 pages. `/sign-in/sso-callback` builds as its own static route next to `/sign-in/[[...sign-in]]`.
- Dev-server check: `/sign-in`, `/sign-in/sso-callback` and `/sign-up` return 200 and show the expected Cocoon strings.
- Visual check at a true 402px viewport (headless Chrome with CDP device emulation; mock data through a temporary preview route that was deleted and never committed):
  - Login matches ref 01. The card spans y 228–585, which is Figma 278–635 minus the 50px status bar.
  - Node-path home matches ref 02.
  - Upload matches ref 03, the confirm dialog matches ref 04 and the pending view matches ref 05.
  - At 900px the layout is a centred column with the floating pill tab bar.
- Invariants: no changes to `src/app/(dashboard)/teacher/**`, `app-sidebar.tsx`, `package.json` or `package-lock.json`. `group-phase-view.tsx` is kept (teachers still use it). No Figma MCP calls, no DB migrations.

## Deviations from Plan

### Auto-fixed / added

1. **[Rule 3 - Blocking] Worktree was behind the plan commit.** The worktree branch was at 124920e, which does not have the Cocoon tokens, assets or plan (2113746, 115d7ba). I fast-forwarded it to 115d7ba before starting.
2. **[Rule 3 - Blocking] Turbopack rejects a symlinked `node_modules`** ("points out of the filesystem root"). I replaced the symlink with an APFS clone (`cp -Rc`) of the main checkout's `node_modules`. It is gitignored.
3. **[Rule 2 - Security] Student group page membership check.** `getGroupById` only checks classroom membership. Students who are not members of the group are now redirected to `/student` instead of seeing another group's path.
4. **[Rule 2 - Correctness] MIME inference for empty `File.type`.** Some OSes report an empty type for .doc/.docx, so the client infers it from the file extension before validating, presigning and uploading.
5. **[Rule 2] Teacher notes kept for students.** The old student to-do page showed teacher notes, description and attachments. The new view keeps them in one "รายละเอียดจากครู" card, shown only when there is content, instead of an attachments-only card.
6. **[Rule 2] Locked-phase state on the to-do page.** If the phase is locked and not free access, students see a "Phase นี้ยังไม่ปลดล็อค" card instead of the dropzone, because the server would reject the upload anyway.
7. **[Rule 2] Attachment props trimmed.** Only `id/fileName/contentType/fileSize` are passed to the client `TodoAttachmentsList`, so R2 keys are not serialized to the browser.
8. **Extra shared piece:** `src/components/cocoon/coming-soon-card.tsx`, reused by the tasks and deadlines placeholders. The student to-do branch lives in `src/components/student/student-todo-view.tsx` (server component) to keep the teacher render in `todo/[todoId]/page.tsx` byte-for-byte the same.

### Spec vs ref choices

- **Sign-up prompt:** "ยังไม่มีบัญชี ? สมัครสมาชิก" is inside the login card, matching ref 01. The spec text said below the card.
- **Stepper gutter:** `mx-[33px]` instead of `mx-[23px]`. Ref 02 circles span x 33–369.
- **Node-path top margin:** `mt-6` instead of `mt-[38px]`, from Figma y 290−50 = 240 vs the title bottom at 216. Verified against ref 02.
- **Node titles:** `px-1.5 tracking-tight` so "Competitor Analysis" fits on one line as in ref 02.
- **Connector geometry:** follows the plan formula (regular 264px pitch, junction = gap midpoint + 10). The Figma pair→single spacing is slightly irregular. The result is symmetric and visually equivalent.

## Deferred Issues (out of scope, pre-existing)

- 10 lint errors in `src/hooks/use-mobile.ts` (set-state-in-effect) and `src/lib/__tests__/auth.test.ts` (no-explicit-any).
- `getAttachmentDownloadUrl` in `src/server/actions/todo.ts` has no classroom-membership check. Any signed-in user with an attachment id can presign it.
- Server-side upload gating is phase-level only. Row-level node locks, where a later row unlocks once earlier rows have submissions, are enforced in the UI but not in `createSubmissionUploadUrl`/`createSubmission`. Revisit alongside the Phase 4 `approved` rule; there is a `TODO(Phase 4)` in `node-path.ts`.
- Orphaned R2 objects are possible if a multi-file upload fails partway or `createSubmission` rejects after the PUTs.
- Next 16 warns that `middleware.ts` is deprecated in favour of `proxy`, and Clerk warns that `createRouteMatcher` is deprecated.

## Needs manual browser verification

1. **R2 bucket CORS.** This is the first browser→R2 presigned PUT in the app; teacher attachments do not use `presignPut` anywhere. The bucket CORS must allow `PUT` with the `content-type` header from `build.innovators.co.th` and localhost, or uploads will fail with "อัปโหลดไม่สำเร็จ".
2. **Google sign-in round trip** through `/sign-in/sso-callback` to `/`, which then redirects by role. Also check a brand-new Google account, which Clerk turns into a sign-up and should land on `/onboarding`.
3. **Email OTP and Thai phone OTP** (08x… → +668x…) with a real inbox and phone, including wrong code, resend and "เปลี่ยนอีเมล/เบอร์".
4. **Authenticated student pages with real data:**
   - Node locks and statuses after a submission, `?phase=` switching, tab-bar active states.
   - Profile sign-out.
   - A rejected submission re-opening the upload view (requires setting `status='rejected'` manually until Phase 4 review exists).
5. **Teacher sanity check:** the teacher group page and teacher to-do page look unchanged, and other dialogs keep the default overlay.
6. **iOS safe-area insets** (notch and home indicator) on a real device.

## Known Stubs

- `/student/tasks` and `/student/deadlines` show "เร็ว ๆ นี้" placeholder cards (intentional per CONTEXT: placeholder tabs).
- The notification bell is a static image (behaviour out of scope per CONTEXT).

## Self-Check: PASSED

- Files: all key created files present (verified with `git show --stat` across 6471ba3..98606bf).
- Commits: 6471ba3, 145d9b5, a93ecd0, d523309, 98606bf all present in `git log`.
