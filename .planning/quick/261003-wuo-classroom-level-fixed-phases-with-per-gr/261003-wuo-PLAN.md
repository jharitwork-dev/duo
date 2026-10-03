---
phase: quick-261003-wuo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/schema/phases.ts
  - src/db/schema/todos.ts
  - src/db/schema/groupPhaseProgress.ts
  - src/db/schema/relations.ts
  - src/db/schema/index.ts
  - src/db/__tests__/schema.test.ts
  - src/db/migrations/phase-merge-plan.ts
  - src/db/migrations/__tests__/phase-merge-plan.test.ts
  - src/db/migrations/2026-10-03-classroom-phases.ts
  - src/db/seed/templates.ts
  - src/lib/node-path.ts
  - src/lib/__tests__/node-path.test.ts
  - src/lib/phase-progress.ts
  - src/lib/__tests__/phase-progress.test.ts
  - src/lib/template-structure.ts
  - src/server/phase-helpers.ts
  - src/server/actions/phase.ts
  - src/server/actions/todo.ts
  - src/server/actions/template.ts
  - src/server/actions/group.ts
  - src/server/queries/phase.ts
  - src/server/queries/todo.ts
  - src/server/queries/template.ts
  - src/server/queries/submission.ts
  - src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx
  - src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx
  - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
  - src/app/(dashboard)/todo/[todoId]/page.tsx
  - src/components/phase/phase-list.tsx
  - src/components/phase/phase-item.tsx
  - src/components/phase/inline-add-phase.tsx
  - src/components/phase/archived-phase-list.tsx
  - src/components/phase/group-phase-board.tsx
  - src/components/phase/group-phase-status-select.tsx
  - src/components/todo/todo-list.tsx
  - src/components/todo/todo-item.tsx
  - src/components/todo/inline-add-todo.tsx
  - src/components/todo/assign-todo-dialog.tsx
  - src/components/template/template-picker.tsx
  - src/components/template/save-template-dialog.tsx
autonomous: true
requirements: [PHASE-01, PHASE-02, PHASE-03, PHASE-04, TODO-01, TODO-02, TODO-03, TODO-04, TOOL-01]

must_haves:
  truths:
    - "Every group in a classroom sees the same ordered phase list (phases belong to the classroom, not to a group)"
    - "A student only sees and can submit to-dos whose group_id is their own group; a teacher sees every group's to-dos in their classroom"
    - "A group's phase status comes from group_phase_progress; a missing row means first non-archived phase = active, all others = locked"
    - "Teacher can set one group's phase status (locked / active / completed) from the group page, and the student stepper reflects it"
    - "Teacher can create one to-do for several groups at once (checkboxes + ทุกกลุ่ม); each selected group gets its own independent copy sharing one assignment_id"
    - "Applying a template to an empty classroom creates the classroom phases and, optionally, the template's to-dos for the selected groups; applying when phases already exist is refused with a Thai error"
    - "บันทึกเป็นเทมเพลต saves the classroom's non-archived phases plus one chosen group's to-dos (title, submissionMode, description, notes) as a custom template"
    - "The migration script merges per-group phases by trimmed lower-case name, keeps every to-do (re-pointed to the surviving phase with group_id = its old phase's group), writes progress rows, is idempotent, and rolls back under --dry-run"
    - "After the migration EVERY to-do has a non-null group_id, including to-dos that already sat on a survivor phase (remap holds one entry per ORIGINAL phase row, survivors self-mapped)"
    - "Student node-path home, stepper and to-do pages look and behave exactly as before"
  artifacts:
    - path: "src/db/schema/groupPhaseProgress.ts"
      provides: "group_phase_progress table with unique(group_id, phase_id)"
      contains: "group_phase_progress"
    - path: "src/db/schema/phases.ts"
      provides: "phases.classroom_id (no group_id, no status)"
      contains: "classroom_id"
    - path: "src/db/schema/todos.ts"
      provides: "todos.group_id NOT NULL + todos.assignment_id"
      contains: "assignment_id"
    - path: "src/db/migrations/phase-merge-plan.ts"
      provides: "Pure merge planner (old rows -> survivors, one remap entry per original phase row incl. survivor self-maps, deletes, progress matrix)"
      exports: ["planPhaseMerge"]
    - path: "src/db/migrations/2026-10-03-classroom-phases.ts"
      provides: "Idempotent transactional data migration with --dry-run / --apply"
      min_lines: 120
    - path: "src/lib/phase-progress.ts"
      provides: "Pure progress sync planner used after phase create/reorder/archive/restore and group create"
      exports: ["planProgressSync"]
    - path: "src/lib/node-path.ts"
      provides: "resolveGroupPhaseStatuses (default rule for missing rows)"
      exports: ["resolveGroupPhaseStatuses"]
    - path: "src/server/phase-helpers.ts"
      provides: "assertClassroomEditor, getPhaseClassroomId, syncClassroomProgress"
      exports: ["syncClassroomProgress", "assertClassroomEditor"]
    - path: "src/components/todo/assign-todo-dialog.tsx"
      provides: "Multi-group to-do creation form (group checkboxes + ทุกกลุ่ม)"
    - path: "src/components/phase/group-phase-board.tsx"
      provides: "Teacher group page: classroom phases, per-group status + manual control, this group's to-dos"
  key_links:
    - from: "src/server/queries/phase.ts getActivePhases(groupId)"
      to: "group_phase_progress + todos.group_id"
      via: "classroom phases joined with this group's to-dos; status via resolveGroupPhaseStatuses"
      pattern: "resolveGroupPhaseStatuses"
    - from: "src/server/queries/submission.ts resolveStudentTodoAccess"
      to: "todos.group_id"
      via: "groupId = todo.groupId; phase.status resolved for that group"
      pattern: "todo\\.groupId"
    - from: "src/components/todo/assign-todo-dialog.tsx"
      to: "createTodo({ phaseId, groupIds, ... })"
      via: "server action call"
      pattern: "groupIds"
    - from: "src/server/actions/phase.ts and src/server/actions/group.ts"
      to: "syncClassroomProgress"
      via: "called after phase create/reorder/archive/restore and group create"
      pattern: "syncClassroomProgress"
    - from: "src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx"
      to: "Phase tab (PhaseList / TemplatePicker / SaveTemplateDialog)"
      via: "TabsTrigger value=\"phases\""
      pattern: "value=\"phases\""
