# Roadmap: Duo

## Overview

Duo delivers a project-based learning platform where teachers structure work into phases and to-dos, students submit deliverables, and teacher approval gates progression -- all rendered through a Duolingo-style visual path. The build follows the strict data dependency chain: foundation and auth first, then the content hierarchy (classrooms, groups, phases, to-dos), then the submission loop, then review and progression logic, then the visual UI layer, and finally teacher power tools and LINE notifications.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Auth** - Project scaffolding, database schema, Clerk auth with roles, R2 infrastructure, localization utilities
- [ ] **Phase 2: Content Structure** - Classrooms, groups, phases, and to-dos -- the full teacher content creation workflow
- [ ] **Phase 3: Submissions** - Student submission flow for files (R2), links, and text with group/individual modes
- [ ] **Phase 4: Review & Progression** - Teacher review with approve/reject/comment and automatic phase unlocking
- [ ] **Phase 5: Progression UI** - Duolingo-style visual phase path with locked/active/completed states
- [ ] **Phase 6: Teacher Tools & Notifications** - Bulk assignment, template duplication, pending queue, and LINE notifications

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Teachers and students can sign in with correct roles, the database schema supports the full data model, and infrastructure (R2, localization) is ready for feature development
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, L10N-01, L10N-02
**Success Criteria** (what must be TRUE):
  1. Teacher can sign in and see a teacher-specific dashboard shell (even if empty)
  2. Student can sign in and see a student-specific view shell (even if empty)
  3. Unauthorized users cannot access protected routes or invoke Server Actions for the wrong role
  4. Thai UI text renders correctly with English technical terms mixed in, and dates display in Buddhist Era format
  5. Database schema is deployed with all tables needed for the full data model (classrooms through submissions)
**Plans**: TBD

### Phase 2: Content Structure
**Goal**: Teachers can create the full content hierarchy -- classrooms with student groups, ordered phases, and to-do items -- so the platform has structured project work ready for student interaction
**Depends on**: Phase 1
**Requirements**: CLASS-01, CLASS-02, CLASS-03, CLASS-04, GRP-01, GRP-02, GRP-03, GRP-04, PHASE-01, PHASE-02, PHASE-03, PHASE-04, TODO-01, TODO-02, TODO-03, TODO-04
**Success Criteria** (what must be TRUE):
  1. Teacher can create a classroom, add students to it, and manage multiple classrooms
  2. Teacher can create groups within a classroom and assign students to groups
  3. Student can see their classrooms, their group, and group members
  4. Teacher can create ordered phases for a group with optional deadlines and free-access flags
  5. Teacher can create to-do items within a phase, each with a submission mode (group/individual), optional deadline, notes, and downloadable attachments
**Plans**: TBD
**UI hint**: yes

### Phase 3: Submissions
**Goal**: Students can submit work (files, links, text) on to-do items, with correct handling of group vs individual submission modes
**Depends on**: Phase 2
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06
**Success Criteria** (what must be TRUE):
  1. Student can upload files (PDF, images, docs) to a to-do via R2 presigned URLs
  2. Student can submit a link or free-text response to a to-do
  3. For a "group" to-do, one member submits and it counts for the whole group
  4. For an "individual" to-do, each group member submits separately
  5. Student can view their past submissions on any to-do
**Plans**: TBD
**UI hint**: yes

### Phase 4: Review & Progression
**Goal**: Teachers can review student submissions with comments and approve/reject, and approval of all required to-dos in a phase automatically unlocks the next phase
**Depends on**: Phase 3
**Requirements**: REV-01, REV-02, REV-03, REV-04, PHASE-05
**Success Criteria** (what must be TRUE):
  1. Teacher can view all submissions for any to-do (grouped by student or group)
  2. Teacher can approve or reject a submission
  3. Teacher can comment on student work
  4. When teacher approves all required to-dos in a phase, the next phase automatically unlocks (unless it is free-access)
**Plans**: TBD
**UI hint**: yes

### Phase 5: Progression UI
**Goal**: Students experience a Duolingo-style visual progression path that shows their journey through all phases with clear locked/active/completed states
**Depends on**: Phase 4
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Student sees a visual path (Duolingo-style) showing all phases with locked, active, and completed states
  2. Each phase node shows progress (to-dos completed vs total)
  3. Phase nodes are clickable -- tapping enters the phase to see its to-dos
  4. The progression UI is responsive and works well on mobile (phones are primary device for Thai students)
**Plans**: TBD
**UI hint**: yes

### Phase 6: Teacher Tools & Notifications
**Goal**: Teachers have power tools for efficient classroom management (bulk assign, duplicate, review queue) and both teachers and students receive LINE notifications for key events
**Depends on**: Phase 4
**Requirements**: TOOL-01, TOOL-02, TOOL-03, NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. Teacher can assign the same phases and to-dos to all groups in a classroom at once (bulk assign)
  2. Teacher can duplicate a phase template from one group to another
  3. Teacher can see a consolidated list of pending submissions needing review
  4. Student receives a LINE notification when teacher gives feedback or approves work
  5. Teacher receives a LINE notification when a student submits work
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5/6 (5 and 6 can run in parallel after 4)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 0/TBD | Not started | - |
| 2. Content Structure | 0/TBD | Not started | - |
| 3. Submissions | 0/TBD | Not started | - |
| 4. Review & Progression | 0/TBD | Not started | - |
| 5. Progression UI | 0/TBD | Not started | - |
| 6. Teacher Tools & Notifications | 0/TBD | Not started | - |
