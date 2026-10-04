---
phase: quick-261004-gid
plan: 01
type: execute
wave: 1
depends_on: [261004-03i, 261004-gic]
files_modified:
  # Task 1: server, rules, cleanup, tests
  - src/lib/r2.ts
  - src/lib/todo-attachments.ts
  - src/lib/__tests__/todo-attachments.test.ts
  - src/server/actions/todo-attachment.ts
  - src/server/actions/todo.ts
  - src/server/phase-helpers.ts
  - src/server/__tests__/authz-coverage.test.ts
  # Task 2: teacher UI
  - src/components/todo/upload-todo-attachment.ts
  - src/components/todo/todo-attachment-manager.tsx
  - src/components/todo/staged-attachment-picker.tsx
  - src/components/todo/assign-todo-dialog.tsx
  - src/components/todo/todo-edit-form.tsx
  - src/components/todo/todo-item.tsx
  - src/app/(dashboard)/todo/[todoId]/page.tsx
  - src/server/queries/phase.ts   # or whichever query feeds TodoItem (see Task 2)
  # Task 3: student polish, template note, regression
  - src/components/todo/todo-attachments-list.tsx
  - src/components/student/todo-detail-view.tsx
  - src/components/template/save-template-dialog.tsx
autonomous: true
requirements: [QUICK-261004-gid]

must_haves:
  truths:
    - "A teacher can attach files (max 25 MB each, max 10 per to-do, R2 allow-list plus common office/image types) while creating a to-do (including multi-group assign) and from the to-do edit form and the teacher /todo/<id> page"
    - "A multi-group assign uploads each file ONCE: every copy gets its own todo_attachments row and all rows share the same file_key"
    - "The teacher sees each attachment with file-type tag, name and size, can open it ('เปิด', presigned GET) and delete it ('ลบ', ConfirmDialog)"
    - "Deleting one copy's attachment row, or deleting one copy (to-do), phase, group or classroom, removes the R2 object only when no remaining todo_attachments row references its key; cleanup runs after commit and never throws"
    - "Every teacher attachment action calls assertTodoEditor for EVERY target to-do; students and non-editors are refused; todo-attachment.ts is scanned by authz-coverage.test.ts"
    - "Students see 'ไฟล์แนบจากครู' on the to-do page and download via getAttachmentDownloadUrl (authorizeTodoViewer)"
    - "Without R2 env the upload path returns 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์' instead of throwing"
    - "The save-template dialog states 'ไฟล์แนบไม่ถูกบันทึกในเทมเพลต'"
  artifacts:
    - path: "src/lib/todo-attachments.ts"
      provides: "Pure rules: limits, scope, key build/verify, content-type inference, capacity, orphan keys"
      exports: ["MAX_ATTACHMENTS_PER_TODO", "resolveAttachmentScope", "buildAttachmentKey", "isAttachmentKeyInScope", "inferAttachmentContentType", "checkAttachmentCapacity"]
    - path: "src/server/actions/todo-attachment.ts"
      provides: "createAttachmentUploadUrl, addTodoAttachment, removeTodoAttachment"
      contains: "assertTodoEditor"
    - path: "src/components/todo/todo-attachment-manager.tsx"
      provides: "Teacher list + upload + open + delete"
    - path: "src/lib/__tests__/todo-attachments.test.ts"
      provides: "Unit tests for the pure rules (no network, no R2)"
  key_links:
    - from: "src/server/phase-helpers.ts collectFileKeys"
      to: "todo_attachments rows OUTSIDE the deleted to-dos"
      via: "exclude attachment keys still referenced by notInArray(todoAttachments.todoId, todoIds)"
      pattern: "notInArray\\(todoAttachments\\.todoId"
    - from: "src/server/actions/todo-attachment.ts removeTodoAttachment"
      to: "cleanupR2Objects"
      via: "lock all rows with the key FOR UPDATE, delete one, count remaining; clean up after commit only at 0"
      pattern: "cleanupR2Objects"
    - from: "src/components/todo/assign-todo-dialog.tsx"
      to: "createAttachmentUploadUrl / addTodoAttachment"
      via: "after createTodo returns todoIds, uploads each staged file once with todoIds = result.todoIds"
      pattern: "uploadTodoAttachment"
