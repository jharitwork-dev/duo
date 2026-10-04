# Quick Task 261004-gid: Teacher file attachments on tasks - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning. Run after 261004-gic (review) is merged. Independent of it functionally, but it edits the teacher to-do
forms that earlier tasks touch.

<domain>
## Task Boundary

The user (Thai): "ครูยังแนบไฟล์ไม่ได้ด้วยใช่ไหม". The `todo_attachments` table, `attachmentKey()` in `src/lib/r2.ts`, the student-facing
`TodoAttachmentsList` and `getAttachmentDownloadUrl` (already authorized via `authorizeTodoViewer` in 01i) exist, but there is NO upload path.
Teachers must be able to attach reference files (examples, forms, briefs) to a to-do.

- **Upload:** in the teacher to-do create dialog (incl. multi-group assign: the same file is attached to every copy, sharing ONE R2 object
  per upload via the same `file_key`, so deleting one copy's attachment row must not delete the object while other rows reference it)
  and in the to-do edit form. Flow: `createAttachmentUploadUrl({ todoId | assignment, fileName, contentType, size })` returns a presigned PUT;
  the browser uploads; `addTodoAttachment({ todoIds, key, fileName, contentType, size })` inserts the rows. Limits: 25 MB per file, max 10
  files per to-do, using the R2 allow-list (add common office/image types; include `application/msword`).
- **Manage:** list with file icon/name/size and "เปิด" (presigned GET) plus "ลบ" (ConfirmDialog). R2 object deletion is best-effort after
  commit and only when no remaining row references the key (`src/lib/r2-cleanup.ts`).
- **Student view:** the existing "ไฟล์แนบจากครู" list on the to-do detail/work page (rename to that label if needed), downloads via
  `getAttachmentDownloadUrl`.
- **Templates:** out of scope (files are not copied into templates; the template save shows a note "ไฟล์แนบไม่ถูกบันทึกในเทมเพลต").
- **Cleanup:** when a to-do, phase, group or classroom is deleted (02p `collectFileKeys`), include attachment keys, respecting shared keys.
- Authorization: teacher actions via `assertTodoEditor` (all target to-dos); add the new action file to `authz-coverage.test.ts`.
- Graceful when R2 env is missing: "ยังไม่ได้ตั้งค่าที่เก็บไฟล์" (R2 IS configured now, but keep the behaviour).

No schema change expected (`todo_attachments` exists). If an index on `file_key` is needed for reference counting, use an additive script
with --dry-run/--apply.
</domain>

<decisions>
## Implementation Decisions
- Teachers attach files to to-dos; students download them. A shared upload across multi-group copies uses one object with reference-counted deletion.

### Claude's Discretion
- UI details (drop zone vs button), exact limits within reason.
</decisions>