---

<objective>
Move phases from group level to classroom level, store each group's phase status in a new `group_phase_progress`
table, scope to-dos to (phase, group) with multi-group assignment, adapt templates, and ship a reviewed, idempotent
data migration script. The executor does NOT apply the migration. The orchestrator does.

Purpose: the user's content model is "same fixed phases per classroom, different tasks per group"
(261003-wuo-CONTEXT.md). The current schema (`phases.group_id`) cannot express that.
Output: new schema, a migration script (dry-run only), an updated data layer, teacher UI (classroom Phase tab,
per-group board, multi-group assign) and an unchanged student UI.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261003-wuo-classroom-level-fixed-phases-with-per-gr/261003-wuo-CONTEXT.md
@.planning/quick/260928-jkg-apply-cocoon-ui-ci-to-teacher-and-admin-/260928-jkg-SUMMARY.md
@AGENTS.md

<hard_rules>
- NEVER run `drizzle-kit push`, `drizzle-kit migrate`, or the migration script with `--apply`. The DATABASE_URL in
  .env.local is shared with the live site. The only allowed DB contact is running
  `npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --dry-run` at the end of Task 1 (it always rolls back).
  If it errors, fix the script and re-run `--dry-run`. Never write data in any other way, and never run seed scripts.
- No Figma MCP calls.
- Next.js is 16.3. `params` / `searchParams` are Promises. Check `node_modules/next/dist/docs/` if unsure.
- Lint baseline: `npx eslint .` reports 10 errors (in use-mobile.ts and auth.test.ts). Add no new errors.
- Thai UI copy. Use the Cocoon CI tokens from `src/components/cocoon/ui.ts` (CARD, CARD_TITLE, BTN_PRIMARY, BTN_INFO,
  BTN_TERTIARY, EMPTY_CARD, PAGE_BODY, SEGMENT_LIST, SEGMENT_TRIGGER, ADD_ROW, INPUT, PILL).
- Locked decisions (CONTEXT `<decisions>`):
  D-1: phases are fixed per classroom and to-dos are per group.
  D-2: for multi-group assignment, the teacher selects groups and each gets an independent copy (shared assignment_id, no sync).
  D-3: phase unlocking is per group.
  Out of scope: auto-unlock on approval (Phase 4), review/comments, copying attachments in templates, LINE, R2.
</hard_rules>

<interfaces>
<!-- Current code, extracted. The executor should not need to explore further. -->

