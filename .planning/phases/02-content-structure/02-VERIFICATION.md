---
phase: 02-content-structure
verified: 2026-09-17T00:00:00Z
status: gaps_found
score: 15/16 must-haves verified
gaps:
  - truth: "Teacher can navigate from todo detail page back to the group edit page"
    status: partial
    reason: "Teacher edit button in /todo/[todoId] links to /teacher/classrooms/[id]/group/[id] (plural) but the actual route is /teacher/classroom/[id]/group/[id] (singular) -- 404 on click"
    artifacts:
      - path: "src/app/(dashboard)/todo/[todoId]/page.tsx"
        issue: "Line 67: href uses /teacher/classrooms/ (plural) instead of /teacher/classroom/ (singular)"
    missing:
      - "Fix href on line 67: change /teacher/classrooms/${classroom.id}/group/${group.id} to /teacher/classroom/${classroom.id}/group/${group.id}"
human_verification:
  - test: "Student auto-redirect flow: visit /student as a student with 1 classroom and 1 group"
    expected: "Browser redirects directly to /student/classroom/[id]/group/[id] without rendering the home page"
    why_human: "Server redirect logic is code-correct but redirect loop protection (Pitfall 7) needs live testing to confirm no loop occurs"
  - test: "Locked phase display: student views group with phases in 'locked' status"
    expected: "Locked phases show a lock icon, cannot be expanded (CollapsibleTrigger is non-functional), and active/completed phases expand to show todos"
    why_human: "Conditional collapsible disable logic depends on phase.status at runtime; can't verify without live data"
  - test: "Drag-and-drop reorder: teacher drags a phase or todo to a new position"
    expected: "The UI updates order immediately (optimistic), reorderPhases/reorderTodos action fires, and order persists after page refresh"
    why_human: "DnD behavior with @dnd-kit/react requires interactive browser testing; can't verify gesture handling programmatically"
  - test: "Template picker disappears after applying a template"
    expected: "After calling applyTemplate, router.refresh() causes the group page to re-render; since phases now exist the template picker component is no longer shown"
    why_human: "Conditional render depends on phases.length > 0 after server-side refresh -- needs live test to confirm"
  - test: "Attachment download via R2 presigned URL"
    expected: "Clicking download on a todo attachment opens the file in a new tab; the presignGet function returns a real signed URL to the R2 bucket"
    why_human: "Requires live R2 credentials and an actual uploaded attachment to verify end-to-end"
---

# Phase 2: Content Structure Verification Report

**Phase Goal:** Teachers can create the full content hierarchy -- classrooms with student groups, ordered phases, and to-do items -- so the platform has structured project work ready for student interaction
**Verified:** 2026-09-17
**Status:** gaps_found (1 gap: broken teacher edit link in todo detail page)
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | classrooms schema has inviteCode, maxGroupSize, isArchived columns | VERIFIED | `src/db/schema/classrooms.ts` lines 8-10 |
| 2 | phases/todos schemas have isArchived column | VERIFIED | `phases.ts:13`, `todos.ts:13` |
| 3 | phaseTemplates table exists with all required columns | VERIFIED | `src/db/schema/phaseTemplates.ts` has id, name, description, isBuiltIn, createdBy, structure, createdAt |
| 4 | @dnd-kit/react installed, all shadcn components installed | VERIFIED | `package.json:16`, `src/components/ui/dialog.tsx` exists |
| 5 | createClassroom generates invite code and inserts member | VERIFIED | `src/server/actions/classroom.ts:18-42` -- calls generateUniqueInviteCode, inserts classroom + teacher member |
| 6 | joinByCode, addStudent, assignStudent, joinGroup actions work with role checks | VERIFIED | All present in classroom.ts and group.ts with requireRole + Zod |
| 7 | createPhase sets first phase active, reorderPhases uses transaction, archivePhase/restorePhase exist | VERIFIED | `phase.ts:16-139` -- transaction at line 98, isArchived filter at line 25 |
| 8 | createTodo, reorderTodos (transactional), archiveTodo, restoreTodo exist | VERIFIED | `todo.ts:18-138` -- transaction at line 97 |
| 9 | Phase/todo queries filter isArchived=false by default | VERIFIED | `phase.ts:12,16` and `todo.ts:15` both filter `eq(isArchived, false)` |
| 10 | applyTemplate, saveAsTemplate, deleteTemplate with isBuiltIn guard | VERIFIED | `template.ts:31-159` -- isBuiltIn check at line 155 |
| 11 | 4 built-in templates seeded with Thai content | VERIFIED | `templates.ts` has Market Research, Product Development, Pitch Preparation, Business Model Canvas with Thai strings |
| 12 | Teacher classroom list + create form wired to actions | VERIFIED | `teacher/page.tsx` calls getTeacherClassrooms; create-classroom-form.tsx calls createClassroom |
| 13 | Classroom dashboard has groups tab + settings tab with invite code display | VERIFIED | `[classroomId]/page.tsx` uses shadcn Tabs; invite-code-display.tsx calls regenerateInviteCode |
| 14 | Group page shows draggable collapsible phase outline with inline add/edit | VERIFIED | phase-list.tsx uses DragDropProvider+reorderPhases; phase-item.tsx uses useSortable+Collapsible; inline-add-phase.tsx calls createPhase |
| 15 | Todo management: draggable, collapsible, inline add, edit form with notes/mode/deadline | VERIFIED | todo-list.tsx uses DragDropProvider+reorderTodos; todo-item.tsx collapsible; todo-edit-form.tsx has Textarea+submissionMode+Calendar |
| 16 | Student auto-redirect, read-only phase view, todo detail page, join route, template picker | VERIFIED (with 1 minor gap) | All routes exist and wire to correct queries/actions; teacher edit button has broken URL (plural vs singular) |