---

<objective>
Teachers can attach reference files (examples, forms, briefs) to to-dos, manage them, and students can download them. A multi-group
assign shares one R2 object across all copies. R2 deletion is reference-counted, so removing one copy never breaks another copy.

Purpose: "ครูยังแนบไฟล์ไม่ได้ด้วยใช่ไหม". The table, key helper, student list and download action already exist, but there is no
upload path.
Output: a pure rules module plus tests, a new server action file, a shared-key-safe `collectFileKeys`, the teacher upload/manage UI, and
student label polish.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/261004-gid-teacher-file-attachments-on-tasks/261004-gid-CONTEXT.md
@.planning/quick/261004-03i-clear-deadlines-with-overdue-and-late-su/261004-03i-HANDOFF.md

<preconditions>
- Run this ONLY after 261004-03i (all 3 tasks) and 261004-gic are merged. First run `git log --oneline -15` and confirm their final
  commits are present. If they are missing, STOP and report.
- 03i Task 3 rewrites the deadline UI in `todo-edit-form.tsx` (DeadlineInput date+time replaces the Popover/Calendar block),
  `assign-todo-dialog.tsx` (adds a deadline to the `createTodo` call), `todo-item.tsx`, `todo/[todoId]/page.tsx` and `actions/todo.ts`.
  Re-read those files from disk before editing. Make your edits ADDITIVE: put new blocks in their own JSX section, do not move, reformat
  or re-type any deadline code, and keep every field that the `createTodo` call already passes.
- Record the baseline before you start: `npx eslint . 2>&1 | tail -3` (expected 10 errors; add NONE) and the `npm test` count.
</preconditions>

<safety>
- R2 IS configured locally with the REAL bucket. NEVER upload to it, never call `presignPut`/`fetch` against it, and never run the UI upload
  flow against it. Test only through pure unit tests and the static authz test. `presign*` functions must not be called from tests.
- No schema change. `todo_attachments.file_key` has no index; at this scale (fewer than 100 users) the reference-count lookups by key are
  fine. Do NOT add an index. NEVER run `drizzle-kit push` (STATE.md). No DB writes and no migration runs.
- Do not touch `src/server/comment-access.ts` or the work-page/submission deadline logic.
</safety>

<interfaces>
<!-- Extracted at 6e311fc. Re-verify after the 03i/gic merges; signatures below are not expected to change. -->

src/db/schema/todos.ts:
```ts
todoAttachments = pgTable('todo_attachments', { id, todoId (FK todos, cascade), fileName, fileKey, contentType, fileSize: integer,
  uploadedBy: text notNull, createdAt })
todos: { id, phaseId, groupId, assignmentId: string|null (shared by multi-group copies, set only when >1 group), ... }
// relation todos.attachments exists (queries/todo.ts uses `with: { attachments: true }`)
```

src/lib/r2.ts (framework-free):
```ts
getR2Config(): R2Config | null
const ALLOWED_TYPES: Set<string>  // pdf, msword, jpeg, png, webp, docx, xlsx, pptx, mp4, zip (student list, DO NOT change)
validateFile(contentType, size) // 50 MB, legacy; validateSubmissionFile (10 MB); SUBMISSION_ACCEPT
attachmentKey(todoId, filename) => `attachments/${todoId}/${filename}`   // grep for callers before changing it
presignPut(key, contentType, expiresSec = 1800): Promise<string>
presignGet(key, expiresSec = 3600, disposition?): Promise<string>
deleteObject(key) // best-effort
```

src/lib/r2-cleanup.ts: `cleanupR2Objects(keys, deleter = deleteObject): Promise<void>` (dedupes, never throws). Also re-exported from
`@/server/phase-helpers`.