Current src/db/schema/phases.ts columns: id, groupId (FK groups cascade, NOT NULL), name, description, orderIndex,
status text enum('locked','active','completed') default 'locked', isFreeAccess, isArchived, deadline, createdBy,
createdAt, updatedAt.
Current src/db/schema/todos.ts `todos`: id, phaseId (FK phases cascade), title, description, notes, orderIndex,
submissionMode enum('group','individual'), isArchived, deadline, createdBy, createdAt, updatedAt. Also `todoAttachments`.
Live data (shared DB, confirmed by checker): 1 classroom "Cocoon 2026"; 3 groups A, AFFY, m. A and AFFY each have one
phase named "Market Research" (A's row is older -> survivor). Group m has 0 phases. 3 to-dos: 2 on A's phase, 1 on AFFY's.
0 submissions. Expected migration result: 1 classroom phase "Market Research"; to-dos (A, A, AFFY) all with group_id set
and phase_id = A's phase; progress rows for A, AFFY (their old statuses) and m (default: active, since it is the first phase).
IDs: `createId` from '@/lib/ids' (cuid2 `init({ length: 24 })`). DB: `db` from '@/db' (drizzle neon-serverless Pool; transactions work).
Auth: `requireRole(...roles): Promise<UserRole>`, `getCurrentUserId()`, `getCurrentRole()` in '@/lib/auth'; ROLES in '@/lib/constants'.
Classroom ownership pattern (src/server/actions/classroom.ts): `classrooms.createdBy === currentUserId`.

Current server API (all of it changes in Task 1):
- actions/phase.ts: createPhase({groupId,name,description?}), updatePhase({phaseId,name?,description?,isFreeAccess?,deadline?}), reorderPhases({groupId,orderedIds}), archivePhase({phaseId}), restorePhase({phaseId})
- actions/todo.ts: createTodo({phaseId,title,submissionMode?}), updateTodo(...), reorderTodos({phaseId,orderedIds}), archiveTodo, restoreTodo, getAttachmentDownloadUrl
- actions/template.ts: applyTemplate({groupId,templateId}), saveAsTemplate({groupId,name,description?}), deleteTemplate
- queries/phase.ts: getActivePhases(groupId) -> phases[] with nested non-archived todos; getPhaseById; getArchivedPhases(groupId)
- queries/todo.ts: getActiveTodos(phaseId); getTodoById; getTodoDetail(todoId,userId) -> todo with phase.group.classroom (used by app/(dashboard)/todo/[todoId]/page.tsx as `todo.phase.group.classroom`)
- queries/submission.ts: resolveStudentTodoAccess(todoId,userId) -> {todo, phase, groupId, classroomId}. groupId currently comes from todo.phase.groupId; phase.status is used by isPhaseViewable in actions/submission.ts.
- queries/group.ts: getGroupsByClassroom(classroomId) -> {id,name,createdBy,createdAt,memberCount}[]; getGroupById(groupId,userId) -> group + members (null if no classroom membership).
- lib/node-path.ts: PhaseLike = {status, isFreeAccess}; isPhaseViewable, computeLockedTodoIds, pickDefaultPhaseId, pickCurrentPhaseIndex, buildNodeRows, pickCurrentTodoId.

Current UI:
- Teacher classroom page: Tabs `groups` / `settings` in PageHeader actions (SEGMENT_LIST/SEGMENT_TRIGGER).
- Teacher group page: `<PhaseList initialPhases={phases} groupId>` (sortable PhaseItem with collapsible TodoList, InlineAddPhase, status pill using statusLabels/statusColors/statusDots in phase-item.tsx).
- TodoList (sortable TodoItem + InlineAddTodo with title + submissionMode Select), TodoItem uses `group: \`todos-${todo.phaseId}\`` for DnD.
- Student group page (`student/classroom/[classroomId]/group/[groupId]/page.tsx`): teacher branch shows TemplatePicker when there are no phases, otherwise GroupPhaseView. The student branch uses PhaseStepper + NodePath/NodePathDesktop driven by getActivePhases + node-path helpers.

Consumers of getActivePhases(groupId): the teacher group page and the student group page. Keep the SAME function name,
signature and return shape (phase fields + `status` + `todos`) so the student UI needs no visual change. Only `groupId`
on the phase is replaced by `classroomId`.
There is no Checkbox in src/components/ui. Use native `<input type="checkbox" className="size-4 accent-cocoon-blue">` with a `<label>`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Schema, migration script (with unit-tested merge planner), progress helpers, and the full server data layer</name>
  <files>
    src/db/schema/{phases,todos,groupPhaseProgress,relations,index}.ts, src/db/__tests__/schema.test.ts,
    src/db/migrations/phase-merge-plan.ts, src/db/migrations/__tests__/phase-merge-plan.test.ts,
    src/db/migrations/2026-10-03-classroom-phases.ts, src/db/seed/templates.ts,
    src/lib/{node-path,phase-progress,template-structure}.ts, src/lib/__tests__/{node-path,phase-progress}.test.ts,
    src/server/phase-helpers.ts, src/server/actions/{phase,todo,template,group}.ts,
    src/server/queries/{phase,todo,template,submission}.ts,
    and the minimal compile fixes in the call sites listed in step E
  </files>
  <behavior>
    planPhaseMerge (src/db/migrations/__tests__/phase-merge-plan.test.ts):
    - Two groups with one phase each and different names -> 2 classroom phases. Each to-do keeps its phase row. Progress matrix:
      group A {P1: A's old status, P2: 'locked'}, group B {P1: 'locked', P2: B's old status}. A group that already has an explicit row never gets a default 'active'.
    - Two groups, "Research " and "research" -> 1 survivor, the earliest createdAt (tie -> smaller id). The other row is
      in `deletePhaseIds`, and its to-dos are remapped to the survivor with group_id = the old phase's group.
    - One group has two rows with the same name key -> both map to one survivor. Progress status = the most advanced
      (completed > active > locked).
    - Survivor isArchived = true only if ALL merged rows were archived.
    - Merged order: iterate groups by their earliest phase createdAt, and phases by orderIndex. The first appearance
      of a name key fixes its position. Final orderIndex is renumbered 0..n-1.
    - A group with zero old phases gets the default matrix (first non-archived = active, the rest locked).
    - Two classrooms are planned independently. Empty input -> empty plan.
    - remap completeness (BLOCKER fix): `remap` holds EXACTLY one entry per ORIGINAL phase row. Survivors self-map
      (`oldPhaseId === survivorId`, groupId = the survivor row's own group). Tests:
      (a) no-merge case (2 groups, different names) -> `remap.length === 2` (total old phase count), every entry is a self-map
          with the right groupId, `deletePhaseIds` is empty.
      (b) merge case ("Research " in A created first, "research" in B) -> remap contains the survivor self-entry
          `{oldPhaseId: A1, survivorId: A1, groupId: A}` AND the deleted-row entry `{oldPhaseId: B1, survivorId: A1, groupId: B}`;
          `remap.length === 2`; `deletePhaseIds === [B1]`.
      (c) live-data fixture: classroom C with groups A, AFFY, m; A has "Market Research" (older), AFFY has "Market Research"
          (newer), m has none. Simulate todos [A-phase, A-phase, AFFY-phase] by mapping each todo's phaseId through remap
          (build `Map(oldPhaseId -> entry)`): every todo resolves to an entry (no undefined -> group_id never null),
          groups resolve to [A, A, AFFY], all phase ids resolve to A's phase. `progress` contains a row for m on the
          survivor with status 'active' (first phase default), plus A and AFFY rows with their old statuses.
    resolveGroupPhaseStatuses (added to node-path.test.ts): no rows -> first phase active, rest locked; explicit rows win;
      mixed (a row for phase 2 only) -> phase 1 default active, phase 2 explicit; empty phases -> {}.
    planProgressSync (phase-progress.test.ts):
    - A "pristine" group (no 'completed' rows, at most one 'active', and no submissions in its active phase) is re-derived
      to the default after a reorder: old first phase active -> locked, new first -> active. Only changed or missing rows are emitted.
    - A non-pristine group (has a completed row, has submissions in its active phase, or has 2 actives) keeps its existing rows;
      only missing rows are inserted, as 'locked'.
    - A new group with no rows -> the full default matrix is emitted.
  </behavior>
  <action>
**Commit incrementally inside this task** (it touches ~29 files). Make four commits, each with `npx vitest run` on the touched
tests passing and `npx tsc --noEmit` passing where feasible (tsc may stay red between commit 1 and commit 4 because the server
layer still references removed columns; that is acceptable, but note it in the commit body):
  1. `feat(261003-wuo): classroom-level phase schema + group_phase_progress` (step A)
  2. `feat(261003-wuo): pure progress/merge helpers with tests` (steps B + phase-merge-plan.ts and its tests)
  3. `feat(261003-wuo): classroom-phases migration script (dry-run only)` (rest of step C, then the step F dry-run)
  4. `feat(261003-wuo): server data layer on classroom phases` (steps D + E; tsc must be clean here)

**A. Schema (Drizzle). It must match what the migration produces, so a later `drizzle-kit push` is a no-op:**
- `phases.ts`: replace `groupId` with `classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' })` and delete `status`. Keep all other columns.
- New `groupPhaseProgress.ts`: `export const PHASE_STATUSES = ['locked','active','completed'] as const; export type PhaseStatus = typeof PHASE_STATUSES[number];`.
  Table `group_phase_progress`: `id` text PK `$defaultFn(() => createId())`, `groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' })`,
  `phaseId: text('phase_id').notNull().references(() => phases.id, { onDelete: 'cascade' })`, `status: text('status', { enum: PHASE_STATUSES }).notNull().default('locked')`,
  `updatedAt: timestamp('updated_at').defaultNow().notNull()`, and `(t) => [unique().on(t.groupId, t.phaseId)]` (default name `group_phase_progress_group_id_phase_id_unique`).
- `todos.ts`: add `groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' })` and `assignmentId: text('assignment_id')` (nullable).
- `relations.ts`: classrooms many phases; phases one classroom (`phases.classroomId`), many todos, many progress; groups many todos and many progress (remove `groups.phases`); todos one group (`todos.groupId`); new `groupPhaseProgressRelations` (one group, one phase). Export from `index.ts`. Add `groupPhaseProgress` and its relations to `src/db/__tests__/schema.test.ts`.

**B. Pure helpers (unit-tested, no DB imports). Write the failing tests first:**
- `src/lib/node-path.ts`: export `type PhaseStatus` (declare it locally, with no schema import, so the module stays pure) and
  `resolveGroupPhaseStatuses(phases: {id: string}[] /* non-archived, ordered */, rows: {phaseId: string; status: PhaseStatus}[]): Record<string, PhaseStatus>`, which implements the missing-row default. Keep every existing export unchanged.
- `src/lib/phase-progress.ts`: `planProgressSync({ phaseIds: string[] /* non-archived, ordered */, groups: { groupId: string; rows: {phaseId: string; status: PhaseStatus}[]; phaseIdsWithSubmissions: string[] }[] }): { groupId: string; phaseId: string; status: PhaseStatus }[]`, following the behavior block. The result is a list of upserts.
- `src/lib/template-structure.ts`: `TemplateTodo {title; submissionMode?; description?; notes?}`, `TemplatePhase {name; description?; todos: TemplateTodo[]}`, `TemplateStructure {phases}`, and `parseTemplateStructure(json: string): TemplateStructure`. Make it tolerant (missing todos -> [], unknown fields ignored) so old templates still parse. Use it in actions/template.ts, queries/template.ts and seed/templates.ts, replacing their local interfaces. Built-in template data stays unchanged.

**C. Migration (location under `src/db/migrations/` is Claude's discretion per CONTEXT):**
- `phase-merge-plan.ts` (pure). Input: `{ groups: {id; classroomId}[]; phases: {id; groupId; classroomId; name; orderIndex; status; isArchived; createdAt: Date}[] }`. Output per classroom:
  `{ classroomId; survivors: {phaseId; orderIndex; isArchived}[]; remap: {oldPhaseId; survivorId; groupId}[]; deletePhaseIds: string[]; progress: {groupId; phaseId; status}[] }`.
  **`remap` MUST contain exactly one entry per ORIGINAL phase row** — survivors included as self-maps
  (`oldPhaseId === survivorId`, `groupId` = that row's group) — never only the merged-away rows. Otherwise to-dos already on a
  survivor phase never receive group_id and the NOT NULL assertion fails (live data: 2 to-dos on A's surviving
  "Market Research"). Add an internal invariant: `remap.length === input phases count for that classroom`. Name key = `name.trim().toLowerCase()`. Progress matrix for every (group, survivor): the status from that group's merged old rows (most advanced); otherwise 'locked' if the group has any explicit row in that classroom; otherwise the default rule.
- `2026-10-03-classroom-phases.ts` (run with `npx tsx`). Load env with `dotenv` (`.env.local`, then `.env`). Connect with `Pool` from `@neondatabase/serverless` plus `ws` (`neonConfig.webSocketConstructor = ws`), using `DATABASE_URL_UNPOOLED ?? DATABASE_URL`. Use relative imports only (`./phase-merge-plan`, `../../lib/ids`) and do NOT import `@/db`. Require exactly one of `--dry-run` / `--apply`. With neither, print usage and exit 1 (safer than defaulting to apply). Run all steps on one pool client inside `BEGIN … COMMIT|ROLLBACK`:
  1. Guard: if `information_schema.columns` has no `phases.group_id` AND has `phases.classroom_id`, print "already migrated" with counts and exit 0 (idempotent).
  2. Print the BEFORE summary: counts of classrooms, groups, phases, todos and submissions, plus the phases per classroom with names and owning group.
  3. `CREATE TABLE IF NOT EXISTS group_phase_progress (...)` with constraints named exactly as Drizzle names them: `group_phase_progress_group_id_groups_id_fk` and `group_phase_progress_phase_id_phases_id_fk` (both ON DELETE cascade), and `group_phase_progress_group_id_phase_id_unique`. status is text NOT NULL default 'locked'; updated_at is timestamp NOT NULL default now().
     Then `ALTER TABLE phases ADD COLUMN IF NOT EXISTS classroom_id text` and `ALTER TABLE todos ADD COLUMN IF NOT EXISTS group_id text, ADD COLUMN IF NOT EXISTS assignment_id text`.
  4. Read phases joined with groups (for classroom_id) and all groups, then run `planPhaseMerge`. Apply it: `UPDATE phases SET classroom_id, order_index, is_archived` for survivors. For EVERY remap entry (self-maps included), run `UPDATE todos SET group_id=$groupId, phase_id=$survivorId WHERE phase_id=$oldPhaseId AND group_id IS NULL`.
  The `AND group_id IS NULL` guard is required: without it, a survivor self-entry processed after a merged entry would
  overwrite the group_id of to-dos just moved onto the survivor. Sum the rowCounts and assert the total equals the BEFORE to-do count
  (every to-do is touched exactly once). Insert progress rows (`id` via createId) with `ON CONFLICT (group_id, phase_id) DO UPDATE SET status = EXCLUDED.status`. Then `DELETE FROM phases WHERE id = ANY($deleteIds)`. To-dos were re-pointed first, so the cascade deletes nothing; assert the to-do count is unchanged.
  5. Assert there is no `todos.group_id IS NULL` and no `phases.classroom_id IS NULL` (throw -> rollback). Then `ALTER … SET NOT NULL` and add FKs `phases_classroom_id_classrooms_id_fk` (-> classrooms(id) ON DELETE cascade) and `todos_group_id_groups_id_fk` (-> groups(id) ON DELETE cascade), each guarded by a `pg_constraint` existence check.
  6. `ALTER TABLE phases DROP COLUMN group_id, DROP COLUMN status`.
  7. Print the AFTER summary: the same counts, the per-classroom phase list, progress rows per group, and to-dos per (group, phase). Assert the todos and submissions counts equal BEFORE. Then `ROLLBACK` if `--dry-run` (print "DRY RUN — rolled back"), otherwise `COMMIT`. Always release the client and call `pool.end()` in `finally`.
  Add a header comment with the exact run commands and a warning that only the orchestrator runs `--apply`, after review.

**D. Server data layer:**
- `src/server/phase-helpers.ts` (plain module, no 'use server'):
  - `type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]`.
  - `assertClassroomEditor(classroomId, userId)`: passes for the owner via `classrooms.createdBy` or for role superadmin via getCurrentRole; otherwise throws 'Classroom not found or not authorized'.
  - `getPhaseClassroomId(phaseId)`.
  - `syncClassroomProgress(tx: DbLike, classroomId)`: load the non-archived phases in order, the groups, the progress rows, and submission existence per (group, phase) (`submissions` inner join `todos` on todo_id, grouped by submissions.group_id + todos.phase_id). Call `planProgressSync`, then upsert with `onConflictDoUpdate({ target: [groupPhaseProgress.groupId, groupPhaseProgress.phaseId], set: { status, updatedAt: new Date() } })`.
- `actions/phase.ts`:
  - `createPhase({classroomId, name, description?})`, `reorderPhases({classroomId, orderedIds})` (validate that the ids belong to the classroom and are non-archived), `archivePhase`, `restorePhase`: each does an editor check, runs in `db.transaction` and calls `syncClassroomProgress`. `restorePhase` appends the phase at the end (orderIndex = max + 1).
  - `updatePhase`: unchanged apart from the editor check.
  - New `setGroupPhaseStatus({groupId, phaseId, status})`: verify group.classroomId === phase.classroomId, run the editor check, upsert the row. This is D-3's manual unlock/complete, with no automatic logic.
- `actions/todo.ts`:
  - `createTodo({phaseId, groupIds: string[] (min 1, deduped), title, submissionMode?, description?, notes?})`: verify every group belongs to the phase's classroom. Set `assignmentId = groupIds.length > 1 ? createId() : null`. For each group, nextOrder = max(orderIndex) for (phaseId, groupId, non-archived) + 1. Insert everything in one transaction and return `{ success: true, todoIds }` (D-2: independent copies, no sync).
  - `reorderTodos({phaseId, groupId, orderedIds})` validates both phaseId and groupId.
  - update, archive and restore stay unchanged.
- `actions/template.ts`:
  - `applyTemplate({classroomId, templateId, groupIds: string[] /* may be [] */})`: run the editor check. If the classroom has ANY non-archived phase, throw `'ห้องเรียนนี้มี Phase อยู่แล้ว — เก็บ Phase เดิมก่อนใช้เทมเพลต'`. In one transaction, insert the phases (orderIndex i). For each template to-do, create one copy per selected group, with a shared assignmentId when there is more than 1 group and with description/notes/submissionMode carried over. Then call `syncClassroomProgress`. Return `{success, phaseCount, todoCount}`.
  - `saveAsTemplate({classroomId, groupId?: string, name, description?})`: take the non-archived phases in order. The to-dos are the chosen group's non-archived to-dos per phase (none if there is no groupId). Serialize title, submissionMode, description and notes. Attachments are not copied (discretion).
- `actions/group.ts createGroup`: after the insert, call `syncClassroomProgress(db, classroomId)` so the new group gets default rows.
- `queries/phase.ts`:
  - Keep `getActivePhases(groupId)` with the same name and shape: phase fields + `classroomId` + `status` + `todos`. Look up the group's classroomId. Load phases where classroomId matches and not archived, in order, with `todos: { where: and(eq(todos.groupId, groupId), eq(todos.isArchived, false)), orderBy: [asc(todos.orderIndex)] }`. Load the group's progress rows and attach `status` via `resolveGroupPhaseStatuses`. Return [] if the group is missing.
  - Add `getClassroomPhases(classroomId)` (non-archived, no todos), `getArchivedPhases(classroomId)` and `getGroupPhaseStatus(groupId, phaseId)` (the row, or the default).
  - Update or remove `getPhaseById` (it is unused outside this file).
- `queries/todo.ts`: `getActiveTodos(phaseId, groupId)`. `getTodoDetail` loads `with: { attachments: true, phase: true, group: { with: { classroom: true } } }` and checks membership through `todo.group.classroomId`.
- `queries/submission.ts resolveStudentTodoAccess`: load `with: { attachments: true, phase: true, group: true }`. Return null if the to-do or its phase is archived. Set `groupId = todo.groupId` and `classroomId = todo.group.classroomId`. Keep the classroom and group membership checks. Return `phase: { ...todo.phase, status: await getGroupPhaseStatus(groupId, todo.phaseId) }` so `isPhaseViewable(access.phase)` in actions/submission.ts keeps working unchanged.
- `queries/template.ts getTemplateById`: use `parseTemplateStructure`.

**E. Minimal compile fixes only (Task 2 redesigns these files):**
- `app/(dashboard)/todo/[todoId]/page.tsx`: `const group = todo.group; const classroom = group.classroom;`.
- Components that call changed signatures (inline-add-phase, phase-list, phase-item, inline-add-todo, todo-list, template-picker), plus the teacher group page and the teacher branch of the student group page: pass the new args (classroomId, `groupIds: [groupId]`, groupId) with the smallest edit that compiles.
- Replace hand-written `Phase`/`Todo` prop types with `Awaited<ReturnType<typeof getActivePhases>>[number]` (and its `['todos'][number]`) via `import type`.

**F. Last step of the task:** run the dry-run once (see hard_rules) and paste its BEFORE/AFTER output into the SUMMARY. If DATABASE_URL is a placeholder or unreachable, skip it and say so.
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx vitest run src/db src/lib && npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && ! grep -rnE "phases\.groupId|phase\.groupId|todo\.phase\.group|phases\.status" src --include="*.ts" --include="*.tsx"</automated>
  </verify>
  <done>
    The new merge-planner, progress-sync and resolveGroupPhaseStatuses tests pass, along with all existing tests. `tsc --noEmit` is clean. eslint still reports exactly
    10 errors. There are no references to `phases.groupId` or `phases.status`. The migration script exists, refuses to run without a flag, and has been
    exercised only with `--dry-run` (output captured in the SUMMARY, or the skip reason stated).
  </done>
</task>

<task type="auto">
  <name>Task 2: Teacher UI: classroom Phase tab, template apply/save, group board with manual status and multi-group assign</name>
  <files>
    src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx,
    src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx,
    src/components/phase/{phase-list,phase-item,inline-add-phase,archived-phase-list,group-phase-board,group-phase-status-select}.tsx,
    src/components/todo/{todo-list,todo-item,inline-add-todo,assign-todo-dialog}.tsx,
    src/components/template/{template-picker,save-template-dialog}.tsx
  </files>
  <action>
**Preserve concurrent work on main:** before this task lands, main gains Clerk display names for classroom members
(new `src/lib/user-directory.ts`; `getClassroomById` members gain `name/email/imageUrl`, and groups gain member display lists;
`assign-student-dialog.tsx`, `classroom-settings-form.tsx`, `group-card.tsx` show names). When editing the teacher classroom page,
keep those fields and components intact: do not drop props passed to them, do not revert `getClassroomById` usage, and do not
modify `user-directory.ts`, `assign-student-dialog.tsx`, `classroom-settings-form.tsx` or `group-card.tsx`. Re-read the page
from disk before editing rather than relying on the snapshot in this plan. Where the group board / assign dialog lists groups,
the `{id, name}` shape is enough; do not refetch member names.

Use Cocoon CI from 260928-jkg (CARD, CARD_TITLE, BTN_*, EMPTY_CARD, PAGE_BODY, SEGMENT_*), Thai copy, `useTransition` + `router.refresh()` after actions, and `toast` from sonner for errors and successes, matching the existing components. The layout is Claude's discretion (CONTEXT).

1. **`assign-todo-dialog.tsx` (new, D-2):** a client component built on `@/components/ui/dialog`. Props: `{ phaseId; phaseName; groups: {id; name}[]; defaultGroupIds: string[]; trigger?: ReactNode; onCreated?: () => void }`. Fields: title (Input, required), submission mode (the existing Select: กลุ่ม / รายบุคคล), and a group checklist made of native checkboxes plus a top "ทุกกลุ่ม" checkbox (checked when all are selected; toggling it selects or clears all). The submit button "เพิ่มงาน" is disabled until the title is set and at least one group is selected. It calls `createTodo({ phaseId, groupIds, title, submissionMode })` and shows the toast `เพิ่มงานให้ ${n} กลุ่มแล้ว`. Reset the form on close.
2. **`inline-add-todo.tsx`:** becomes the "เพิ่มงาน" ADD_ROW button that opens AssignTodoDialog, with the current group pre-checked. Props: `{ phaseId; phaseName; groupId; groups; onCreated }`. **`todo-list.tsx`:** add `groupId` and `groups` props, pass `groupId` to `reorderTodos`, and render the new InlineAddTodo. **`todo-item.tsx`:** DnD group key `todos-${todo.phaseId}-${todo.groupId}`.
3. **Classroom-level phase list (D-1):**
   - `phase-list.tsx`: props `{ classroomId; initialPhases: ClassroomPhase[]; groups: {id; name}[] }`, where `ClassroomPhase = Awaited<ReturnType<typeof getClassroomPhases>>[number]`. Keep the existing DnD reorder, now calling `reorderPhases({ classroomId, orderedIds })`. Sync local state when `initialPhases` changes (key the list on the joined ids in the parent, or use a useEffect).
   - `phase-item.tsx`: sortable card with index, name, description, deadline and free-access PILLs. The dropdown keeps edit (existing PhaseEditForm) and archive, and gains "เพิ่มงานให้หลายกลุ่ม", which opens AssignTodoDialog with `defaultGroupIds=[]`. Remove the per-phase status pill and the nested TodoList, since status and to-dos are per group now. Move `statusLabels/statusColors/statusDots` into `group-phase-status-select.tsx` and export them.
   - `inline-add-phase.tsx`: prop `classroomId`, calls `createPhase({ classroomId, name })`.
   - `archived-phase-list.tsx` (new): a collapsible "Phase ที่เก็บไว้ (n)" list, where each row has a "กู้คืน" button calling `restorePhase`. Render nothing when there are none.
4. **Templates:**
   - `template-picker.tsx`: props `{ classroomId; templates; groups: {id; name}[] }`. Above the template cards, add the checklist "เพิ่มงานจากเทมเพลตให้กลุ่ม" with checkboxes and "ทุกกลุ่ม", all checked by default (the user may uncheck everything to create phases only). Apply calls `applyTemplate({ classroomId, templateId, groupIds })`; surface the server's Thai refusal error via toast.
   - `save-template-dialog.tsx` (new): a "บันทึกเป็นเทมเพลต" button that opens a dialog with name (required), description, and a Select "ใช้งานของกลุ่ม" (groups + "ไม่รวมงาน" = no groupId). It calls `saveAsTemplate({ classroomId, groupId, name, description })` and shows the toast "บันทึกเทมเพลตแล้ว".
5. **Teacher classroom page:**
   - Accept `searchParams: Promise<{ tab?: string }>` and set the Tabs `defaultValue` to `tab === 'phases' ? 'phases' : tab === 'settings' ? 'settings' : 'groups'`.
   - Add `<TabsTrigger value="phases" className={SEGMENT_TRIGGER}>Phase</TabsTrigger>` between กลุ่ม and ตั้งค่า.
   - Fetch `getClassroomPhases`, `getArchivedPhases`, and `getTemplates(userId)` in parallel with the groups.
   - Phase tab content: a header row "Phase ของห้องเรียน (n)" with SaveTemplateDialog (only when n > 0). If n === 0, show an EMPTY_CARD hint, then TemplatePicker, then InlineAddPhase (manual alternative). Otherwise show PhaseList and ArchivedPhaseList.
6. **Teacher group page and `group-phase-board.tsx`:**
   - The page fetches `getActivePhases(groupId)` (group-scoped, with status) and `getGroupsByClassroom(classroomId)`. The PageHeader subtitle is "Phase ของห้องเรียน · งานของกลุ่มนี้", with an action Link "จัดการ Phase" (BTN_INFO) to `/teacher/classroom/${classroomId}?tab=phases`.
   - The empty state (no classroom phases) is an EMPTY_CARD "ห้องเรียนนี้ยังไม่มี Phase" with that same link.
   - `group-phase-board.tsx` (client): one collapsible CARD per phase, in order (no phase DnD here). The header shows the index, name, and the status pill for this group. The body has `GroupPhaseStatusSelect` (a Select with ล็อก / กำลังดำเนินการ / เสร็จสิ้น that calls `setGroupPhaseStatus({ groupId, phaseId, status })`; toast "อัปเดตสถานะแล้ว"; D-3) and `TodoList` with this group's to-dos (edit, reorder, archive via the existing TodoItem/TodoEditForm) plus the เพิ่มงาน row (this group pre-checked, other groups optional).
   - Open the active phase by default.
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && grep -q 'value="phases"' "src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx" && grep -q "groupIds" src/components/todo/assign-todo-dialog.tsx && grep -q "setGroupPhaseStatus" src/components/phase/group-phase-status-select.tsx</automated>
  </verify>
  <done>
    The classroom page has a Phase tab (deep-linkable with ?tab=phases) with add/edit/reorder/archive/restore, a template picker with group
    selection when empty, and บันทึกเป็นเทมเพลต. The group page lists the classroom phases with this group's status, a manual status Select,
    and this group's to-dos. The เพิ่มงาน dialog creates copies for the checked groups. tsc is clean, lint is at 10 errors, tests are green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Student pages and to-do page on the new data, access regression checks, production build</name>
  <files>
    src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx,
    src/app/(dashboard)/todo/[todoId]/page.tsx,
    src/server/queries/submission.ts, src/server/queries/todo.ts (only if a check below fails)
  </files>
  <action>
1. **Student group page:**
   - Student branch: keep the markup identical. `getActivePhases(groupId)` already returns the classroom phases with this group's `status` and to-dos, so PhaseStepper, `pickDefaultPhaseId`, `computeLockedTodoIds`, NodePath and NodePathDesktop are fed the same shapes. Confirm that with tsc and by reading the code. Do not restyle anything.
   - Teacher branch: when there are no phases, replace the TemplatePicker with an EMPTY_CARD "ห้องเรียนนี้ยังไม่มี Phase" and a Link (BTN_INFO) to `/teacher/classroom/${classroomId}?tab=phases`. Drop the now-unused `getTemplates`/TemplatePicker imports. Otherwise keep GroupPhaseView (it reads `phase.status` + `todos`, which are now group-scoped).
2. **To-do page:** the teacher/superadmin branch uses `todo.group` / `todo.group.classroom` / `todo.phase`. The back link and editor link go to `/teacher/classroom/${classroom.id}/group/${group.id}`. The subtitle `${classroom.name} · ${group.name} · ${phase.name}` stays. The student branch (StudentTodoView -> getSubmissionHistory -> resolveStudentTodoAccess) needs no change beyond Task 1. Verify that `student-todo-view.tsx` only reads fields that still exist on `phase` (name, id, status, isFreeAccess).
3. **Access regression review (read the code and fix only if it is wrong):**
   - (a) `resolveStudentTodoAccess` rejects a student who is a classroom member but not in `todo.groupId`.
   - (b) `getActivePhases` filters to-dos by `todos.groupId = groupId`, and the student page still redirects students who are not members of the group.
   - (c) `createSubmission` stores `groupId = todo.groupId`, and `revalidatePath` uses that group.
   - (d) `createTodo` and `setGroupPhaseStatus` reject a groupId from another classroom.
   - (e) `applyTemplate` refuses a classroom that already has phases.
   List each check as PASS/FIXED in the SUMMARY.
4. **Leftover sweep:** `grep -rnE "phases\.groupId|phase\.group\b|todo\.phase\.group|groupId=\{groupId\} templates" src` must be empty. Also confirm `drizzle.config.ts` is untouched and no file under `drizzle/` was generated.
5. Run the full checks and `npm run build`. If the build fails only because of missing env at build time (not because of code), note it in the SUMMARY with the exact error. Fix any code-caused failure.
6. In the SUMMARY, add an "Orchestrator: apply migration" section with the exact commands:
   `npx tsx src/db/migrations/2026-10-03-classroom-phases.ts --dry-run`, then `--apply`, then `npx drizzle-kit push` (expected no-op, verify it shows no changes), then deploy. Note that the live site will error on phase queries between the deploy and the migration, so apply the migration immediately before or after deploying.
  </action>
  <verify>
    <automated>cd "/Users/jharit/Desktop/Innovators Tech/duo" && npx tsc --noEmit && npx eslint . 2>&1 | tail -3 && npm test 2>&1 | tail -5 && ! grep -rnE "phases\.groupId|todo\.phase\.group" src && npm run build 2>&1 | tail -25</automated>
  </verify>
  <done>
    The student home, stepper and to-do pages compile against the new data layer with unchanged markup. The teacher view of the student group page links to the
    classroom Phase tab when it is empty. Access checks (a)-(e) are recorded as PASS/FIXED. tsc is clean, lint is at 10 errors, all tests pass, and `npm run build` succeeds.
    The SUMMARY contains the dry-run output and the orchestrator's apply/deploy steps.
  </done>
</task>

</tasks>

<verification>
- `npm test`: the new suites (phase-merge-plan, phase-progress, the resolveGroupPhaseStatuses cases in node-path) and all existing suites pass.
- `npx tsc --noEmit` is clean. `npx eslint .` reports exactly 10 errors (baseline). `npm run build` succeeds.
- No source references `phases.groupId`, `phases.status`, or `todo.phase.group`.
- The migration script has only ever been run with `--dry-run`. Nothing has been applied to the shared DB, and drizzle-kit push has not run.
</verification>

<success_criteria>
- Phases are classroom-level (D-1). Per-group status lives in group_phase_progress with the missing-row default (D-3).
- To-dos are (phase, group). Multi-group creation makes independent copies with a shared assignment_id (D-2).
- Templates apply to a classroom (refused if phases exist) with optional to-dos for the selected groups. Save-as-template uses one chosen group's to-dos.
- The migration script preserves all to-dos and submissions, merges by name, is idempotent and dry-run capable, and is ready for orchestrator review.
- The student UI is visually and behaviourally unchanged.
</success_criteria>

<output>
After completion, create `.planning/quick/261003-wuo-classroom-level-fixed-phases-with-per-gr/261003-wuo-SUMMARY.md`
</output>