**Score:** 15.5/16 truths fully verified (1 partial due to broken teacher edit link)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/classrooms.ts` | inviteCode, maxGroupSize, isArchived columns | VERIFIED | All 3 columns present |
| `src/db/schema/phases.ts` | isArchived column | VERIFIED | Line 13 |
| `src/db/schema/todos.ts` | isArchived column | VERIFIED | Line 13 |
| `src/db/schema/phaseTemplates.ts` | Full template table | VERIFIED | All required columns |
| `src/db/schema/index.ts` | Exports phaseTemplates | VERIFIED | Line 7: `export * from './phaseTemplates'` |
| `src/lib/invite-code.ts` | generateUniqueInviteCode with crypto.getRandomValues | VERIFIED | Lines 9, 13 |
| `src/server/actions/classroom.ts` | 6 actions with requireRole + Zod | VERIFIED | All 6 actions present |
| `src/server/actions/group.ts` | 4 actions with requireRole + Zod | VERIFIED | createGroup, assignStudent, joinGroup, removeFromGroup |
| `src/server/queries/classroom.ts` | 4 query helpers | VERIFIED | getTeacherClassrooms, getStudentClassrooms, getClassroomById, getClassroomByInviteCode |
| `src/server/queries/group.ts` | 3 query helpers | VERIFIED | getGroupsByClassroom, getGroupById, getStudentGroup |
| `src/server/actions/phase.ts` | 5 actions with transaction + isArchived | VERIFIED | createPhase, updatePhase, reorderPhases (transaction), archivePhase, restorePhase |
| `src/server/actions/todo.ts` | 5 actions with transaction + isArchived | VERIFIED | All 5 actions, transaction in reorderTodos |
| `src/server/queries/phase.ts` | isArchived-filtered queries | VERIFIED | getActivePhases filters isArchived=false on phases and todos |
| `src/server/queries/todo.ts` | getTodoDetail with access verification | VERIFIED | Lines 13, 41 |
| `src/server/actions/template.ts` | applyTemplate, saveAsTemplate, deleteTemplate | VERIFIED | isBuiltIn guard on delete |
| `src/server/queries/template.ts` | getTemplates, getTemplateById | VERIFIED | Lines 9, 24 |
| `src/db/seed/templates.ts` | seedTemplates with 4 Thai templates | VERIFIED | All 4 templates with Thai strings |
| `src/app/(dashboard)/teacher/page.tsx` | Classroom list with Thai heading | VERIFIED | Calls getTeacherClassrooms; renders "ห้องเรียนของฉัน" |
| `src/components/classroom/create-classroom-form.tsx` | Form calling createClassroom | VERIFIED | 'use client', imports createClassroom, Thai submit label |
| `src/components/classroom/classroom-card.tsx` | Card linking to classroom dashboard | VERIFIED | Exists, links to /teacher/classroom/[id] |
| `src/components/classroom/invite-code-display.tsx` | Copy + regenerate with AlertDialog | VERIFIED | Calls regenerateInviteCode; "คัดลอกรหัส" present |
| `src/components/classroom/classroom-settings-form.tsx` | Settings form with updateClassroomSettings | VERIFIED | Exists, calls updateClassroomSettings |
| `src/components/group/create-group-form.tsx` | Dialog calling createGroup | VERIFIED | 'use client'; calls createGroup; "สร้างกลุ่ม" |
| `src/components/group/assign-student-dialog.tsx` | Dialog calling assignStudent | VERIFIED | 'use client'; calls assignStudent |
| `src/components/group/student-group-picker.tsx` | Self-join calling joinGroup | VERIFIED | 'use client'; calls joinGroup; "เข้าร่วม" |
| `src/components/phase/phase-list.tsx` | DragDropProvider + reorderPhases | VERIFIED | DragDropProvider at line 54, reorderPhases at line 72 |
| `src/components/phase/phase-item.tsx` | useSortable + Collapsible | VERIFIED | useSortable line 74, Collapsible line 96 |
| `src/components/phase/phase-edit-form.tsx` | updatePhase + Switch + Calendar | VERIFIED | All 3 present |
| `src/components/phase/inline-add-phase.tsx` | createPhase + "+เพิ่ม Phase" | VERIFIED | Lines 25, 49 |
| `src/components/todo/todo-list.tsx` | DragDropProvider + reorderTodos | VERIFIED | Both present |
| `src/components/todo/todo-item.tsx` | useSortable + Collapsible | VERIFIED | Both present |
| `src/components/todo/todo-edit-form.tsx` | updateTodo + Textarea + submissionMode + Calendar (no rich text) | VERIFIED | All present; plain Textarea not Tiptap |
| `src/components/todo/inline-add-todo.tsx` | createTodo + "+เพิ่มสิ่งที่ต้องทำ" | VERIFIED | Lines 33, 63 |
| `src/app/(dashboard)/student/page.tsx` | Auto-redirect logic + empty state | VERIFIED | All 3 branches (0, 1, multiple classrooms) implemented correctly |
| `src/app/(dashboard)/student/classroom/[classroomId]/page.tsx` | getStudentGroup + redirect | VERIFIED | Redirects to group page if group exists |
| `src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx` | getActivePhases + group membership check | VERIFIED | Fetches phases and passes to GroupPhaseView |
| `src/components/student/group-phase-view.tsx` | Read-only Collapsible + locked state + todo links | VERIFIED | Lock icon for locked phases, Collapsible for active/completed, links to /todo/[id] |
| `src/app/(dashboard)/todo/[todoId]/page.tsx` | getTodoDetail + 4 sections + teacher edit button | PARTIAL | All 4 sections correct; teacher edit href broken (see gaps) |
| `src/components/todo/todo-detail.tsx` | Teacher notes with pre-formatted text | VERIFIED | Renders notes in `<pre>` tag |
| `src/components/todo/todo-attachments-list.tsx` | Download via R2 presigned URL | VERIFIED | Calls getAttachmentDownloadUrl which calls presignGet from src/lib/r2.ts |
| `src/components/template/template-picker.tsx` | applyTemplate + Thai labels | VERIFIED | Calls applyTemplate; "ใช้ Template"; "เลือก Template เริ่มต้น" |
| `src/app/(dashboard)/join/[code]/page.tsx` | joinByCode + redirect | VERIFIED | Line 28 calls joinByCode; redirects on success |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| create-classroom-form.tsx | createClassroom action | import + call | WIRED | Line 8 import, line 45 call |
| classroom detail page | getClassroomById query | import + await | WIRED | Line 5 import, line 26 await |
| invite-code-display.tsx | regenerateInviteCode action | import + call | WIRED | Line 5 import, line 59 call |
| phase-list.tsx | reorderPhases action | import + onDragEnd | WIRED | Line 8 import, line 72 call in drag handler |
| phase-item.tsx | @dnd-kit/react/sortable | useSortable | WIRED | Line 5 import, line 74 usage |
| todo-list.tsx | reorderTodos action | import + onDragEnd | WIRED | Line 8 import, line 59 call |
| todo-edit-form.tsx | updateTodo action | import + onBlur/save | WIRED | Line 19 import, line 45 call |
| todo-attachments-list.tsx | getAttachmentDownloadUrl action | import + call | WIRED | Calls server action which calls presignGet |
| template-picker.tsx | applyTemplate action | import + call | WIRED | Line 5 import, line 33 call |
| student/page.tsx | getStudentClassrooms + getStudentGroup | import + await + redirect | WIRED | All 3 redirect branches implemented |
| todo detail page | teacher edit link | href | BROKEN | Uses /teacher/classrooms/ (plural); route is /teacher/classroom/ (singular) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| teacher/page.tsx | classrooms | getTeacherClassrooms(userId) → db.select on classroomMembers | Yes -- Drizzle query with join | FLOWING |
| classroom detail page | groups | getGroupsByClassroom → db.query.groups | Yes -- Drizzle query | FLOWING |
| group detail page | phases | getActivePhases(groupId) → db.query.phases with where isArchived=false | Yes -- Drizzle query with nested todos | FLOWING |
| student/page.tsx | classrooms | getStudentClassrooms(userId) → db.select via classroomMembers | Yes -- Drizzle query | FLOWING |
| todo detail page | todo | getTodoDetail(todoId, userId) → db.query.todos with relations | Yes -- Drizzle query with phase→group→classroom chain | FLOWING |
| template-picker.tsx | templates | getTemplates prop (fetched in parent page) | Yes -- getTemplates calls db.query.phaseTemplates | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds with all routes compiled | `npm run build` | All 13 routes built successfully, 0 errors | PASS |
| All phase 2 routes present in build output | Build output scan | /teacher, /teacher/classroom/[id], /teacher/classroom/[id]/group/[id], /teacher/classroom/new, /student, /student/classroom/[id], /student/classroom/[id]/group/[id], /todo/[id], /join/[code] all listed | PASS |
| invite-code.ts exports generateUniqueInviteCode | File inspection | Function exported at line 13 | PASS |
| All server actions have requireRole | grep scan | All 5 action files confirmed | PASS |
| All reorder actions use db.transaction | grep scan | phase.ts line 98, todo.ts line 97 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CLASS-01 | 02-01, 02-03 | Teacher can create a classroom | SATISFIED | createClassroom action + create-classroom-form.tsx wired |
| CLASS-02 | 02-01, 02-03 | Teacher can add students to a classroom | SATISFIED | addStudent action + classroom member management in settings form |
| CLASS-03 | 02-05 | Student can see classrooms they belong to | SATISFIED | getStudentClassrooms + student/page.tsx + ClassroomCards |
| CLASS-04 | 02-01, 02-03 | Teacher can manage multiple classrooms | SATISFIED | getTeacherClassrooms returns all; teacher dashboard renders all classroom cards |
| GRP-01 | 02-01, 02-03 | Teacher can create groups within a classroom | SATISFIED | createGroup action + create-group-form.tsx |
| GRP-02 | 02-01, 02-03 | Teacher can assign students to groups | SATISFIED | assignStudent action + assign-student-dialog.tsx |
| GRP-03 | 02-05 | Student can see their group and members | SATISFIED | student group page shows group with phases; getGroupById returns members |
| GRP-04 | 02-01, 02-05 | Groups are independent -- each has its own phases/todos | SATISFIED | Phases have groupId FK; getActivePhases filters by groupId |
| PHASE-01 | 02-02, 02-04 | Teacher can create ordered phases for a group | SATISFIED | createPhase with auto-incremented orderIndex + inline-add-phase.tsx |
| PHASE-02 | 02-02, 02-04 | Phases have state: locked/active/completed | SATISFIED | Status set at creation (first=active, rest=locked); status badge in group-phase-view.tsx |
| PHASE-03 | 02-02, 02-04 | Teacher can set a phase as free-access | SATISFIED | isFreeAccess Switch in phase-edit-form.tsx + updatePhase action |
| PHASE-04 | 02-02, 02-04 | Teacher can set optional deadlines on phases | SATISFIED | Calendar deadline picker in phase-edit-form.tsx + updatePhase supports deadline |
| TODO-01 | 02-02, 02-04 | Teacher can create to-do items within a phase | SATISFIED | createTodo action + inline-add-todo.tsx |
| TODO-02 | 02-02, 02-04 | Each to-do has a submission mode (group/individual) | SATISFIED | submissionMode field; Select in todo-edit-form.tsx |
| TODO-03 | 02-02, 02-04 | Teacher can set optional deadlines on to-dos | SATISFIED | Calendar deadline picker in todo-edit-form.tsx + updateTodo supports deadline |
| TODO-04 | 02-02, 02-05 | Each to-do has a detail page with notes, attachments, submission form | SATISFIED | /todo/[todoId] page has all 4 sections (notes, attachments, submission placeholder, past submissions placeholder) |

All 16 requirement IDs from the plan frontmatter are accounted for. No orphaned requirements found for Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(dashboard)/todo/[todoId]/page.tsx` | 67 | Broken href: `/teacher/classrooms/` (plural) should be `/teacher/classroom/` (singular) | Warning | Teacher edit button navigates to 404; does not block student flow or any Phase 2 teacher content creation goal |

