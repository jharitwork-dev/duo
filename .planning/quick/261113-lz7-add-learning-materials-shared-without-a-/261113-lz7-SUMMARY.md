---
phase: quick-261113-lz7
plan: 01
subsystem: classroom
tags: [materials, r2, drizzle, migration, teacher-ui, student-ui]
requires: [classrooms, phases, classroom_members, R2 presign helpers, assertClassroomEditor]
provides: [materials, material_files, getClassroomMaterials, getStudentMaterials, material server actions]
affects: [teacher classroom page, student group page, student classroom page, deletePhase, deleteClassroom]
tech-stack:
  added: []
  patterns: [additive idempotent migration script (--dry-run/--apply), post-commit R2 cleanup, viewer-style action without requireRole(TEACHER)]
key-files:
  created:
    - src/db/schema/materials.ts
    - src/db/migrations/2026-11-13-materials.ts
    - src/lib/material-files.ts
    - src/lib/__tests__/material-files.test.ts
    - src/server/actions/material.ts
    - src/server/queries/material.ts
    - src/components/material/materials-tab.tsx
    - src/components/material/material-dialog.tsx
    - src/components/material/material-file-manager.tsx
    - src/components/material/material-file-buttons.tsx
    - src/components/material/upload-material-file.ts
    - src/components/student/student-material-cards.tsx
  modified:
    - src/db/schema/index.ts
    - src/db/__tests__/schema.test.ts
    - src/server/__tests__/authz-coverage.test.ts
    - src/server/actions/phase.ts
    - src/server/actions/classroom.ts
    - src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/page.tsx
decisions:
  - "Upload URL / add-file actions use the analog's { key, url } / key naming (same as classroom-task) so the upload helper mirrors upload-classroom-task-file.ts"
  - "updateMaterial may keep a material on its current archived phase; moving to a different phase requires an active phase of the same classroom"
  - "Teacher page fetch of getClassroomMaterials is wrapped in .catch(() => []) so the page still renders if the code ships before the migration"
metrics:
  duration: ~25min
  completed: 2026-11-13
---

# Quick 261113-lz7: Learning materials (สื่อการเรียน) Summary

Teachers can now share learning materials (title, plain-text description, http/https link, up to 10 R2 files) with a whole classroom or one phase. Materials create no task, have nothing to submit, and do not count toward progress or phase unlocking. Every classroom member can see them; students never see materials on archived phases.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (RED) | Failing tests: helpers, schema, authz coverage | e907604 |
| 1 (GREEN) | Schema, migration, helpers, actions, queries, cascade R2 cleanup | 2134168 |
| 2 | Teacher "สื่อการเรียน" tab, dialog, file manager | d1b85be |
| 3 | Student section on the group and no-group classroom pages | 19db6bc |

## What was built

- **Schema and migration:** `materials` and `material_files` tables, copied from the draft as-is. `2026-11-13-materials.ts` follows the forms migration's structure: one transaction, `lock_timeout`, an idempotent "already migrated" check, FKs added only when missing, and before/after count assertions.
- **Helpers:** `buildMaterialFileKey` builds keys as `materials/{id}/{upload}-{safe}`. `isMaterialFileKeyInScope` checks that a key belongs to its material. `normalizeMaterialLinkUrl` accepts only http/https links up to 2000 characters. `MATERIAL_ERRORS` holds the Thai error strings.
- **Teacher actions:** `createMaterial`, `updateMaterial`, `deleteMaterial`, `createMaterialUploadUrl`, `addMaterialFile` and `removeMaterialFile`. Each one calls `requireRole(TEACHER, SUPERADMIN)` and then `assertClassroomEditor`. They also check that the phase belongs to the classroom and is not archived, check the key scope, reject duplicate keys, and cap files at 10. R2 cleanup runs after the commit, with no reference counting (D-02).
- **Member download:** `getMaterialFileUrl` calls `authorizeMaterialViewer`, a module-private function. A classroom editor can download everything. Any other member can download classroom-wide materials and materials on non-archived phases only. Non-members are rejected.
- **Queries:** `getClassroomMaterials` (teacher; includes archived phases) and `getStudentMaterials` (members only; excludes archived phases). Neither returns file keys. Results are ordered classroom-wide first, then by phase order, then by material order and creation time.
- **Deleting phases and classrooms:** `deletePhase` and `deleteClassroom` now select the matching `material_files.file_key` values inside their transactions and pass them to `cleanupR2Objects` after the commit.
- **Teacher page:** new `?tab=materials` tab. Materials are grouped under "ทั้งห้องเรียน" first, then by phase, with "(เก็บถาวร)" after archived phases. Teachers can create, edit and delete materials (delete goes through ConfirmDialog), stage files when creating, and manage files when editing.
- **Student pages:** the group page shows classroom-wide materials plus the selected phase's materials. This includes the preview of a locked phase, since there is nothing to submit. The no-group classroom page shows every material the student can see. If the query fails, the section is simply not rendered.

