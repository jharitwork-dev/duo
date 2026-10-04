---
phase: quick-261004-gid
plan: 01
subsystem: todo-attachments
tags: [r2, attachments, authz, teacher-ui]
requires: [261004-03i, 261004-gic]
provides:
  - teacher upload/manage of to-do attachments (create/assign dialog, edit form, /todo/<id>)
  - shared-object attachments across multi-group copies with reference-counted R2 deletion
affects:
  - src/server/phase-helpers.ts collectFileKeys (all 02p delete paths)
tech-stack:
  added: []
  patterns: [presigned PUT then attach, FOR UPDATE ref-count before after-commit cleanup]
key-files:
  created:
    - src/lib/todo-attachments.ts
    - src/lib/__tests__/todo-attachments.test.ts
    - src/server/actions/todo-attachment.ts
    - src/components/todo/upload-todo-attachment.ts
    - src/components/todo/todo-attachment-manager.tsx
    - src/components/todo/staged-attachment-picker.tsx
  modified:
    - src/lib/r2.ts
    - src/server/actions/todo.ts
    - src/server/phase-helpers.ts
    - src/server/__tests__/authz-coverage.test.ts
    - src/server/queries/phase.ts
    - src/components/todo/assign-todo-dialog.tsx
    - src/components/todo/todo-edit-form.tsx
    - src/components/todo/todo-attachments-list.tsx
    - src/app/(dashboard)/todo/[todoId]/page.tsx
    - src/components/student/todo-detail-view.tsx
    - src/components/template/save-template-dialog.tsx
decisions:
  - "Key scope = to-do id (single) or shared assignmentId (copies); attachments/{scope}/{uploadId}-{safeName}"
  - "Create dialog stages files client-side and uploads after createTodo returns ids (no orphan objects on cancel)"
  - "A key can be attached only once (addTodoAttachment rejects an existing file_key)"
  - "No index on todo_attachments.file_key (scale < 100 users); no schema change"
metrics:
  completed: 2026-10-04
  tasks: 3
---

# Quick 261004-gid Plan 01: Teacher file attachments on tasks Summary

Teachers can now attach reference files to to-dos: up to 25 MB each and 10 per to-do, using the R2 allow-list plus xls/ppt/gif/txt/csv. Files can be added from the assign dialog, the edit form and the teacher `/todo/<id>` page. When a to-do is assigned to several groups, all copies share one R2 object. That object is deleted only after the last row that points to it is gone. Students see the files under "ไฟล์แนบจากครู".

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 (RED) | c94c388 | Tests for the pure attachment rules, written first and failing |
| 1 (GREEN) | 3177e1e | Rules module, r2 additions, `todo-attachment.ts` actions, `collectFileKeys` keeps keys still in use by other copies, download storage guard, authz coverage |
| 2 | 1a0fc45 | Upload helper, TodoAttachmentManager, StagedAttachmentPicker, assign dialog, edit form, teacher to-do page, `getActivePhases` attachment metadata |
| 3 | 022fb89 | Student label "ไฟล์แนบจากครู", visible "ดาวน์โหลด" button, template note |

## Checks (actual results)

- `npx tsc --noEmit`: clean
- `npx eslint src`: 10 errors, 5 warnings. This matches the baseline recorded before work began. All of them are in files this task did not touch (`create-classroom-form.tsx`, `invite-code-display.tsx`, `use-mobile.ts`, `auth.test.ts`).
- `npm test`: 476 passed in 20 files (baseline 446 in 19 files). The new tests are 19 in `todo-attachments.test.ts` and 11 in `authz-coverage.test.ts`.
- `npm run build`: succeeded
- Grep checks: there are no direct `deleteObject(` calls in `src/server/actions`, and `notInArray(todoAttachments.todoId` matches once in `phase-helpers.ts`.
- Safety: tests call no R2 functions and make no network calls. Nothing was written to the DB, no migration or drizzle-kit command was run, and nothing was uploaded to the real bucket.

## How it works

