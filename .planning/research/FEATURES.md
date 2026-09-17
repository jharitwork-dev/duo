# Feature Research

**Domain:** Project-based learning platform (education, Grades 9-12 + incubation)
**Researched:** 2026-09-17
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken for teachers and students.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Classroom containers | Every LMS (Google Classroom, Canvas) has course/class as top-level grouping. Teachers expect it. | LOW | Already in PROJECT.md requirements |
| Student groups/teams | PBL is inherently team-based. Groups are the unit of work. | LOW | Schema: groups belong to classrooms, users belong to groups |
| Phase/milestone progression | The core metaphor. Teachers need to structure projects into ordered steps. | MEDIUM | Duolingo-style path UI is the visual layer on top |
| To-do lists within phases | Phases without tasks are just labels. Teachers need granular assignment items. | LOW | Each to-do = one submission point |
| Assignment details page | Per-to-do page with instructions, attached files, and submission area. Standard in every LMS. | MEDIUM | Notes area + downloadable attachments + submission form |
| File upload submissions | Students submit PDFs, images, docs. Universal expectation from Google Classroom era. | MEDIUM | R2 storage. Need file type validation, size limits. |
| Link submissions | Students share Google Docs, Figma, Canva, external URLs. Common in modern classwork. | LOW | URL field with basic validation |
| Text/free-text submissions | Quick answers, reflections, written responses without file overhead. | LOW | Rich text or plain text field |
| Teacher review + commenting | Teachers must be able to read submissions and leave feedback. Core interaction loop. | MEDIUM | Comment thread on submissions, not just a grade |
| Approval gating (phase unlock) | Teacher approves to-dos to unlock next phase. This is the product's core mechanic. | MEDIUM | State machine: locked -> in-progress -> submitted -> approved |
| Role-based access (teacher/student) | Teachers create and review. Students submit. Distinct permissions are non-negotiable. | LOW | Clerk roles: teacher, student |
| Group submissions (one for team) | One member submits on behalf of the group. Standard in team-based coursework. | LOW | Flag on to-do: "group submission" |
| Individual submissions (per member) | Some tasks need individual accountability even in team projects. | LOW | Flag on to-do: "individual submission" |
| Due dates on phases/to-dos | Teachers need deadlines. Students need to know when work is due. | LOW | Optional date field. Not all to-dos need dates in PBL. |
| Notification of submissions | Teachers need to know when work is submitted. Students need to know when feedback arrives. | MEDIUM | Email via Resend. In-app indicators (unread badges). |
| Responsive web design | Students use phones. Thai students especially — mobile-first internet usage. | MEDIUM | Not a native app, but responsive is mandatory |

### Differentiators (Competitive Advantage)

