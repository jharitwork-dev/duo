# Quick Task 261003-wuo: Classroom-level fixed phases, per-group tasks, multi-group assignment - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Task Boundary

The user (Thai) restated the content model: **"ในห้องเรียนเดียวกันทุกคนจะมี phase เดียวกันเป็น fix แต่งานรายกลุ่มจะต่างกัน"**.
Every group in a classroom has the SAME fixed phases, but the to-dos (งาน) inside each phase differ per group.

Today, phases belong to a group (`phases.group_id`) and to-dos belong to a phase. That has to change:

1. **Phases → classroom level.** `phases.group_id` is replaced by `phases.classroom_id` (FK classrooms, cascade). Name, description,
   orderIndex, deadline, isFreeAccess and isArchived stay on the phase. The teacher manages the phase list once per
   classroom (create, edit, reorder, archive/restore, and apply a built-in/custom template that creates the classroom's
   phases, and optionally its to-dos for selected groups — see 4).
2. **Per-group progress.** `phases.status` moves to a new table `group_phase_progress` with columns
   `id, group_id FK cascade, phase_id FK cascade, status enum('locked','active','completed') default 'locked',
   updated_at`, plus `unique(group_id, phase_id)`. Rule: a group's first (lowest orderIndex, non-archived) phase is
   `active` by default and the rest are `locked`. A missing row is treated with exactly that default, so reads never
   break. Write rows when phases or groups are created, and keep them consistent on reorder (if the first phase changes
   and a group has no submissions in the old first phase yet, the default rule still applies). Per-group unlocking is
   the user's decision. The automatic "approve all → unlock next phase" is Phase 4 and NOT in scope, but the table must
   support it. Teachers can manually set a group's phase status (unlock / mark completed) from the group view, since
   there is no other way to advance yet.
3. **To-dos → (phase, group).** Add `todos.group_id` (FK groups, cascade, NOT NULL after migration) and keep
   `todos.phase_id`. Add a nullable `todos.assignment_id` (text) shared by the copies created together by one multi-group
   assignment, for future "edit all copies". Submissions keep `group_id`.
4. **Assign one to-do to many groups (user decision: selectable groups).** When a teacher creates a to-do inside a
   classroom phase, they choose target groups (checkboxes: individual groups plus "ทุกกลุ่ม"). The server inserts one
   independent copy per selected group with a shared `assignment_id`. Copies are edited per group afterwards; no sync.
   The same multi-group choice applies when a template's to-dos are applied.
5. **Templates ("format").** Templates keep their JSON `structure` (phases → todos). Extend the todo shape to optionally carry
   `description` and `notes` (backwards compatible). Applying a template to a classroom:
   (a) creates the classroom phases if the classroom has none (refuse or ask if phases already exist — no silent duplication);
   (b) optionally adds the template's to-dos to the selected groups.
   "บันทึกเป็นเทมเพลต" saves the classroom's phases, plus the to-dos of one chosen group, as a custom template. Keep the 4 built-ins.

### Data migration (must preserve existing data — the DB is shared by dev AND the live site)
Current data: 1 classroom ("Cocoon 2026"), 3 groups (A, AFFY, m — m has 0 phases), 2 phases (one each for A and AFFY, both named "Market Research"), 3 to-dos (2 on A's phase, 1 on AFFY's), 0 submissions.
Write an idempotent, reviewed migration as a script under `src/db/migrations/` (or `scripts/`), runnable with
`npx tsx`, wrapped in a transaction:
- Create `group_phase_progress` and add `phases.classroom_id`, `todos.group_id` and `todos.assignment_id` (nullable first).
- For every classroom, merge the per-group phases **by (trimmed, case-insensitive) name** into one classroom phase. Keep
  the earliest-created phase row as the survivor, with its orderIndex / description / deadline / isFreeAccess, and append
  later unmatched names in order. For each old phase row, set `todos.group_id` = the old phase's group and
  `todos.phase_id` = the surviving phase. Write `group_phase_progress` from each old phase's status for its group, and
  delete the non-survivor phase rows.
- Set NOT NULL on `phases.classroom_id` / `todos.group_id`, then drop `phases.group_id` and `phases.status`.
- Print a before/after summary. Support a `--dry-run` flag that runs everything in a transaction and rolls back.
- Update the Drizzle schema files to match, so that a later `drizzle-kit push` is a no-op.
**The executor must NOT run the migration against the real database.** Test it against a throwaway local copy if possible,
or with `--dry-run` only. The orchestrator runs it after review, then deploys.

### Code to update (everything that touches phases/todos)
`src/db/schema/{phases,todos,relations,index}.ts` (+ new `groupPhaseProgress.ts`), `src/server/actions/{phase,todo,template,submission}.ts`,
`src/server/queries/{phase,todo,template,submission,group}.ts`, `src/lib/node-path.ts` (+ tests), `src/db/seed/templates.ts`,
teacher UI (`src/components/phase/*`, `src/components/todo/*`, `src/components/template/template-picker.tsx`,
teacher classroom + group pages), student pages/components (group home path, stepper, to-do page). Access checks: a student
only sees to-dos with `group_id` = their group; teachers see all groups in their classroom.

### Teacher UX (Cocoon CI from 260928-jkg; no Figma for this)
- Classroom page gets a **"Phase"** tab (alongside กลุ่ม / ตั้งค่า): the fixed phase list for the classroom with add / edit /
  reorder / archive, a template picker shown when it's empty, and "บันทึกเป็นเทมเพลต".
- Group page (teacher): the classroom phases in order. Each phase shows the group's status pill, a manual status control,
  and this group's to-dos with add / edit / reorder / archive. "เพิ่มงาน" opens a form with group checkboxes (this group
  pre-checked, others optional, plus a "ทุกกลุ่ม" toggle).
- Optionally, on the classroom "Phase" tab, each phase has "เพิ่มงานให้หลายกลุ่ม" (same form, no group pre-checked).
- Copy is Thai, matching existing wording.

Out of scope: Phase 4 review/approve/comments/auto-unlock, LINE notifications, R2 setup, schema changes beyond those listed above.
</domain>

<decisions>
## Implementation Decisions (locked by user)
- Phases are fixed per classroom; to-dos are per group.
- Multi-group assignment: the teacher selects the target groups; each group gets an independent copy (shared assignment_id, no sync).
- Phase unlocking is per group.

### Claude's Discretion
- Exact UI layout on the teacher pages, migration script location, whether templates also store attachments (no: attachments are not copied in this task).
</decisions>

<specifics>
## Specific Ideas
- Student UI (node path, stepper, to-do views from 260928-iwi/jkg) must look and behave the same. Only the data source changes:
  stepper = classroom phases + this group's progress; nodes = this group's to-dos in the viewed phase.
- Keep tests green and extend `node-path` tests for the per-group status source. Add unit tests for the migration's pure
  merge-planning function (given old rows → planned merges).
- Next.js 16.3 (read `node_modules/next/dist/docs/` when unsure). Lint baseline: 10 pre-existing errors; add none.
</specifics>

<canonical_refs>
## Canonical References
- `.planning/quick/260928-iwi-*/260928-iwi-SUMMARY.md`, `.planning/quick/260928-jkg-*/260928-jkg-SUMMARY.md`
- `.planning/ROADMAP.md` Phase 2 (content structure), Phase 4 (unlock), Phase 6 TOOL-01/02 (bulk assign / duplicate)
</canonical_refs>