- **Upload:** `createAttachmentUploadUrl` checks that the user is a teacher and runs `assertTodoEditor` on every target to-do. It then checks that R2 is configured, the file is valid, the scope resolves and there is room for another file, and returns a presigned PUT. The browser uploads the file. `addTodoAttachment` repeats the checks, verifies the key belongs to the scope, and locks the target to-dos with `FOR UPDATE`. It rejects a key that is already attached, rechecks the 10-file limit, and inserts one row per to-do, all with the same `file_key`.
- **Remove:** `removeTodoAttachment` locks every row that uses the key with `FOR UPDATE`, deletes this copy's row and counts the rows left. If none are left, it calls `cleanupR2Objects` after the commit. That call is best-effort and never throws.
- **Delete to-do, phase, group or classroom:** `collectFileKeys` skips any attachment key still used by a `todo_attachments` row outside the to-dos being deleted. The callers needed no changes.
- **R2 not configured:** upload and download return 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์' instead of throwing.

## Deviations from Plan

1. **[Rule 2 - Correctness]** `inferAttachmentContentType` also falls back to the file extension when the browser reports the generic `application/octet-stream`. Some operating systems report that type for docx and xlsx files, which would otherwise be rejected.
2. **[Rule 2 - Security]** On the teacher `/todo/<id>` page, the attachment rows are cut down to `{id, fileName, contentType, fileSize}` before they are passed to client components, so R2 file keys never reach the browser. The manager only appears when the viewer is a classroom editor (the `workView` gate), so teachers who are not editors still see the read-only list.
3. **[Rule 2 - Correctness]** Authorization failures in the attachment actions return a Thai `ActionResult` error ('ไม่มีสิทธิ์แก้ไขงานนี้') instead of throwing. The `assertTodoEditor` calls are unchanged. `addTodoAttachment` also rejects a `file_key` that is already attached, which the plan specified.
4. **Ordering:** `formatFileSize` was exported in Task 2 rather than Task 3, so the new components could use it from the start without a duplicate copy.
5. **Not applied:** for the student download toast, the server's expected errors were already shown through `result.error`. Showing thrown error messages as well was tried and then reverted, because Next.js masks those messages in production.
6. **No edit needed:** `todo-item.tsx`. Its `Todo` type is inferred from `getActivePhases`, so the new `attachments` field passes through on its own.
7. There is only one save-as-template entry point (`save-template-dialog.tsx`), so the note was added only there.

## Known Stubs

None.

## Manual verification (with R2, by the user. Do not run against the production bucket from a dev machine unless that is intended.)

1. As a teacher, open the assign dialog, tick 2 groups, add a PDF under "ไฟล์แนบจากครู (ไม่บังคับ)" and create the to-do. The edit form of both copies lists the file with type tag, name and size.
2. On copy A, click "ลบ" and confirm. The file disappears from copy A only. On copy B, "เปิด" still opens it.
3. Delete copy B's to-do. The R2 object `attachments/<assignmentId>/...` is now gone from the bucket.
4. Attach a file to a single to-do from the edit form, and again from `/todo/<id>` (teacher). The count shows n/10, and the "กำลังอัปโหลด…" row appears and then clears.
5. As a student of that group, open the to-do. "ไฟล์แนบจากครู" lists the file, and "ดาวน์โหลด" downloads it.
6. A student of another classroom who requests the download is refused.
7. Try to attach an 11th file. It is refused with 'แนบได้สูงสุด 10 ไฟล์ต่องาน', and the button is disabled at 10/10.
8. Try a 26 MB file, or a .exe. It is refused with 'ไฟล์ต้องเป็นชนิดที่รองรับ และไม่เกิน 25 MB' before any upload starts.
9. Open the "บันทึกเป็นเทมเพลต" dialog. It shows "ไฟล์แนบไม่ถูกบันทึกในเทมเพลต".
10. Assign a to-do with a staged file while the upload fails (for example, offline). The to-do is still created, and the toast reads "สร้างงานแล้ว แต่แนบไฟล์ไม่สำเร็จ 1 ไฟล์".
11. Delete a whole phase or group that contains one copy of a multi-group to-do with an attachment. The other copies still open the file.

Note: the browser PUT needs bucket CORS to allow PUT from the site origin. Work-page uploads already rely on this, so it should already be configured.

## Self-Check: PASSED

- All created files exist on disk.
- Commits c94c388, 3177e1e, 1a0fc45 and 022fb89 are present in `git log`.
