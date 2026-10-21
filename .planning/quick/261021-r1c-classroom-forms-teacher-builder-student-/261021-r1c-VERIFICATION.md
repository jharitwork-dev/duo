---
status: human_needed
score: 9/9 automated must-haves verified
human_verification:
  - test: "Apply migration (src/db/migrations/2026-10-21-forms.ts) after dry-run, then run the full flow"
    expected: "Teacher builds a form, adds it to a phase, student answers one question per screen, a pending submission appears in review, CSV opens in Excel with Thai text intact"
    why_human: "Migration not applied (by instruction); visual CI and UX cannot be checked statically"
---

# Verification: 261021-r1c classroom forms

Method: read the code directly, ignoring the SUMMARY claims. Ran tsc (clean), vitest (25 files, 617 tests passed) and eslint. The 10 eslint errors are all in pre-existing files unrelated to forms (register, create-classroom-form, invite-code-display, use-mobile, auth.test). No database writes and no migration run.

## Security checks

| Check | Result | Evidence |
|---|---|---|
| Teacher actions authorize server-side | VERIFIED | Every action in `src/server/actions/form.ts` (createForm, updateFormSettings, setFormStatus, deleteForm, add/update/delete/moveQuestion, addFormToPhase) calls `requireRole(TEACHER, SUPERADMIN)` and then `assertClassroomEditor` or `assertPhaseEditor`. The classroom comes from the DB row, not the client. A missing form or question returns the same error, so ids cannot be probed. |
| Teacher queries self-authorize | VERIFIED | `getClassroomForms`, `getFormForEditor` and `getFormResponsesView` call `loadClassroomAccess` and return null if the caller is not an editor. `buildFormCsvForRequest` goes through `getFormResponsesView`. |
| Students cannot see others' responses | VERIFIED | The student actions and `getFormForRespondent` use `resolveRespondent`. The ownerKey is the user id (individual) or the group id (group), and queries filter on `(formId, ownerKey)`. `getMyFormFileUrl` reads only the caller's own response and checks the key scope. |
| Group never trusted from client | VERIFIED | `saveFormResponse`, `createFormUploadUrl` and `getMyFormFileUrl` take `formId`, `questionId` and answers only. Membership, group and ownerKey come from `classroomMembers` and `getStudentGroup`. Linked todos are filtered by the server-derived `group.id`. |
| Export and file routes self-authorize, no file extension | VERIFIED | Both routes call `auth()`, check the teacher/superadmin role, check that the form belongs to the classroom, then call `loadClassroomAccess`. Every failure returns a 404 with no-store. The URLs are `/export` and `/file`. The middleware skips Clerk for `.csv` paths, so the extensionless URL keeps Clerk running. The file route checks `isFormFileKeyInScope` against the response's ownerKey before presigning (300 seconds). |
| Form-linked todos cannot be submitted through work-page actions | VERIFIED | `formTaskWorkPageBlock` is called in save, submit, update, upload-url, attach and remove actions of `work-page.ts` (lines 124, 192, 290, 423, 464). The only other `insert(submissions)` is in `form-response.ts`. |
| Upload key scoping | VERIFIED | `buildFormFileKey` produces `forms/{formId}/{ownerKey}/{uploadId}-{safeName}`. `validateAnswers` rejects any file key outside that scope. The scope check also rejects `..`, backslashes and extra path segments. |
| Submission bridge | VERIFIED | Inside a transaction with a form row lock, `saveFormResponse` upserts the response, then inserts or updates a pending submission for each viewable linked todo. It skips approved todos and todos in locked phases. It also re-checks that the form is open under the lock. |
| Add to phase, mode and audience, CSV | VERIFIED | `addFormToPhase` is wired (phase must be in the same classroom and not archived, duplicates guarded). `form_id` is synced through `classroom-task-sync`. Audience and mode are enforced by `decideFormEligibility`. CSV uses `buildFormCsv` (BOM and formula guard are in the pure lib, covered by passing tests). |

## Artifacts
All planned routes and components exist: builder page, responses page, export route, file route, `(focus)/forms/[formId]` runner page, `src/lib/forms.ts`, schema, migration file (not applied), and the server actions and queries.

## Gaps
None found.

## Human needed
- The migration is unapplied, so end-to-end behaviour against a real database is unverified.
- Visual CI fidelity and the Typeform-style UX are unverified.
- A real R2 upload and download is unverified.
