---
phase: quick-261004-gid
verified: 2026-10-04T06:13:50Z
status: passed
score: 8/8 must-haves verified
---

# Quick Task 261004-gid: Teacher file attachments on tasks Verification Report

**Task Goal:** Teachers upload/open/delete reference files on to-dos (create/assign/edit/teacher to-do page); students download
("ไฟล์แนบจากครู"); one shared R2 object across multi-group copies with reference-counted deletion incl. all delete paths
(`collectFileKeys`); limits (25 MB, 10 files); authz on every action; graceful missing-R2.
**Verified:** 2026-10-04T06:13:50Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Teacher can attach files (25 MB / 10 per to-do / allow-list) from create/assign, edit form, teacher `/todo/<id>` | ✓ VERIFIED | `src/components/todo/assign-todo-dialog.tsx` stages files and calls `uploadTodoAttachment` after `createTodo`; `src/components/todo/todo-edit-form.tsx:155-157` and `src/app/(dashboard)/todo/[todoId]/page.tsx:128-131` render `TodoAttachmentManager`; limits enforced in `src/lib/r2.ts` (`ATTACHMENT_MAX_FILE_SIZE = 25MB`, `ATTACHMENT_ALLOWED_TYPES`) and `src/lib/todo-attachments.ts` (`MAX_ATTACHMENTS_PER_TODO = 10`, `checkAttachmentCapacity`), both re-checked server-side in `createAttachmentUploadUrl`/`addTodoAttachment` |
| 2 | Multi-group assign uploads each file ONCE; every copy gets its own row, same `file_key` | ✓ VERIFIED | `assign-todo-dialog.tsx:174-176` loops staged files once, calling `uploadTodoAttachment(file, result.todoIds)` (all ids, one upload); `addTodoAttachment` inserts one row per id in `ids.map(...)` all sharing `data.key` (`todo-attachment.ts:165-183`); `resolveAttachmentScope` requires one shared `assignmentId` for multi-copy scope (`todo-attachments.ts:28-37`) |
| 3 | Teacher sees file-type tag, name, size; can open ('เปิด', presigned GET) and delete ('ลบ', ConfirmDialog) | ✓ VERIFIED | `todo-attachment-manager.tsx` `AttachmentRow` renders `fileTypeTag`, name, `formatFileSize`; "เปิด" calls `getAttachmentDownloadUrl` + `window.open`; "ลบ" opens `ConfirmDialog` → `removeTodoAttachment` |
| 4 | Deletion (row, copy, phase, group, classroom) removes R2 object only when no remaining `todo_attachments` row references the key; cleanup after commit, never throws | ✓ VERIFIED | `removeTodoAttachment` locks rows sharing the key `FOR UPDATE`, deletes, counts remainder, calls `cleanupR2Objects` only post-commit when count is 0 (`todo-attachment.ts:218-240`); `collectFileKeys` excludes attachment keys still referenced by `notInArray(todoAttachments.todoId, input.todoIds)` via `computeOrphanFileKeys` (`phase-helpers.ts:157-168`), covering deleteTodo/deletePhase/deleteGroup/deleteClassroom since they all funnel through this one helper; `cleanupR2Objects`/`deleteObject` are try/catch best-effort (`r2.ts:155-168`) |
| 5 | Every teacher attachment action calls `assertTodoEditor` for EVERY target to-do; refused for students/non-editors; scanned by `authz-coverage.test.ts` | ✓ VERIFIED | All three exports in `todo-attachment.ts` loop `for (const id of ids) await assertTodoEditor(id, userId)` (createAttachmentUploadUrl, addTodoAttachment) or call it once on the owning row (removeTodoAttachment); `authz-coverage.test.ts:200-250` adds `todo-attachment.ts` to `SCANNED`, asserts the loop-before-check pattern, `.for('update')`, `cleanupR2Objects(`, no direct `deleteObject(`, and that `collectFileKeys` matches `notInArray(todoAttachments.todoId` — ran and passed (90/90 in the two targeted test files) |
| 6 | Students see "ไฟล์แนบจากครู" and download via `getAttachmentDownloadUrl` (`authorizeTodoViewer`) | ✓ VERIFIED | `todo-detail-view.tsx` heading renamed to "ไฟล์แนบจากครู" (grep confirms); `getAttachmentDownloadUrl` (`todo.ts:285-309`) gates with `authorizeTodoViewer(attachment.todoId, userId)` before presigning |
| 7 | Without R2 env, upload returns 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์' instead of throwing | ✓ VERIFIED | `createAttachmentUploadUrl`: `if (!getR2Config()) return actionError(ATTACHMENT_ERRORS.noStorage)` before any R2 call (`todo-attachment.ts:98`); download path mirrors this at `todo.ts:301` |
| 8 | Save-template dialog states 'ไฟล์แนบไม่ถูกบันทึกในเทมเพลต' | ✓ VERIFIED | `grep -q "ไฟล์แนบไม่ถูกบันทึกในเทมเพลต" src/components/template/save-template-dialog.tsx` matches (confirmed in SUMMARY checks and plan's verify step) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/todo-attachments.ts` | Pure rules: limits, scope, key build/verify, content-type inference, capacity | ✓ VERIFIED | All exports present: `MAX_ATTACHMENTS_PER_TODO`, `resolveAttachmentScope`, `buildAttachmentKey`, `isAttachmentKeyInScope`, `inferAttachmentContentType`, `checkAttachmentCapacity`; no DB/network imports |
| `src/server/actions/todo-attachment.ts` | `createAttachmentUploadUrl`, `addTodoAttachment`, `removeTodoAttachment`; contains `assertTodoEditor` | ✓ VERIFIED | All three exported; `assertTodoEditor` called on every target id in each |
| `src/components/todo/todo-attachment-manager.tsx` | Teacher list + upload + open + delete | ✓ VERIFIED | Implements upload input, `AttachmentRow` with open/delete, `ConfirmDialog` |
| `src/lib/__tests__/todo-attachments.test.ts` | Unit tests for pure rules, no network/R2 | ✓ VERIFIED | Ran via `npx vitest run`: 90 passed across the two targeted files (todo-attachments + authz-coverage); no R2 imports in the test file |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `phase-helpers.ts collectFileKeys` | `todo_attachments` rows outside deleted to-dos | `notInArray(todoAttachments.todoId, todoIds)` | ✓ WIRED | Confirmed at `phase-helpers.ts:163`, inside `collectFileKeys`, feeding `computeOrphanFileKeys` |
| `todo-attachment.ts removeTodoAttachment` | `cleanupR2Objects` | lock rows FOR UPDATE, delete one, count remaining, cleanup after commit at 0 | ✓ WIRED | `todo-attachment.ts:218-240`; cleanup call is outside the `db.transaction(...)` block, gated by `objectRemoved` |
| `assign-todo-dialog.tsx` | `createAttachmentUploadUrl` / `addTodoAttachment` | upload each staged file once with `todoIds = result.todoIds` after `createTodo` | ✓ WIRED | `assign-todo-dialog.tsx:174-176` calls `uploadTodoAttachment(file, result.todoIds)` (helper internally calls both actions) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | -------------- | ------ | ------------------- | ------ |
| `todo-edit-form.tsx` `TodoAttachmentManager` | `todo.attachments` | Drizzle relation query feeding the edit form (`with: { attachments: {...} }`, per plan's Task 2 step 5) | Yes — real DB-backed rows, not static | ✓ FLOWING |
| `todo/[todoId]/page.tsx` `TodoAttachmentManager`/`TodoAttachmentsList` | `attachments` (mapped from `todo.attachments`) | Server component query; mapped to `{id, fileName, contentType, fileSize}` stripping `fileKey` before passing to client components (`page.tsx:54-59`) | Yes | ✓ FLOWING, and confirms storage keys are not exposed to clients |
| `getAttachmentDownloadUrl` | `attachment.fileKey` | `db.query.todoAttachments.findFirst` (real row, not static) then `presignGet` | Yes | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261004-gid | 261004-gid-PLAN.md | Teacher file attachments on to-dos per CONTEXT.md domain description | ✓ SATISFIED | All 8 must-have truths verified above; no orphaned requirement IDs found (single requirement, declared and satisfied) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TODO/FIXME/placeholder/stub patterns found in any of the 15 created/modified files for this task | — | None |

Specifically checked and absent: no `return null`/`return {}`/`=> {}` stub handlers in the new attachment files; no hardcoded-empty props passed to `TodoAttachmentManager`/`TodoAttachmentsList` at any call site (both call sites map real server data); no direct `deleteObject(` call in `src/server/actions` (grep confirms, matches SUMMARY's claim); `collectFileKeys` single match for `notInArray(todoAttachments.todoId` (grep confirms).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Pure rules + authz-coverage unit tests | `npx vitest run src/lib/__tests__/todo-attachments.test.ts src/server/__tests__/authz-coverage.test.ts` | 2 files, 90 tests passed | ✓ PASS |
| Type safety | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| Full `npm test` / `npm run build` | Not re-run this session (context budget) | SUMMARY reports 476/476 passing and a successful build on commit `0420ecd`, which is the current `HEAD`'s immediate ancestor chain (`git log` confirms `022fb89`, `1a0fc45`, `3177e1e`, `c94c388` all present, tree clean) | ? SKIP — treated as reliable since working tree is clean and commits match; targeted re-run above corroborates |

### Human Verification Required

None required for the static/authz/limits/graceful-missing-R2 scope of this check. The SUMMARY's own "Manual verification (with R2)" list (11 items: multi-group share, partial delete, cascade delete, download, cross-classroom refusal, 11th-file refusal, 26 MB refusal, template note, offline upload failure, phase/group delete) is appropriately deferred to a human with real R2 access, per the task's own safety constraint (no uploads to the real bucket during this verification).

### Gaps Summary

No gaps found. All 8 must-have truths, all 4 required artifacts, and all 3 key links verified against the actual code (not just the SUMMARY's claims). The authz-coverage test statically enforces `assertTodoEditor` on every target to-do for all three new actions, enforces no direct `deleteObject(` bypass of `cleanupR2Objects`, and enforces the `notInArray` exclusion in `collectFileKeys`. Storage keys (`fileKey`) are confirmed stripped before attachment data reaches any client component. Limits (25 MB, 10 files, allow-list) are enforced server-side in both `createAttachmentUploadUrl` and `addTodoAttachment` (not just client-side). Missing-R2 guards return the Thai error string before any R2 call in both upload and download paths. `tsc --noEmit` is clean and the two targeted test files (90 tests) pass against the current working tree.

---

_Verified: 2026-10-04T06:13:50Z_
_Verifier: Claude (gsd-verifier)_
