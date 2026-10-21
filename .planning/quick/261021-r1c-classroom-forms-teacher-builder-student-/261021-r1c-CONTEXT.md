# Quick Task 261021-r1c: Classroom forms (teacher builds, students answer) - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning

<domain>
## Task Boundary

User requests (Thai):
1. "สร้างแบบฟอร์มอันนึงที่จะให้นักเรียนทุกกลุ่มถามคำถามได้หน่อย คล้าย พวก type form เลยแต่ใช้ CI ของ build.innovator"
2. Pivot (supersedes "students ask free questions"): "อยากให้ครูกำหนดคำถามได้ แล้วนักเรียนตอบได้"

=> A Typeform-like FORM feature inside build.Innovator (Duo): teachers create forms with their own questions for a classroom; students answer them in a Typeform-style one-question-per-screen flow in the build.Innovator / Cocoon CI. Teachers see responses and export them.

</domain>

<decisions>
## Implementation Decisions

### Placement (USER-LOCKED)
- Inside the Duo app. Students are signed in (Clerk): name, classroom and group come from the session + membership — never typed.

### Response visibility + export (USER-LOCKED)
- Responses are visible to teachers only (classroom editors: owner / teacher members / superadmin — same scope as the rest of the teacher area). Students see only their own (or, in group mode, their group's) response.
- Teacher can export responses as CSV with UTF-8 BOM (opens in Excel with Thai intact; imports into Google Sheets): one row per response; fixed columns วันที่ส่ง, ห้องเรียน, กลุ่ม, ผู้ตอบ (name), อีเมล, then one column per question in order (multiple choice joined with ", "; file answers = file name + link/URL; rating = number). Guard against CSV formula injection (prefix cells starting with = + - @ tab CR with '). No .xlsx dependency; no live Google Sheets sync in this task.

### Who answers (USER-LOCKED: "Teacher picks per form")
- Each form has `responseMode`: `individual` (every student submits their own) or `group` (one response per group; any group member may submit/edit it; other members see it's already been answered and its content).

### Question types (USER-LOCKED: all four selected)
- short text, long text
- single choice, multiple choice (teacher-defined options, 2–20)
- rating scale (teacher picks 1–5 or 1–10; optional min/max labels)
- file / link upload (student uploads a file to R2 using the existing upload pattern — see src/server/actions/todo-attachment.ts, submission.ts, work-page.ts and their client upload helpers — OR pastes a URL)
- Every question: title (required), optional description, required flag.

### Audience (USER-LOCKED: "Whole classroom + optional group picks")
- Default: all groups of the classroom. Teacher can restrict to selected groups. In individual mode, a classroom student who is in no group can answer only when the form targets the whole classroom.

### Form as phase task (USER-LOCKED, added 2026-10-21)
- User: "อยากให้มีปุ่มที่สามารถ add form ตัวนี้ลงไปอยู่ 1 ใน task ในแต่ละ phase ได้" — a button to add a form as one of the tasks in a phase.
- Data: nullable `form_id` (FK forms ON DELETE SET NULL) on BOTH `classroom_tasks` and `todos`; classroom-task sync copies it to group copies like a locked field (src/lib/classroom-task-sync.ts + syncClassroomTasks in src/server/phase-helpers.ts). Columns go in the same migration script (2026-10-21-forms.ts).
- From the form builder: button "เพิ่มเป็นงานใน Phase" → pick phase → creates a classroom task (title = form title, submissionMode = form.responseMode, deadline = form.closesAt, fileRequirement 'none', form_id). If the form audience is restricted to specific groups, create per-group todos instead (assignmentId pattern) only for those groups.
- In the phase task-add UI: option "จากแบบฟอร์ม" (pick one of the classroom's forms).
- Student todo page for a form-linked todo: prominent "ตอบแบบฟอร์ม" button that opens the Typeform flow and returns to the todo after submit.
- Completion (USER-LOCKED, confirmed): submitting a form that is linked to a phase task creates/updates a `submissions` row for that todo (status pending; group/individual per mode) so it goes through the normal teacher review (รอตรวจ → approve/reject), dashboards and phase gating. Teacher approves as usual.

### Claude's Discretion (orchestrator defaults; planner may refine)
- **Form lifecycle:** `draft` (teacher editing, invisible to students) → `open` (students can answer) → `closed`. Optional close date/time (deadline) after which it behaves as closed. Teacher can reopen. Editing questions of a form that already has responses: allowed for title/description/options text; deleting a question or changing its type after responses exist must be blocked or warned (keep it simple: block type change + delete when responses exist; allow adding questions).
- **Students may edit their response until the form is closed** (upsert; store updatedAt).
- **Teacher builder UI** (Duo teacher area, Cocoon tokens): classroom page gets a new tab "แบบฟอร์ม" (TABS in src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx — check mobile width with 6 segments; the existing TAB_TRIGGER tightening may need adjusting) listing forms with status pill + response count (n / expected); create form → builder page `/teacher/classroom/[classroomId]/forms/[formId]` with: title, description, response mode, audience (all / pick groups), close date, ordered question list (add / edit / reorder with up/down buttons or the existing @dnd-kit/react pattern / delete), question type picker, preview link, publish/close buttons. Responses page `/teacher/classroom/[classroomId]/forms/[formId]/responses`: summary per question (counts for choices/ratings, list for text), table of responses, filter by group + the existing "กลุ่มที่ฉันดูแล" ?mine=1 toggle (MineFilterToggle), who hasn't answered yet (students or groups), Export CSV button.
- **Export URL** must NOT end in a file extension: src/middleware.ts matcher excludes paths ending in .csv/.xlsx/etc from Clerk (would bypass auth). Use e.g. `/teacher/classroom/[classroomId]/forms/[formId]/export` (route handler) with Content-Disposition filename; the handler authorizes itself (classroom editor) regardless of middleware.
- **Student side:** forms open to the student appear on the student group page and classroom page as cards ("แบบฟอร์มที่ต้องตอบ", status ยังไม่ตอบ / ตอบแล้ว / ปิดแล้ว, close date) and on the student home when relevant. Respond page is full-screen (no app shell/tab bar) e.g. a new route group `src/app/(focus)/student/forms/[formId]` with its own layout reusing src/app/register/register.css fonts.
- **Typeform UX:** one question per screen; question number + arrow ("1 →"), big heading (FC Rainbow display font for headings, IBM Plex Sans Thai Looped body), description; choice options as big buttons with letter keys A/B/C (keyboard shortcuts); multiple choice shows "เลือกได้หลายข้อ"; rating as a row of numbered buttons; "OK ✓" button + "กด Enter ↵" hint; Shift+Enter newline in long text; thin progress bar at top; back/next arrows; required validation inline; welcome screen (form title + description + "เริ่ม") and thank-you screen ("ส่งคำตอบแล้ว"); review/edit after submission while open. Respect prefers-reduced-motion. CSS transitions only (motion lib not installed — do not add it). Mobile-first (402px Figma baseline), centered column on desktop.
- **CI:** reuse the build.Innovator look from src/app/register/page.tsx (cream #FFFAF3 backdrop, peach/orange top-right + blue/green bottom-left watercolor washes, /logos/shapes-10.webp & shapes-11.webp decorations, /logos/cocoon-lockup-color.webp) and Duo tokens in src/app/globals.css (cocoon-blue #0069a6, orange #ef4924, yellow #faa819, green #00a86b, ink, muted, line). Extract the backdrop into a shared component if reused.
- **Data model (Drizzle, new file src/db/schema/forms.ts, export from index + relations):**
  - `forms`: id, classroom_id FK classrooms ON DELETE CASCADE, title, description, response_mode ('individual'|'group'), status ('draft'|'open'|'closed'), closes_at timestamp null, created_by, created_at, updated_at.
  - `form_groups` (audience; empty = whole classroom): form_id FK CASCADE, group_id FK groups CASCADE, unique(form_id, group_id).
  - `form_questions`: id, form_id FK CASCADE, order_index, type ('short_text'|'long_text'|'single_choice'|'multiple_choice'|'rating'|'file'), title, description null, required bool, config jsonb (options[], scale max 5|10, min/max labels, file: allowLink), created_at, updated_at.
  - `form_responses`: id, form_id FK CASCADE, user_id (submitter / last editor), group_id FK groups SET NULL null, owner_key text (individual: user id; group: group id) unique(form_id, owner_key), answers jsonb (questionId → value; file answers {key,name,size,contentType} or {url}), submitted_at, updated_at.
  - Hand-written idempotent migration script `src/db/migrations/2026-10-21-forms.ts` following EXACTLY the pattern of src/db/migrations/2026-10-06-group-teachers-and-rank.ts (--dry-run / --apply, one transaction, constraint/index names matching Drizzle, "already migrated" detection). Executor must NOT run --apply and must NOT use drizzle-kit push.
- **Server:** actions in src/server/actions/form.ts (teacher: create/update/delete form, publish/close/reopen, question CRUD + reorder — classroom editor only; student: saveResponse — server derives classroom membership and the student's group itself (never trust client groupId), checks form open + not past closes_at + audience + response mode, validates answers against question definitions with zod; file upload presign scoped to form/response like existing todo-attachment flow, max size same as existing). Queries in src/server/queries/form.ts. Pure logic in src/lib/forms.ts (question config schemas, answer validation per type, audience/eligibility decision, owner key, form effective status incl. closes_at, response summary aggregation, CSV builder with BOM + injection guard) with vitest tests in src/lib/__tests__/forms.test.ts.
- **No email notifications in this task.**
- Teacher-facing student names come from getUserDirectory (same as dashboards).

### Scope note
This is larger than a typical quick task. Planner may split into 2 plans (wave 1: data layer + teacher builder; wave 2: student flow + responses/export) if that keeps each executor focused, each with ≤3 tasks.

</decisions>

<canonical_refs>
## Canonical References

- src/db/migrations/2026-10-06-group-teachers-and-rank.ts — migration script pattern (must follow)
- .planning/STATE.md — never drizzle-kit push; DATABASE_URL is shared with the LIVE site
- AGENTS.md — Next.js 16 breaking changes; read node_modules/next/dist/docs for route handlers, route groups, searchParams
- src/middleware.ts — matcher excludes file-extension paths (security note above)
- src/app/register/* — build.Innovator CI reference
- src/components/group/mine-filter-toggle.tsx — "กลุ่มที่ฉันดูแล" toggle

</canonical_refs>