No placeholder/stub anti-patterns found. All Server Actions return real data. All components make real calls to real actions.

### Human Verification Required

#### 1. Student Auto-Redirect

**Test:** Sign in as a student who is a member of exactly 1 classroom and is assigned to 1 group. Visit `/student`.
**Expected:** Browser redirects to `/student/classroom/[id]/group/[id]` without displaying the home page.
**Why human:** Server redirect logic is code-correct but redirect loop protection (Pitfall 7 from research) needs live testing to confirm no infinite redirect occurs under edge cases.

#### 2. Locked Phase UI

**Test:** View the student group page (`/student/classroom/[id]/group/[id]`) when the group has phases in 'locked' status.
**Expected:** Locked phases display a lock icon and cannot be expanded (the CollapsibleTrigger should be disabled or non-functional for locked phases). Active/completed phases expand normally.
**Why human:** The locked state conditional logic needs runtime data to confirm the UI correctly prevents expansion.

#### 3. Drag-and-Drop Reorder

**Test:** On the teacher group page (`/teacher/classroom/[id]/group/[id]`), drag a phase to a different position. Then refresh the page.
**Expected:** The drag shows visual feedback (opacity), the reorderPhases action fires, and the new order persists after page refresh.
**Why human:** DnD gesture handling with @dnd-kit/react requires interactive browser testing; cannot verify spring physics and gesture completion programmatically.