src/lib/work-page.ts: `computeOrphanFileKeys(oldKeys, ...stillReferenced: Iterable<string>[]): string[]` (pure, tested).

src/lib/action-result.ts: `type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string }`,
`actionError(error)`.

src/server/phase-helpers.ts:
```ts
export type DbLike = typeof db | <transaction tx>
export async function assertTodoEditor(todoId, userId) // throws 'Classroom not found or not authorized'; returns { todo, classroom, ... }
export async function collectFileKeys(tx: DbLike, input: { todoIds: string[] }): Promise<string[]>
// selects submission_files keys, todo_attachments keys and work_page_files keys for todoIds and dedupes them.
// Callers: deleteTodo (todo.ts, single copy or allCopies), deletePhase, deleteGroup, deleteClassroom. All call it INSIDE the tx
// right before the DELETE and pass the result to cleanupR2Objects after commit.
```

src/server/actions/todo.ts: `getAttachmentDownloadUrl({ attachmentId })` uses `authorizeTodoViewer(attachment.todoId, userId)` and then
`presignGet(fileKey, 3600, 'attachment; filename="…"')` and returns `{ success, url, fileName } | { success:false, error }`.
Teacher actions use `await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN); const userId = await getCurrentUserId();`.

Upload pattern to mirror (src/server/actions/work-page.ts createWorkPageUploadUrl / attachWorkPageFile and
src/components/work-page/work-page-files.tsx lines ~125-150): zod `safeParse` returns `actionError(ERR_INPUT)`; `getR2Config()` missing
returns 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์'; `safeName = fileName.replace(/[^\w.\-]/g, '_').slice(-100)`; key = `prefix/${createId()}-${safeName}`;
the client does `fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: file })` and then calls attach; attach
re-validates the key prefix and rejects '..'.

src/server/__tests__/authz-coverage.test.ts: `SCANNED = ['classroom.ts','group.ts','phase.ts','todo.ts','template.ts','impact.ts']`;
every export whose body contains `requireRole(ROLES.TEACHER` must match `/assert(Classroom|Group|Phase|Todo)Editor\(/`. Helper
`exportedFunctions(file)` gives `{ file, name, body }`.

