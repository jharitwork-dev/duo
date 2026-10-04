---
phase: quick-261004-j6h
plan: 01
subsystem: classroom phases / tasks
tags: [classroom-tasks, sync, overrides, deadline-ordering, migration, r2]
requires: [261003-wuo classroom phases, 261004-gid shared-key attachments, 261004-01i work pages]
provides: [classroom_tasks, classroom_task_files, todos.classroom_task_id, todos.overridden_fields, syncClassroomTasks, deadline-first task ordering]
affects: [teacher classroom Phase tab, teacher group page, /todo/[todoId], student group page, student todo page]
tech-stack:
  added: []
  patterns: [pure planner + DB applier (planClassroomTaskSync / syncClassroomTasks), per-field override list on materialized copies, partial unique index + onConflictDoNothing]
key-files:
  created:
    - src/db/schema/classroomTasks.ts
    - src/db/migrations/2026-10-04-classroom-tasks.ts
    - src/lib/classroom-task-sync.ts
    - src/lib/todo-order.ts
    - src/lib/__tests__/classroom-task-sync.test.ts
    - src/lib/__tests__/todo-order.test.ts
    - src/server/actions/classroom-task.ts
    - src/server/queries/classroom-task.ts
    - src/components/classroom-task/classroom-task-section.tsx
    - src/components/classroom-task/classroom-task-dialog.tsx
    - src/components/classroom-task/classroom-task-file-manager.tsx
    - src/components/classroom-task/upload-classroom-task-file.ts
    - src/components/classroom-task/classroom-task-badge.tsx
  modified:
    - src/db/schema/todos.ts
    - src/db/schema/index.ts
    - src/db/schema/relations.ts
    - src/db/__tests__/schema.test.ts
    - src/server/phase-helpers.ts
    - src/server/actions/todo.ts
    - src/server/actions/todo-attachment.ts
    - src/server/actions/group.ts
    - src/server/actions/phase.ts
    - src/server/actions/classroom.ts
    - src/server/queries/phase.ts
    - src/server/queries/todo.ts
    - src/server/__tests__/authz-coverage.test.ts
    - src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx
    - src/app/(dashboard)/todo/[todoId]/page.tsx
    - src/components/phase/phase-list.tsx
    - src/components/phase/phase-item.tsx
    - src/components/todo/todo-item.tsx
    - src/components/todo/todo-list.tsx
    - src/components/todo/todo-edit-form.tsx
    - src/components/student/group-phase-view.tsx
    - src/components/student/student-todo-view.tsx
decisions:
  - "Classroom tasks are materialized as one todos row per group (classroom_task_id + assignment_id = task id); syncClassroomTasks is the single place that reconciles copies"
  - "title / deadline / submissionMode are locked on copies (server rejects changes); description / notes / fileRequirement / attachments are overridable per copy via todos.overridden_fields"
  - "Deleting a classroom task syncs with excludeTaskIds BEFORE deleting the row (deletes unsubmitted copies, detaches submitted ones), never relying on FK SET NULL"
  - "Shared R2 keys are deleted only when no todo_attachments AND no classroom_task_files row references them"
  - "Within a phase, tasks are ordered by deadline asc, undated last by order_index; only undated tasks are draggable"
metrics:
  duration: ~45min
  completed: 2026-10-04
---

# Quick 261004-j6h Plan 01: Classroom-level locked tasks (งานของห้องเรียน) Summary

Teachers can now add tasks once on a phase's "งานของห้องเรียน (ทุกกลุ่มต้องทำ)" section. Each one becomes a todos copy in every group, including groups created later. Title, deadline and submission mode are locked to the classroom. Notes, description, file requirement and files sync to every copy until a group's copy edits that field. Every phase task list (teacher and student) is ordered by deadline.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 (RED) | aa65715 | Failing tests: sync planner, deadline ordering, schema |
| 1 (GREEN) | d1fe21f | Schema, additive migration script, pure planner, todo-order |
| 2 | fd1c778 | syncClassroomTasks, classroom-task actions, locked/override enforcement, sync hooks, shared-key safe deletion, query ordering, authz coverage |
| 3 | 49016ab | Phase tab UI, 🔒 badge, locked copy form, deadline-ordered lists, teacher file open |

## Verification

- `npx tsc --noEmit`: clean
- `npm test`: 22 files, 522 tests passing (baseline was 476)
- `npx eslint src`: 10 errors, all in the pre-existing baseline files (`auth.test.ts`, `use-mobile.ts`). The warnings are all in files this plan did not touch, or are older unused imports. Nothing new from this plan.
- `npm run build`: success
- `grep syncClassroomTasks(tx src/server/actions/group.ts` = 2. There are no `deleteObject(` calls in `src/server/actions`.

## Migration (shared live DB)

