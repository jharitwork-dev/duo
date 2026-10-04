---
phase: quick-261004-01i
verified: 2026-10-04T04:34:13Z
status: passed
score: 9/9 must-haves verified
---

# Quick Task 261004-01i: Notion-like work page submissions Verification Report

**Task Goal:** Notion-like work page per to-do (rich text, sub-todo checklist, files), autosave + conflict handling,
"ส่งงาน" snapshot, read-only while pending/approved, re-edit after rejected, one shared page per group / per student
for individual, teacher-set file requirement (none/optional/required) incl. multi-group + templates, teacher
read-only views, attachment-URL authorization fix, graceful behaviour without R2.

**Verified:** 2026-10-04T04:34:13Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Student sees one Tiptap work page card with rich text + checklist on `/todo/[id]` | ✓ VERIFIED | `work-page-extensions.ts` registers StarterKit + TaskList/TaskItem + Link + Placeholder; `student-work-page.tsx` (435 lines) renders `WorkPageEditor` + toolbar + checklist chip; `immediatelyRender: false` present in both `work-page-editor.tsx:37` and `work-page-viewer.tsx:21` |
| 2 | Autosave (800ms debounce/blur/pre-submit) + "บันทึกแล้ว · HH:mm" indicator, persists on reload | ✓ VERIFIED | `saveWorkPage(` called from `student-work-page.tsx:132`; server persists `content/updatedAt/updatedBy` in `work-page.ts` saveWorkPage; `getStudentWorkPage` reads it back for reload |
| 3 | Group to-do: shared page, stale save refused with "มีการแก้ไขจาก … เมื่อ …" notice + recoverable draft | ✓ VERIFIED | `isSaveConflict` (any `updatedAt` mismatch) in `src/lib/work-page.ts:247`; `saveWorkPage`/`submitWorkPage` lock the row `FOR UPDATE` (`.for('update')` via `findPage(..., { lock: true })`) and return `conflict` with server content + `updatedByName`; `applyConflict` in `student-work-page.tsx:104` stashes local JSON and shows the Thai notice |
| 4 | Individual to-do: one page per student; never cross-group/cross-student read/write | ✓ VERIFIED | `workPageOwnerKey('individual', g, u) → {groupId, userId}`; partial unique index `work_pages_todo_user_unique`; `resolveStudentTodoAccess` requires group membership, `resolveWorkPageAccess` throws otherwise (confirmed by regression sweep item a in SUMMARY and manually re-traced) |
| 5 | "ส่งงาน" snapshots content+files into pending submission; read-only pending/approved; editable + "ส่งอีกครั้ง" after rejected; history keeps every attempt | ✓ VERIFIED | `submitWorkPage` inserts into `submissions` with `content`/`textContent`, copies `workPageFiles → submissionFiles`; `canEditWorkPage` gates on `latestStatus ∈ {none, rejected}`; UI banner text `ส่งแล้ว รอตรวจ` / `ผ่านแล้ว` / `Phase นี้ยังไม่ปลดล็อค` and `ส่งอีกครั้ง` label all present in `student-work-page.tsx` |
| 6 | Teacher sets none/optional/required (create, multi-group, edit, templates); none hides file section; required blocks ส่งงาน until ≥1 file | ✓ VERIFIED | `fileRequirement` wired through `createTodo`/`updateTodo` (`todo.ts`), `assign-todo-dialog.tsx`, `todo-edit-form.tsx`, `template-structure.ts`/`template.ts`; `canSubmitWorkPage` enforces required→file_required / none→content-only server-side in `submitWorkPage`; `WorkPageFiles` returns `null` when `requirement === 'none'` |
| 7 | Works without R2: text/checklist submit OK; file UI shows "ยังไม่ได้ตั้งค่าที่เก็บไฟล์" | ✓ VERIFIED | `createWorkPageUploadUrl`/`getWorkPageFileUrl` return `actionError(ERR_NO_STORAGE)` when `getR2Config()` is null or presign throws; `submitWorkPage` never calls `presign*` (grep count 0, confirmed); `WorkPageFiles` shows the Thai notice when `!storageReady` |
| 8 | Teacher `/todo/[id]` shows latest submission snapshot read-only + live page "ฉบับล่าสุด (ยังไม่ส่ง)" | ✓ VERIFIED | `getTeacherWorkPageView` queries submissions+pages with real DB joins (no static returns); `TeacherWorkPagePanel` wired into `/todo/[todoId]/page.tsx:126`; placeholder text "การตรวจงานจะเปิดให้ใช้ใน Phase ถัดไป" removed (grep empty) |
| 9 | `getAttachmentDownloadUrl` + every work-page/submission file URL action reject non-editors/non-group-students | ✓ VERIFIED | `getAttachmentDownloadUrl` calls `authorizeTodoViewer(` (todo.ts:297); `getSubmissionFileUrl` calls `authorizeTodoViewer(` + `isInSubmissionScope` (submission.ts); all 6 `work-page.ts` exports call `resolveWorkPageAccess(`/`authorizeTodoViewer(`; static `authz-coverage.test.ts` asserts all of this and passes |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations/2026-10-04-work-pages.ts` | additive/idempotent/transactional migration | ✓ VERIFIED | exists, contains `work_pages_todo_group_unique`; `--dry-run` reproduced live (see below), ends "DRY RUN — rolled back", counts unchanged |
| `src/db/schema/workPages.ts` | `workPages` + `workPageFiles` tables, two partial unique indexes | ✓ VERIFIED | both exported; indexes present in dry-run index listing |
| `src/lib/work-page.ts` | pure helpers (validate/checklist/owner/eligibility/conflict) | ✓ VERIFIED | all 15 required exports present (`validateWorkPageContent`, `checklistProgress`, `workPageOwnerKey`, `canEditWorkPage`, `canSubmitWorkPage`, `isSaveConflict`, `hasPageContent`, `plainTextFromDoc`, `FILE_REQUIREMENTS`, `EMPTY_DOC`, etc.) |
| `src/server/actions/work-page.ts` | saveWorkPage/submitWorkPage/createWorkPageUploadUrl/attachWorkPageFile/removeWorkPageFile/getWorkPageFileUrl | ✓ VERIFIED | all 6 present, all authorize, all enforce canEdit/file gates server-side |
| `src/components/work-page/student-work-page.tsx` | editor+autosave+checklist+files+submit+confirm, ≥150 lines | ✓ VERIFIED | 435 lines, contains all required state machine pieces |
| `src/components/work-page/teacher-work-page-panel.tsx` | read-only snapshot + live page | ✓ VERIFIED | exists, wired into teacher `/todo/[todoId]` route |

### Key Link Verification

gsd-tools `verify key-links` reported false negatives (regex double-escaping in the plan's YAML and multi-path "from" fields it cannot resolve to a single source file) — all 5 links were manually re-verified by direct grep/read against the actual files:

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `student-work-page.tsx` | `saveWorkPage`/`submitWorkPage` | debounced autosave + flush before submit | ✓ WIRED | `saveWorkPage({ todoId, content, baseUpdatedAt: baseRef.current })` (line 132), `submitWorkPage({ todoId, baseUpdatedAt })` (line 247) |
| `work-page.ts` exports | `work-page-access.ts` | resolveWorkPageAccess / authorizeTodoViewer | ✓ WIRED | all 6 exports call one of the two; confirmed by static `authz-coverage.test.ts` which passes |
| `submitWorkPage` | `submissions`+`submission_files` | tx + row lock + snapshot + file copy | ✓ WIRED | `db.transaction` with `findPage(..., { lock: true })` → `.for('update')`; inserts `submissions` row with `content`; copies `workPageFiles` → `submissionFiles` |
| `todo.ts getAttachmentDownloadUrl` | `authorizeTodoViewer` | classroom editor or group student | ✓ WIRED | line 297: `await authorizeTodoViewer(attachment.todoId, userId);` before presign |
| `assign-todo-dialog.tsx` + `todo-edit-form.tsx` | `createTodo`/`updateTodo` fileRequirement | Select none/optional/required | ✓ WIRED | both components set/send `fileRequirement`; `todo.ts` zod schemas accept and persist it |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `student-work-page.tsx` | `page`/`files`/`fileRequirement` | `getStudentWorkPage` (real `db.select`/`db.query` joins, no static returns) | Yes | ✓ FLOWING |
| `teacher-work-page-panel.tsx` | `entries` | `getTeacherWorkPageView` (real joins across `groupMembers`, `submissions`, `workPages`, `workPageFiles`) | Yes | ✓ FLOWING |
| `work-page-files.tsx` | `files` prop | passed down from `getStudentWorkPage` via `student-work-page.tsx`, mutated by real `attachWorkPageFile`/`removeWorkPageFile` round-trips | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tsc clean | `npx tsc --noEmit` | no output (clean) | ✓ PASS |
| eslint baseline unchanged | `npx eslint .` | 10 errors / 5 warnings (matches pre-existing baseline: use-mobile.ts, auth.test.ts, RegisterForm.tsx) | ✓ PASS |
| Full test suite | `npm test` | 13 files / 241 tests, all pass | ✓ PASS |
| Production build | `npm run build` | succeeds, all routes compile incl. `/todo/[todoId]` | ✓ PASS |
| Migration dry-run (DB write forbidden — only `--dry-run` run, no `--apply`) | `npx tsx src/db/migrations/2026-10-04-work-pages.ts --dry-run` | "DRY RUN — rolled back", counts unchanged (todos=18, submissions=0, submission_files=0 before/after), both partial unique indexes listed | ✓ PASS |
| Legacy flow fully removed | `grep -rnE "createSubmission\\b|createSubmissionUploadUrl|TodoSubmitView|dangerouslySetInnerHTML" src/components src/server src/app` | no matches (exit 1) | ✓ PASS |
| `collectFileKeys` includes work-page files for R2 cleanup | manual read of `phase-helpers.ts:133-153` | joins `workPageFiles` ⋈ `workPages` on `todoId`, de-dupes with submission/attachment keys | ✓ PASS |

Note: per the hard rule, the migration was run with `--dry-run` only; `--apply`, `drizzle-kit`, and seeds were never executed against the shared `DATABASE_URL`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUICK-261004-01i | 261004-01i-PLAN.md (Task 1/2/3) | Notion-like work page, autosave+conflict, submit snapshot, file_requirement, teacher views, attachment authz fix, graceful no-R2 | ✓ SATISFIED | All 9 observable truths verified above |

No orphaned requirements found in REQUIREMENTS.md cross-reference (this is a quick-task flow; no `.planning/REQUIREMENTS.md` phase table entry expected beyond the declared ID).

### Anti-Patterns Found

None blocking. Scanned all new/modified work-page files (`work-page.ts`, `work-page-extensions.ts`, `work-page-access.ts`, `queries/work-page.ts`, `actions/work-page.ts`, all `components/work-page/*.tsx`) for TODO/FIXME/placeholder/empty-handler patterns — no matches.

One pre-existing, explicitly out-of-scope placeholder remains in the teacher to-do edit form ("อัปโหลดไฟล์แนบ (จะเปิดใช้งานเมื่อเชื่อมต่อ R2)" — teacher-attachment upload, unrelated to the student work page), documented as a Known Stub in SUMMARY.md and confirmed out of this task's scope.

### Human Verification Required

### 1. Shared group editing + conflict notice (real-time, two accounts)

**Test:** Two students in the same group open the same group to-do, both edit, and save close together.
**Expected:** The second saver sees "มีการแก้ไขจาก {name} เมื่อ {HH:mm} — โหลดฉบับล่าสุดแล้ว", a draft box with their own unsaved text, and both "ใช้ฉบับของฉันแทน" / "ทิ้งฉบับของฉัน" work.
**Why human:** Requires two concurrent real browser sessions; logic is unit-tested (`isSaveConflict`) and traced server-side, but the live UX timing/feel needs a human.

### 2. Reject → resubmit (attempt n+1) end-to-end

**Test:** After a teacher (via Phase 4 review or a manual DB status change) rejects a submission, the student reopens the page.
**Expected:** Page becomes editable again, reviewer note card shows, yellow "ส่งอีกครั้ง" button appears and creates attempt 2 in history.
**Why human:** Phase 4 review UI is out of scope for this task (SUMMARY notes this explicitly); requires either that phase or a manual status flip to exercise end-to-end.

### 3. Mobile layout at 360px (toolbar sticky/scroll, submit bar position)

**Test:** Open the student work page on a 360px-wide viewport.
**Expected:** Toolbar sticks at top of the card and scrolls horizontally; no page overflow; submit bar sits above the bottom tab bar, not under it.
**Why human:** Visual/layout correctness cannot be confirmed by static analysis; SUMMARY documents a deliberate deviation (`sticky` instead of `fixed bottom-0`) that needs an eyeball check.

### Gaps Summary

No gaps found. All 9 must-have truths, all 6 required artifacts, and all 5 key links are verified against the actual codebase (not just SUMMARY claims). Static checks (tsc, eslint baseline, 241 tests, production build, migration dry-run) all reproduce the SUMMARY's claimed results exactly. Server-side enforcement (file_requirement, read-only states, content validation with link-protocol allow-list, access control on every page/file action) is implemented in the server actions and access layer, not just the UI — confirmed by direct code reading, not trusting the SUMMARY narrative. Three items are flagged for human verification because they require live concurrent sessions, the (out-of-scope) Phase 4 review flow, or visual/mobile inspection — none of these block the automated goal-achievement verdict.

---

_Verified: 2026-10-04T04:34:13Z_
_Verifier: Claude (gsd-verifier)_