## Verification

- `npx tsc --noEmit`: clean. This needed `npx next typegen` first, because the fresh worktree had no `.next` route types (`RouteContext`).
- `npm test`: 26 files, 641 tests passed.
- `npm run lint`: 17 problems (10 errors, 7 warnings), all in files this plan does not touch (join page, create-classroom-form, invite-code-display, the 2026-10-04 migration, relations.ts, use-mobile, auth.test, RegisterForm). Running `npx eslint` on every created or modified file reports no problems.
- `npm run build`: succeeded.
- grep checks: no progress or phase-unlock code refers to materials (the authz test checks this too). `materialFiles` appears in both the `deletePhase` and `deleteClassroom` transactions.

## Migration --dry-run output (run against the LIVE DB; --apply was NOT run)

```
MODE: DRY RUN (will roll back)
BEFORE: classrooms=1 phases=5 groups=21 todos=156 submissions=27
BEFORE columns (table.column type nullable default):
  (none)
BEFORE indexes:
  (none)
BEFORE foreign keys / unique constraints:
  (none)
AFTER: classrooms=1 phases=5 groups=21 todos=156 submissions=27
AFTER columns (table.column type nullable default):
  material_files.id text NOT NULL
  material_files.material_id text NOT NULL
  material_files.file_name text NOT NULL
  material_files.file_key text NOT NULL
  material_files.content_type text NOT NULL
  material_files.file_size integer NOT NULL
  material_files.uploaded_by text NOT NULL
  material_files.created_at timestamp without time zone NOT NULL default now()
  materials.id text NOT NULL
  materials.classroom_id text NOT NULL
  materials.phase_id text NULL
  materials.title text NOT NULL
  materials.description text NULL
  materials.link_url text NULL
  materials.order_index integer NOT NULL default 0
  materials.created_by text NOT NULL
  materials.created_at timestamp without time zone NOT NULL default now()
  materials.updated_at timestamp without time zone NOT NULL default now()
AFTER indexes:
  material_files_material_id_idx: CREATE INDEX material_files_material_id_idx ON public.material_files USING btree (material_id)
  material_files_pkey: CREATE UNIQUE INDEX material_files_pkey ON public.material_files USING btree (id)
  materials_classroom_id_idx: CREATE INDEX materials_classroom_id_idx ON public.materials USING btree (classroom_id)
  materials_phase_id_idx: CREATE INDEX materials_phase_id_idx ON public.materials USING btree (phase_id)
  materials_pkey: CREATE UNIQUE INDEX materials_pkey ON public.materials USING btree (id)
AFTER foreign keys / unique constraints:
  material_files.material_files_material_id_materials_id_fk: FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
  materials.materials_classroom_id_classrooms_id_fk: FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
  materials.materials_phase_id_phases_id_fk: FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE
AFTER materials=0 (expected 0)
AFTER material_files=0 (expected 0)
checked tables: materials, material_files, classrooms, phases
DRY RUN — rolled back
```

**REMINDER:** run `npx tsx src/db/migrations/2026-11-13-materials.ts --apply` BEFORE deploying this code. The new code reads the materials tables. The student sections and the teacher tab fall back to empty lists, but the material actions and the phase/classroom deletes will fail until the tables exist.

## Deviations from Plan

1. **[Rule 2 - Missing functionality] Added `src/components/material/material-file-buttons.tsx`.** The teacher tab and the student cards share one read-only download list (file buttons that call `getMaterialFileUrl` and show an inline error), so it is not duplicated. Commit d1b85be.
2. **[Rule 3 - Blocking] Upload action field names.** The plan named them `{ uploadUrl, fileKey }`. I used `{ key, url }` and `key` instead, matching `classroom-task.ts`, so `upload-material-file.ts` is a direct copy of the analog. Behavior is the same. Commit 2134168.
3. **[Rule 2] Teacher page `getClassroomMaterials(...).catch(() => [])`.** The plan only asked for this on the student pages. It keeps the classroom editor working if the code ships before the migration. Commit d1b85be.
4. **[Rule 2] Archived current phase in edit mode.** The phase picker in the dialog also lists the material's current archived phase, labelled "(เก็บถาวร)". Without this, saving would silently move the material to the whole classroom. The server accepts keeping the current phase. Commit d1b85be.
5. **Environment:** the worktree had no node_modules, `.env.local` or `.next` route types. I ran `npm ci`, copied `.env.local` from the main checkout (it is gitignored and not committed), and ran `npx next typegen`. I also copied the plan files into the worktree's `.planning/quick/...` directory.

## Known Stubs

None.

## Self-Check: PASSED

- All created files exist; commits e907604, 2134168, d1b85be and 19db6bc are present in `git log`.