UI: `ConfirmDialog` in src/components/cocoon/confirm-dialog.tsx (shared 02p destructive confirm; read its props). `fileTypeTag(fileName)`
in src/lib/format.ts. `TodoAttachmentsList` in src/components/todo/todo-attachments-list.tsx (has a local `formatFileSize` and an
AttachmentRow that downloads via `window.open`). toasts via `sonner`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Attachment rules, server actions, and shared-key-safe R2 cleanup</name>
  <files>src/lib/r2.ts, src/lib/todo-attachments.ts, src/lib/__tests__/todo-attachments.test.ts, src/server/actions/todo-attachment.ts, src/server/actions/todo.ts, src/server/phase-helpers.ts, src/server/__tests__/authz-coverage.test.ts</files>
  <behavior>
    - validateAttachmentFile: a 25 MB docx passes; 25 MB + 1 byte fails; size 0 fails; 'application/vnd.ms-excel', 'image/gif',
      'text/plain' and 'application/msword' pass; 'application/x-msdownload' fails
    - inferAttachmentContentType('Brief.DOCX', '') gives the docx MIME; ('a.pdf', 'application/pdf') keeps the browser type; ('x.exe', '') gives ''
    - resolveAttachmentScope([{id:'t1', assignmentId:null}]) gives 't1'; two copies with the same assignmentId 'a1' give 'a1'; two
      to-dos with different or null assignmentIds give an error; an empty list gives an error
    - buildAttachmentKey('a1', 'id1', 'แผนงาน (v2).pdf') starts with 'attachments/a1/id1-', contains no '/' after the prefix, and is at
      most 100 characters for the name part
    - isAttachmentKeyInScope: true for a key built for that scope; false for another scope, for '..', and for 'attachments/a1' with no file part
    - checkAttachmentCapacity({t1: 9, t2: 3}, 1) is ok; ({t1: 10}, 1) fails and names the full to-do; adding 2 to 9 fails
    - attachment orphan keys (via computeOrphanFileKeys): a key still referenced by another copy is NOT returned; an unreferenced key is returned
  </behavior>
  <action>
    1. `src/lib/r2.ts` (additive only; the student `ALLOWED_TYPES`/`validateSubmissionFile`/`SUBMISSION_ACCEPT` stay unchanged):
       `ATTACHMENT_MAX_FILE_SIZE = 25 * 1024 * 1024`; `ATTACHMENT_ALLOWED_TYPES = new Set([...ALLOWED_TYPES, 'application/vnd.ms-excel',
       'application/vnd.ms-powerpoint', 'image/gif', 'text/plain', 'text/csv'])` (msword is already in the list; keep it);
       `validateAttachmentFile(contentType, size)` (allowed type, size > 0 and ≤ 25 MB); `ATTACHMENT_ACCEPT` (extensions .pdf .doc .docx
       .xls .xlsx .ppt .pptx .png .jpg .jpeg .webp .gif .txt .csv .zip .mp4 plus the MIME types). Grep `attachmentKey(` first. If it has no
       callers, replace it with `attachmentKey(scope, uploadId, safeName) => \`attachments/${scope}/${uploadId}-${safeName}\``. Otherwise
       keep it and add the new builder only in the lib module.
    2. NEW `src/lib/todo-attachments.ts` (pure, no 'use server', no DB): `MAX_ATTACHMENTS_PER_TODO = 10`, `sanitizeAttachmentName`
       (same regex as work-page), `resolveAttachmentScope(todos: {id, assignmentId}[]) => { ok: true, scope } | { ok: false }` (one to-do
       → its id; several → all must share the same non-null assignmentId), `buildAttachmentKey(scope, uploadId, fileName)`,
       `isAttachmentKeyInScope(key, scope)` (prefix `attachments/${scope}/`, a non-empty remainder with no '/' and no '..'),
       `inferAttachmentContentType(fileName, browserType)` (keep a non-empty browserType; otherwise map the extension; unknown → ''),
       `checkAttachmentCapacity(counts: Record<todoId, number>, adding: number) => { ok: true } | { ok: false, todoId }`,
       `ATTACHMENT_ERRORS` Thai strings: 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์', 'ไฟล์ต้องเป็นชนิดที่รองรับ และไม่เกิน 25 MB',
       'แนบได้สูงสุด 10 ไฟล์ต่องาน', 'ข้อมูลไม่ถูกต้อง'. Write the tests first (RED), then implement (GREEN). No network calls in tests.
    3. NEW `src/server/actions/todo-attachment.ts` ('use server'). Every export starts with `await requireRole(ROLES.TEACHER,
       ROLES.SUPERADMIN)` + `getCurrentUserId()`, and every export returns `ActionResult` (no throw for expected errors):
       - `createAttachmentUploadUrl({ todoIds: string[1..20], fileName, contentType, size })`: dedupe the ids, then
         `for (const id of ids) await assertTodoEditor(id, userId)` (ALL targets). If `!getR2Config()`, return the storage error.
         `validateAttachmentFile`. Load the todos' {id, assignmentId} → `resolveAttachmentScope`. Count the existing attachments per
         to-do → `checkAttachmentCapacity(counts, 1)`. key = `buildAttachmentKey(scope, createId(), fileName)`; `presignPut` inside
         try/catch (catch → storage error). Return `{ key, url }`. Staging happens client-side, so the create dialog calls this AFTER
         `createTodo` returns the ids. Cancelling the dialog never leaves an orphan object. This is a documented discretion choice that
         replaces the `todoId | assignment` input shape from CONTEXT.
       - `addTodoAttachment({ todoIds, key, fileName, contentType, size })`: assertTodoEditor on ALL ids, validateAttachmentFile,
         resolveAttachmentScope + `isAttachmentKeyInScope` (else input error). Then `db.transaction`: `SELECT id FROM todos WHERE id IN
         (…) ORDER BY id FOR UPDATE` (drizzle `.for('update')`); reject if ANY todo_attachments row already has this file_key (stops
         re-attaching or cross-attaching a key); re-count per to-do and run checkAttachmentCapacity; insert one row per to-do with the SAME
         fileKey and `uploadedBy: userId`. Return `{ attachments: {id, todoId, fileName, contentType, fileSize}[] }`. `revalidatePath`
         as the existing todo actions do.
       - `removeTodoAttachment({ attachmentId })`: load the row (not found → input error), then `assertTodoEditor(row.todoId, userId)`.
         `db.transaction`: `SELECT id FROM todo_attachments WHERE file_key = row.fileKey FOR UPDATE` (serialises concurrent removals of
         copies that share the key), delete by id, count the remaining rows with that key. AFTER commit: if the count is 0,
         `await cleanupR2Objects([key])`. Removing a row deletes it from this copy only.
    4. `src/server/actions/todo.ts` `getAttachmentDownloadUrl`: if `!getR2Config()`, return `{ success:false, error:'ยังไม่ได้ตั้งค่าที่เก็บไฟล์' }`
       before presigning. Keep the authorizeTodoViewer gate untouched. Make no other changes to this file. 03i edited it, so re-read it first.
    5. `src/server/phase-helpers.ts` `collectFileKeys`: after the three selects, if there are attachment keys, query
       `todo_attachments.file_key` WHERE `inArray(fileKey, attachmentKeys) AND notInArray(todoId, input.todoIds)` and drop those keys via
       `computeOrphanFileKeys(attachmentKeys, stillReferenced)` (import from '@/lib/work-page'). Submission and work-page keys are not
       affected. Update the JSDoc. This one change covers all 02p delete paths (deleteTodo single copy or allCopies, deletePhase,
       deleteGroup, deleteClassroom), so the callers need no edits.
    6. `authz-coverage.test.ts`: add 'todo-attachment.ts' to SCANNED. Add a describe block that checks: the exports are exactly
       createAttachmentUploadUrl / addTodoAttachment / removeTodoAttachment; each body contains `requireRole(ROLES.TEACHER` and
       `assertTodoEditor(`; createAttachmentUploadUrl and addTodoAttachment loop over all ids (body matches /for \(const \w+ of/ before
       assertTodoEditor, or uses Promise.all over ids); addTodoAttachment contains `isAttachmentKeyInScope(` and `.for('update')`;
       removeTodoAttachment contains `.for('update')` and `cleanupR2Objects(`; no body contains `deleteObject(` directly. Also assert that
       phase-helpers.ts collectFileKeys source matches /notInArray\(todoAttachments\.todoId/.
  </action>
  <verify>
    <automated>npx vitest run src/lib/__tests__/todo-attachments.test.ts src/server/__tests__/authz-coverage.test.ts && npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5</automated>
  </verify>
  <done>New tests pass. The authz test scans todo-attachment.ts and passes. tsc is clean. eslint stays at the 10-error baseline with none
  in touched files. Full `npm test` is green. No R2 calls in tests. No schema or DB changes. Commit: test(...) then feat(quick-261004-gid): ...</done>
</task>

<task type="auto">
  <name>Task 2: Teacher upload and manage UI (create/assign dialog, edit form, teacher to-do page)</name>
  <files>src/components/todo/upload-todo-attachment.ts, src/components/todo/todo-attachment-manager.tsx, src/components/todo/staged-attachment-picker.tsx, src/components/todo/assign-todo-dialog.tsx, src/components/todo/todo-edit-form.tsx, src/components/todo/todo-item.tsx, src/app/(dashboard)/todo/[todoId]/page.tsx, (the query feeding TodoItem, likely src/server/queries/phase.ts)</files>
  <action>
    1. NEW `upload-todo-attachment.ts` (client helper, no JSX): `uploadTodoAttachment(file: File, todoIds: string[]):
       Promise<ActionResult<{ attachments }>>`. Steps: contentType = `inferAttachmentContentType(file.name, file.type)`; validate on the
       client with `validateAttachmentFile` (import from '@/lib/r2'; it is framework-free) and fail fast with the Thai error;
       `createAttachmentUploadUrl`; `fetch(url, { method:'PUT', headers:{'content-type': contentType}, body: file })` (not ok →
       'อัปโหลดไม่สำเร็จ'); then `addTodoAttachment` with the returned key.
    2. NEW `todo-attachment-manager.tsx` ('use client'), props `{ todoId: string; attachments: {id,fileName,contentType,fileSize}[] }`.
       Header "ไฟล์แนบจากครู" with a count `n/10`. Rows match the TodoAttachmentsList styling: fileTypeTag, name (truncate), size,
       "เปิด" (getAttachmentDownloadUrl → window.open; show the error string in a toast) and "ลบ" (opens ConfirmDialog
       "ลบไฟล์แนบนี้?" with a description that mentions it is removed from this งาน only; confirm → removeTodoAttachment → toast +
       `router.refresh()`). A hidden `<input type="file" multiple accept={ATTACHMENT_ACCEPT}>` behind an "แนบไฟล์" button (44px hit area,
       disabled at 10 or while uploading). Upload sequentially with a per-file "กำลังอัปโหลด…" row. Report per-file errors in toasts.
       Refresh at the end. Empty state: "ยังไม่มีไฟล์แนบ". Hint line: "PDF, Word, Excel, PowerPoint, รูปภาพ · ไม่เกิน 25 MB · สูงสุด 10 ไฟล์".
    3. NEW `staged-attachment-picker.tsx`: a controlled `{ files: File[]; onChange; disabled }` list with a remove (×) button per file,
       client-side validation on pick (rejected files are toasted and not staged), max 10, and the same hint line. No network.
    4. `assign-todo-dialog.tsx`: add `const [stagedFiles, setStagedFiles] = useState<File[]>([])`. Clear it in `reset()`. Render the
       picker in its own `<div className="space-y-2">` section labelled "ไฟล์แนบจากครู (ไม่บังคับ)" AFTER the existing fields (including
       03i's deadline input) and before the footer. In handleSubmit, after `createTodo(...)` succeeds (leave its argument object exactly as
       03i left it), upload each staged file ONCE with `uploadTodoAttachment(file, result.todoIds)` so one object is shared by all copies.
       Count the failures. Toast success as today; when there are failures, `toast.error(\`สร้างงานแล้ว แต่แนบไฟล์ไม่สำเร็จ ${n} ไฟล์\`)`.
       Close the dialog either way (the files can be re-attached from the edit form). Other quick-add paths (inline-add-todo) are
       unchanged.
    5. `todo-edit-form.tsx`: replace ONLY the "Attachments section placeholder" block ("อัปโหลดไฟล์แนบ (จะเปิดใช้งานเมื่อเชื่อมต่อ R2)")
       with `<TodoAttachmentManager todoId={todo.id} attachments={todo.attachments ?? []} />`. Add `attachments?` to the todo prop type.
       Leave the deadline code alone. To pass the data, find the server query that feeds `group-phase-board` → TodoList → TodoItem (grep
       `with:` in src/server/queries/phase.ts / todo.ts and the teacher group page). Add `attachments: { columns: { id, fileName,
       contentType, fileSize } }` to the todos relation there. Add the field to the TodoItem todo type in todo-item.tsx. If that type is
       inferred, only pass it through. Check that student pages using the same query are unaffected (the extra field is harmless).
    6. `todo/[todoId]/page.tsx`: in the TEACHER branch's "ไฟล์แนบ" card, render `TodoAttachmentManager` instead of the read-only
       `TodoAttachmentsList` (the student branch keeps its own view). Leave the 03i/gic sections untouched.
    Do NOT run the upload flow in a browser against the real bucket.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && grep -c "uploadTodoAttachment" src/components/todo/assign-todo-dialog.tsx && ! grep -q "จะเปิดใช้งานเมื่อเชื่อมต่อ R2" src/components/todo/todo-edit-form.tsx</automated>
  </verify>
  <done>Teachers can stage files in the assign dialog (uploaded once after create and shared across copies), and can upload, open and
  delete files from the edit form and the teacher to-do page. The placeholder is gone. 03i deadline code is unchanged (`git diff`
  shows only additive hunks around it). tsc is clean, lint is at baseline, and tests are green.</done>
</task>

<task type="auto">
  <name>Task 3: Student "ไฟล์แนบจากครู" polish, template note, full regression + build</name>
  <files>src/components/todo/todo-attachments-list.tsx, src/components/student/todo-detail-view.tsx, src/components/template/save-template-dialog.tsx</files>
  <action>
    1. `todo-detail-view.tsx`: rename the heading "ไฟล์จากครู" to "ไฟล์แนบจากครู". Keep `hasDetail` true when only attachments exist
       (it already is; verify).
    2. `todo-attachments-list.tsx` (student/read-only list): label the download button "ดาวน์โหลด" with an aria-label that includes the
       file name. Show the server's error string (for example 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์') in the toast instead of a generic one. Export
       the local `formatFileSize` and reuse it in TodoAttachmentManager if Task 2 duplicated it (remove the duplicate). Make no visual
       changes otherwise.
    3. `save-template-dialog.tsx`: add a visible note line "ไฟล์แนบไม่ถูกบันทึกในเทมเพลต" (muted, 13-14px) under the description. Also grep
       for any other save-as-template entry points (e.g. a per-to-do save using `template.ts` line ~119) and add the same note there if it
       has a dialog. Templates never copy attachments (unchanged).
    4. Regression (no R2 calls, no DB writes): `npx tsc --noEmit`; `npx eslint .` (10-error baseline); `npm test`; `npm run build`.
       Grep checks: `grep -rn "deleteObject(" src/server/actions` shows no new direct calls; `grep -n "notInArray(todoAttachments.todoId"
       src/server/phase-helpers.ts` gives 1 match. Write `261004-gid-SUMMARY.md` with a manual UAT list for the user (with R2): assign
       to 2 groups with a file → both copies list it; delete it from copy A → copy B still opens it; delete copy B's to-do → object removed;
       student downloads; a student of another classroom is refused; an 11th file is refused; a 26 MB file is refused.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -15 && grep -q "ไฟล์แนบไม่ถูกบันทึกในเทมเพลต" src/components/template/save-template-dialog.tsx && grep -q "ไฟล์แนบจากครู" src/components/student/todo-detail-view.tsx</automated>
  </verify>
  <done>The student label reads "ไฟล์แนบจากครู" and downloads go through getAttachmentDownloadUrl. The template note is visible. tsc is
  clean, lint is at baseline, all tests pass, and `npm run build` succeeds. SUMMARY.md has the UAT list. Commits are atomic per task.</done>
</task>

</tasks>

<verification>
- Every export of todo-attachment.ts runs requireRole(TEACHER) and assertTodoEditor for every target id (static test).
- Shared key safety: removeTodoAttachment cleans up only when the remaining-row count is 0 under a FOR UPDATE lock on the key's rows;
  collectFileKeys excludes keys referenced by to-dos outside the deleted set. This covers all four 02p delete paths.
- Limits are enforced on the server (25 MB, allow-list, 10 per to-do under the todo row lock) and mirrored on the client.
- Without R2 config, upload and download return 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์'.
- No schema change, no drizzle-kit push, no uploads to the real bucket.
</verification>

<success_criteria>
- Teacher can attach files during create/assign and edit, and open or delete them; students see and download "ไฟล์แนบจากครู".
- A multi-group assign uses one R2 object; deleting one copy's row or one copy never deletes an object still referenced elsewhere.
- tsc clean, eslint at the 10-error baseline, npm test green, npm run build green.
</success_criteria>

<output>
After completion, create `.planning/quick/261004-gid-teacher-file-attachments-on-tasks/261004-gid-SUMMARY.md`
</output>