#### 4. Template Picker Disappears After Apply

**Test:** On a group with 0 phases, click "ใช้ Template" on one of the built-in templates.
**Expected:** The template picker disappears and the group page re-renders showing the newly created phases.
**Why human:** Requires confirming that router.refresh() triggers re-fetch of phases from the server and the conditional render (`phases.length === 0`) evaluates correctly after the action.

#### 5. Attachment Download

**Test:** Upload a file as a todo attachment, then visit the todo detail page and click the download button.
**Expected:** A presigned R2 URL is generated and the file opens in a new browser tab for download.
**Why human:** Requires live R2 credentials (CLOUDFLARE_R2_*) to be configured in the environment and an actual attachment in the database.

### Gaps Summary

One gap found: a minor broken link in the teacher edit button on the todo detail page. The button exists and is correctly role-gated, but the href uses `/teacher/classrooms/` (plural with an extra 's') when the actual Next.js route is `/teacher/classroom/` (singular). Clicking the button returns a 404. This does not block any core Phase 2 goal — teachers can still create and manage all content hierarchy — but it breaks teacher navigation from the todo detail page back to the group editor.

Fix: Change line 67 of `src/app/(dashboard)/todo/[todoId]/page.tsx` from `/teacher/classrooms/${classroom.id}/group/${group.id}` to `/teacher/classroom/${classroom.id}/group/${group.id}`.

All 16 Phase 2 requirements are substantively implemented and data flows through real Drizzle queries to real Neon database tables. The build compiles cleanly with all expected routes present.

---
_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