Features that set Duo apart from "just use Google Classroom + Trello."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Duolingo-style visual progression path | The killer UX. A visual map showing phases as nodes on a path — locked/active/completed states with color and animation. Makes project progress feel tangible and motivating. Google Classroom has nothing like this. | HIGH | Core differentiator per PROJECT.md. SVG/Canvas path with node states. Needs careful design. |
| Bulk phase/to-do assignment across groups | Teacher creates one phase template, assigns to all groups at once. Google Classroom can distribute assignments but not structured phase templates. | MEDIUM | "Assign to all groups" button. Duplicates phase+to-dos per group. |
| Phase template duplication | Teachers reuse phase structures across groups or classrooms. Saves massive time for programs like Cocoon that repeat structure. | LOW | Copy phase+to-dos from one group to another |
| Free-access phases (no gate) | Some phases don't need approval to proceed — teachers can mark phases as freely accessible. Flexible gating model. | LOW | Boolean flag on phase. Simple but useful for mixed-structure projects. |
| Mixed Thai/English UI | Purpose-built for Thai education context. No existing LMS handles Thai as primary language with English technical terms well. | LOW | i18n from day 1, but scope is narrow (one language + English terms) |
| Per-to-do submission mode toggle | Each to-do can independently be "group" or "individual" submission. Most LMS platforms set this at the assignment level, not per-task. Granular control. | LOW | Enum field on to-do schema |
| Teacher dashboard: submissions needing review | Single view of all pending submissions across all groups. Reduces teacher overhead vs clicking into each group. | MEDIUM | Query: all submissions with status="submitted" for teacher's classrooms |
| Phase progress overview per classroom | Teacher sees all groups' progress at a glance — who's stuck, who's ahead. Visual grid/table. | MEDIUM | Aggregation view. Critical for managing 5-10+ groups simultaneously. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but would hurt Duo's focus, scope, or user experience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Gamification (XP, streaks, leaderboards) | "Duolingo-style" gets misread as "add game mechanics." | PROJECT.md explicitly excludes this. XP/streaks suit daily habit apps, not multi-week project work. Leaderboards create toxic competition in team-based learning. Adds complexity with no clear value for PBL. | Duolingo-style is UI/visual only — the progression path metaphor, not the reward mechanics. |
| Real-time chat/messaging | "Teams need to communicate." | Chat is a massive scope sink (presence, notifications, moderation, history). Students already use LINE/Discord. Building a worse version helps nobody. | Link to external chat (LINE group, Discord) from the group page. |
| Grading/scoring system | "Teachers need to grade work." | Duo is about progression and feedback, not numerical grades. Grading adds complexity (rubrics, grade books, GPA calc, export). Approval/rejection is the grading model here. | Approve/reject + comments. Teachers can note grades in comments if needed. |
| Student-to-student peer review | "Students should review each other's work." | Complex workflow (assignment, anonymity, rubrics, aggregation). Premature for v1 with < 100 users. Teachers are the reviewers. | Teacher reviews only in v1. Revisit if user base grows significantly. |
| Auto-grading / AI assessment | "AI can grade submissions automatically." | Submissions are files, links, and text about real business projects — not standardized answers. AI can't meaningfully assess a pitch deck or business plan in context. | Teacher review remains the quality gate. |
| Calendar/scheduling | "Students need to see deadlines on a calendar." | Calendar UIs are complex to build well. Due dates on to-dos are sufficient. Students can add to their own Google Calendar. | Show due dates inline on the progression path and to-do list |
| Discussion forums | "Classes need a place to discuss." | Forum software is its own product category. Low engagement in small cohorts (< 30 students). | Comments on submissions serve as focused discussion. General discussion happens on LINE. |
| Mobile native app | "Students want an app." | Massive scope increase (two codebases or React Native). Web responsive covers the use case for < 100 users. | Responsive web with PWA-like touches (add to home screen) |
| Analytics/reporting dashboard | "Teachers want to see data." | Premature optimization. With < 100 users and < 10 groups, teachers can see everything directly. Dashboard is a v2 feature once there's enough data to be meaningful. | Phase progress overview (differentiator above) covers the immediate need. |
| Plagiarism detection | "Need to check for copying." | Requires third-party integration (Turnitin etc.), complex for file-based submissions, irrelevant for project-based work (business plans, prototypes). | Not applicable to PBL domain. |

## Feature Dependencies

```
[Clerk Auth + Roles]
    └──requires──> [Classrooms]
                       └──requires──> [Groups]
                                          └──requires──> [Phases]
                                                             └──requires──> [To-dos]
                                                                                └──requires──> [Submissions]
                                                                                                   └──requires──> [Teacher Review + Comments]
                                                                                                                      └──requires──> [Approval Gating]

[R2 File Storage] ──enables──> [File Upload Submissions]

[Phases] ──enables──> [Duolingo Progression UI]

[Phases + To-dos] ──enables──> [Bulk Assignment Across Groups]

[Submissions] ──enables──> [Submissions Needing Review Dashboard]

[Groups + Phases] ──enables──> [Phase Progress Overview]

[Approval Gating] ──conflicts──> [Free-access Phases] (mutually exclusive per-phase, not system-wide)
```

### Dependency Notes

- **Everything requires Auth + Roles:** Clerk setup is the foundation. Without roles, no permission model.
- **Classrooms -> Groups -> Phases -> To-dos -> Submissions:** Strict hierarchy. Each layer depends on the one above. Schema must be designed for this chain from day 1.
- **Duolingo Progression UI requires Phases:** The visual path renders phase state (locked/active/completed). Phases must exist with state before the UI can be built.
- **Approval Gating and Free-access are per-phase toggles:** Not conflicting system-wide, but a phase is either gated or free. Simple boolean.
- **File uploads require R2:** R2 integration (presigned URLs, upload flow) must be working before file submissions.
- **Teacher dashboard features (review queue, progress overview) require submissions to exist:** Build the core submission flow first, then layer on teacher-facing views.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to run one cohort of Cocoon or Innovator's Academy.

- [ ] Clerk auth with teacher/student roles — foundation for everything
- [ ] Classrooms as top-level containers — separate Innovator's Academy from Cocoon
- [ ] Groups within classrooms — student teams
- [ ] Phases with ordering and state (locked/active/completed) — project structure
- [ ] To-dos within phases with submission mode flag (group/individual) — tasks
- [ ] To-do detail page with notes, attachments, submission form — the work happens here
- [ ] File (R2), link, and text submissions — flexible submission types
- [ ] Teacher review with comments — feedback loop
- [ ] Approval to unlock next phase — progression gating
- [ ] Free-access phase option — flexibility for non-gated phases
- [ ] Duolingo-style progression UI — the differentiating visual experience
- [ ] Basic email notifications (submission received, feedback given) — keep the loop tight
- [ ] Responsive design — students on phones