- **Dry-run:** BEFORE and AFTER counts matched (`phases=5 groups=19 todos=7 todo_attachments=0 submissions=1`). It created both tables, both todos columns, `classroom_tasks_phase_id_idx`, `classroom_task_files_task_id_idx` and the partial unique `todos_classroom_task_group_unique ... WHERE (classroom_task_id IS NOT NULL)`. It also added the three FKs (two CASCADE, plus `todos_classroom_task_id_classroom_tasks_id_fk` ON DELETE SET NULL). Linked, overridden and new-table rows were all 0. Ended with "DRY RUN — rolled back".
- **Apply:** same counts, all assertions passed, "APPLIED — committed".
- **Re-run of `--dry-run`:** "already migrated ... nothing to do", counts unchanged.
- `drizzle-kit` was never run.

## Pre-deploy DB smoke test (transaction, always rolled back)

This ran against the migrated live schema on the real classroom (19 groups). A temporary script was used and then deleted.
- Creating a task with one file and syncing gave 19 copies with 19 attachment rows. Re-syncing gave an empty result (idempotent).
- The `'attachments'` override-marking SQL is de-duplicated (`['attachments']` after running it twice).
- After a title and notes edit: the copy with `notes` overridden got the new title and kept its old notes. The other copies got both changes.
- Removing the classroom file: the overridden copy kept its attachment and no R2 key was orphaned.
- Deleting the task: the unsubmitted copies were deleted and the submitted copy was detached (`classroom_task_id = null`, overrides cleared). The orphaned key of the deleted copy was returned for cleanup.
- After the rollback, `getClassroomTasksByPhase` returned `{}` and the table counts were unchanged.

## Deploy

- `git push origin main` (e5d5c77..49016ab). The Vercel Git integration built deployment `dpl_7BFa8LV8qboevYZKSGdPecuisqEk` (https://duo-cqdstr73a-jharitwork-devs-projects.vercel.app), status **Ready**, Production. GitHub reports Vercel `success` for 49016ab.
- `curl -sI https://build.innovators.co.th` returns `HTTP/2 200`.

## Deviations from Plan

### Auto-fixed / added

**1. [Rule 2 - Missing functionality] Added `getClassroomTaskFileUrl` teacher download action**
- **Found during:** Task 3 (ClassroomTaskFileManager "เปิด" button)
- **Issue:** The planned action list had no way to open a classroom-level file. Copies use `getAttachmentDownloadUrl` on their own rows, but the classroom task's own files had nothing.
- **Fix:** Added a new export with requireRole(TEACHER), assertClassroomTaskEditor and presignGet. The authz-coverage expected export list was updated to match.
- **Files:** src/server/actions/classroom-task.ts, src/server/__tests__/authz-coverage.test.ts
- **Commit:** 49016ab

**2. [Rule 2] `addTodoAttachment` duplicate-key check also covers `classroom_task_files`**
- This stops a key that belongs to a classroom task from being re-attached through the per-todo path.

**3. [Rule 1] Linked-copy form never sends locked fields**
- `TodoEditForm` omits title, deadline and submissionMode for copies, and the server drops them after `computeOverrideMarks`. A small difference in the re-sent deadline can no longer cause a false "locked" rejection. `updateTodo` errors now show as a toast instead of being lost.

**4. Lock order in `removeTodoAttachment` / `removeClassroomTaskFile`**
- Both take row locks in the same order (todo_attachments, then classroom_task_files) to avoid deadlocks.

### Notes
- `deleteTodo` also rejects an assignment-wide delete (`allCopies`) when any copy in scope is linked. Classroom copies share `assignmentId = classroomTaskId`, so without this check that path could remove them.
- The dialog has no separate "description" input. Like AssignTodoDialog, the notes textarea holds the description and the deliverable bullets. `description` still syncs and can be overridden on the server.

## Known Stubs

None.

## Manual verification checklist

1. On the Phase tab, add a classroom task with a file. Every group page shows it with "🔒 งานของห้องเรียน" and the file. The student group page shows the badge.
2. Create a new group (as a teacher, or as a student in self_create mode). It gets the task right away.
3. Edit the title or deadline on the Phase tab. Every group's copy changes, and the toast says "บันทึกแล้ว — อัปเดตทุกกลุ่ม".
4. On group A's copy, edit the notes. The caption reads "แก้เฉพาะกลุ่มนี้แล้ว" and the Phase row shows "1 กลุ่มแก้รายละเอียดเอง". A later classroom notes edit changes only B.
5. On a copy, title, deadline and mode are read-only with the 🔒 caption. The ⋯ menu shows "จัดการได้จากแท็บ Phase" instead of archive or delete.
6. Remove an inherited file on copy A. The file stays on B and on the classroom task, and still opens.
7. Delete the task while one group has submitted. The dialog shows "ลบออกจาก n กลุ่มที่ยังไม่ส่ง" and "เก็บไว้ใน 1 กลุ่มที่ส่งงานแล้ว". The kept copy loses its badge and becomes editable and deletable.
8. Dated tasks are listed before undated ones (earliest first) on the teacher group page and the student group page. Only undated tasks have a drag handle.

## Self-Check: PASSED

- All created files exist (`src/db/schema/classroomTasks.ts`, migration, libs, actions, queries, 5 classroom-task components).
- Commits aa65715, d1fe21f, fd1c778 and 49016ab are present on main and pushed.
