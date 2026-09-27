# Requirements: Duo

**Defined:** 2026-09-17
**Core Value:** Teachers and student groups can plan, execute, and track project-based work through a clear phase->to-do progression -- with teacher approval gating advancement.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: Teacher can sign in and access teacher dashboard
- [x] **AUTH-02**: Student can sign in and access student view
- [x] **AUTH-03**: Clerk enforces role-based access (teacher vs student) on all routes and actions
- [x] **AUTH-04**: Authorization checked in Server Actions, not just middleware

### Classrooms

- [ ] **CLASS-01**: Teacher can create a classroom (e.g., "Innovator's Academy", "Cocoon Incubation")
- [ ] **CLASS-02**: Teacher can add students to a classroom
- [ ] **CLASS-03**: Student can see classrooms they belong to
- [ ] **CLASS-04**: Teacher can manage multiple classrooms

### Groups

- [ ] **GRP-01**: Teacher can create groups (student teams) within a classroom
- [ ] **GRP-02**: Teacher can assign students to groups
- [ ] **GRP-03**: Student can see their group and group members
- [ ] **GRP-04**: Groups are independent -- each has its own phases and to-dos

### Phases

- [x] **PHASE-01**: Teacher can create ordered phases for a group (e.g., "Phase 1: Market Research")
- [x] **PHASE-02**: Phases have state: locked / active / completed
- [x] **PHASE-03**: Teacher can set a phase as free-access (no approval prerequisite)
- [x] **PHASE-04**: Teacher can set optional deadlines on phases
- [ ] **PHASE-05**: Phase unlocks when teacher approves all required to-dos in previous phase (unless free-access)

### To-dos

- [x] **TODO-01**: Teacher can create to-do items within a phase (e.g., "Create questionnaire", "Interview customers")
- [x] **TODO-02**: Each to-do has a submission mode: "group" or "individual"
- [x] **TODO-03**: Teacher can set optional deadlines on to-dos
- [x] **TODO-04**: Each to-do opens a detail page with: notes area, downloadable attachments, submission form

### Submissions

- [ ] **SUB-01**: Student can upload files (PDF, images, docs) via R2 presigned URLs
- [ ] **SUB-02**: Student can submit links (URLs)
- [ ] **SUB-03**: Student can submit free-text responses
- [ ] **SUB-04**: For "group" to-dos, one member submits for the whole group
- [ ] **SUB-05**: For "individual" to-dos, each group member submits separately
- [ ] **SUB-06**: Student can view their past submissions

### Review

- [ ] **REV-01**: Teacher can view all submissions for a to-do
- [ ] **REV-02**: Teacher can approve or reject a submission
- [ ] **REV-03**: Teacher can comment on student work
- [ ] **REV-04**: Approval of all required to-dos triggers phase completion and unlocks next phase

### Teacher Tools

- [ ] **TOOL-01**: Teacher can assign the same phases/to-dos to all groups in a classroom at once (bulk assign)
- [ ] **TOOL-02**: Teacher can duplicate a phase template from one group to another
- [ ] **TOOL-03**: Teacher can see a list of pending submissions needing review

### Progression UI

- [ ] **UI-01**: Student sees a Duolingo-style visual path showing all phases (locked/active/completed)
- [ ] **UI-02**: Visual path shows progress within each phase (to-dos completed vs total)
- [ ] **UI-03**: Phase nodes are interactive -- click to enter the phase and see to-dos
- [ ] **UI-04**: Responsive design -- works on mobile (Thai students primarily use phones)

### Notifications

- [ ] **NOTIF-01**: Student receives LINE notification when teacher gives feedback or approves work
- [ ] **NOTIF-02**: Teacher receives LINE notification when a student submits work
- [ ] **NOTIF-03**: Notification for approaching deadlines

### Localization

- [x] **L10N-01**: UI is Thai primary with English technical terms mixed in
- [x] **L10N-02**: Dates displayed in Thai Buddhist calendar format (BE)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analytics

- **ANALYTICS-01**: Teacher dashboard showing group progress across classroom
- **ANALYTICS-02**: Time-to-completion metrics per phase
- **ANALYTICS-03**: Student activity/engagement indicators

### Student Portfolio

- **PORT-01**: Student can view all completed work across classrooms as a portfolio

### Advanced Notifications

- **NOTIF-04**: In-app notification center (unread badges, notification list)
- **NOTIF-05**: Customizable notification preferences per user

## Out of Scope

| Feature | Reason |
|---------|--------|
| Gamification (XP, streaks, leaderboards) | Not the product -- Duolingo-style is UI/visual only, not reward mechanics |
| Real-time chat/messaging | Students use LINE/Discord; building chat is a massive scope sink |
| Grading/scoring system | Approve/reject + comments is the feedback model; no numerical grades |
| Peer review | Teacher reviews only; < 100 users doesn't justify the complexity |
| AI auto-grading | Submissions are project work (pitch decks, business plans) -- not gradable by AI |
| Mobile native app | Responsive web sufficient for < 100 users; PWA touches optional |
| Calendar view | Due dates shown inline on progression path; no separate calendar UI |
| Discussion forums | Comments on submissions are sufficient; general chat happens on LINE |
| Plagiarism detection | Not applicable to project-based work (business plans, prototypes) |
| Email notifications (Resend) | LINE is the notification channel for Thai users, not email |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| L10N-01 | Phase 1 | Complete |
| L10N-02 | Phase 1 | Complete |
| CLASS-01 | Phase 2 | Pending |
| CLASS-02 | Phase 2 | Pending |
| CLASS-03 | Phase 2 | Pending |
| CLASS-04 | Phase 2 | Pending |
| GRP-01 | Phase 2 | Pending |
| GRP-02 | Phase 2 | Pending |
| GRP-03 | Phase 2 | Pending |
| GRP-04 | Phase 2 | Pending |
| PHASE-01 | Phase 2 | Complete |
| PHASE-02 | Phase 2 | Complete |
| PHASE-03 | Phase 2 | Complete |
| PHASE-04 | Phase 2 | Complete |
| TODO-01 | Phase 2 | Complete |
| TODO-02 | Phase 2 | Complete |
| TODO-03 | Phase 2 | Complete |
| TODO-04 | Phase 2 | Complete |
| SUB-01 | Phase 3 | Pending |
| SUB-02 | Phase 3 | Pending |
| SUB-03 | Phase 3 | Pending |
| SUB-04 | Phase 3 | Pending |
| SUB-05 | Phase 3 | Pending |
| SUB-06 | Phase 3 | Pending |
| REV-01 | Phase 4 | Pending |
| REV-02 | Phase 4 | Pending |
| REV-03 | Phase 4 | Pending |
| REV-04 | Phase 4 | Pending |
| PHASE-05 | Phase 4 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 5 | Pending |
| TOOL-01 | Phase 6 | Pending |
| TOOL-02 | Phase 6 | Pending |
| TOOL-03 | Phase 6 | Pending |
| NOTIF-01 | Phase 6 | Pending |
| NOTIF-02 | Phase 6 | Pending |
| NOTIF-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-09-17*
*Last updated: 2026-09-17 after roadmap creation*