### Add After Validation (v1.x)

Features to add once the first cohort is running and we hear feedback.

- [ ] Bulk phase/to-do assignment across groups — when teachers have 5+ groups and manual setup is painful
- [ ] Phase template duplication — when teachers want to reuse structures
- [ ] Teacher dashboard: pending submissions queue — when review volume makes clicking into groups tedious
- [ ] Phase progress overview per classroom — when teachers can't track 10+ groups visually
- [ ] Due date display and overdue indicators — when deadlines become part of the workflow

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Analytics/reporting — needs enough data and users to be meaningful
- [ ] Student portfolio view — aggregate of all completed work across classrooms
- [ ] Peer review — only if cohorts grow large enough that teacher review doesn't scale
- [ ] API/integrations — only if other tools need to connect
- [ ] Multi-language support beyond Thai/English — only if platform expands beyond Innovator's

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth + roles (Clerk) | HIGH | LOW | P1 |
| Classrooms | HIGH | LOW | P1 |
| Groups | HIGH | LOW | P1 |
| Phases with state | HIGH | MEDIUM | P1 |
| To-dos with submission mode | HIGH | LOW | P1 |
| To-do detail page | HIGH | MEDIUM | P1 |
| File/link/text submissions | HIGH | MEDIUM | P1 |
| Teacher comments | HIGH | LOW | P1 |
| Approval gating | HIGH | MEDIUM | P1 |
| Free-access phases | MEDIUM | LOW | P1 |
| Duolingo progression UI | HIGH | HIGH | P1 |
| Email notifications | MEDIUM | LOW | P1 |
| Responsive design | HIGH | MEDIUM | P1 |
| Bulk assignment | MEDIUM | MEDIUM | P2 |
| Template duplication | MEDIUM | LOW | P2 |
| Teacher review dashboard | MEDIUM | MEDIUM | P2 |
| Progress overview | MEDIUM | MEDIUM | P2 |
| Due dates + overdue | MEDIUM | LOW | P2 |
| Analytics | LOW | HIGH | P3 |
| Student portfolio | LOW | MEDIUM | P3 |
| Peer review | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (first cohort)
- P2: Should have, add based on teacher feedback
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Google Classroom | Canvas LMS | Trello (education) | Duo (our approach) |
|---------|-----------------|------------|--------------------|--------------------|
| Project phases | No native concept. Flat assignment list with topics. | Modules, but linear not visual. | Lists as phases. Manual, no gating. | First-class phases with visual progression path and gating. |
| Team/group work | Limited. Individual assignments only, workarounds for groups. | Group assignments supported but clunky. | Boards per team. No submission concept. | Groups are core entity. Per-to-do group/individual toggle. |
| Submission types | Google Docs integration, file upload, links. | Files, text, URLs, media. Rich. | No submission concept (just card comments). | Files (R2), links, text. Sufficient for PBL. |
| Teacher review | Comments on submissions, private comments. | SpeedGrader, rubrics, inline annotation. | Card comments. No review workflow. | Comments + approve/reject. Intentionally simple. |
| Progress tracking | Completion checkmarks per assignment. | Module progress, analytics. | Manual card movement. | Visual Duolingo-style path showing phase states per group. |
| Approval gating | None. No prerequisite system. | Module prerequisites available. | None. | Core mechanic. Teacher approval unlocks next phase. |
| Visual design | Functional but utilitarian. | Enterprise LMS aesthetic. | Card-based, clean but generic. | Duolingo-inspired — colorful, progressive, motivating. |
| Thai language | UI available in Thai. | Thai supported. | Thai supported. | Purpose-built Thai primary with English technical terms. |
| Setup overhead | Low (Google ecosystem). | High (enterprise LMS). | Low (generic tool). | Low (purpose-built for this exact workflow). |

## Sources

- [Coursebox - Project-Based Learning Elements](https://www.coursebox.ai/blog/project-based-learning)
- [Teachfloor - Project-Based Learning Platform](https://www.teachfloor.com/project-based-learning-platform)
- [PBLWorks - Google Apps for Education](https://www.pblworks.org/blog/google-apps-education-enhances-project-based-learning)
- [Structural Learning - Google Classroom for Teachers](https://www.structural-learning.com/post/google-classroom)
- [Canvas LMS Review](https://uca.edu/lmsreview/test-page-canvas/)
- [925 Studios - Duolingo UX Breakdown](https://www.925studios.co/blog/duolingo-design-breakdown)
- [UX Planet - Gamification in Duolingo](https://uxplanet.org/ux-and-gamification-in-duolingo-40d55ee09359)
- [Wrike - Education Project Management](https://www.wrike.com/blog/education-project-management-software/)

---
*Feature research for: Project-based learning platform (education, Grades 9-12 + incubation)*
*Researched: 2026-09-17*
