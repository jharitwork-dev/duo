# Phase 2: Content Structure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 02-Content Structure
**Areas discussed:** Classroom management, Group creation, Phase & to-do UI, To-do detail page, Student nav flow, Phase templates, Teacher-student views

---

## Classroom Management

### Q1: How do students join a classroom?

| Option | Description | Selected |
|--------|-------------|----------|
| Invite code | Teacher generates a code, students enter it | |
| Teacher adds manually | Teacher types student emails/names | |
| Both | Manual add OR invite code | ✓ |

### Q2: What does the classroom page show to a teacher?

| Option | Description | Selected |
|--------|-------------|----------|
| Groups list + stats | List of groups with member count and progress | |
| Full dashboard | Groups, recent submissions, announcements, settings | ✓ |
| You decide | Claude picks | |

### Q3: How does the invite code work?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple code | 6-char code, student enters on join page | |
| Invite link | URL like build.innovators.co.th/join/ABC123 | |
| Both code + link | Generate both | ✓ |

### Q4: Full dashboard sections?

| Option | Description | Selected |
|--------|-------------|----------|
| Groups overview | All groups with member count and progress | ✓ |
| Recent submissions | Latest submissions needing review | ✓ |
| Classroom settings | Edit name, manage invite code, remove students | ✓ |

---

## Group Creation

### Q1: How are students assigned to groups?

| Option | Description | Selected |
|--------|-------------|----------|
| Teacher assigns | Manual drag/select into groups | |
| Students pick | Students join themselves | |
| Both | Teacher can assign OR students self-join | ✓ |

### Q2: Group size limits?

| Option | Description | Selected |
|--------|-------------|----------|
| No limit | Any number per group | |
| Teacher sets max | Teacher configures max size per classroom | ✓ |
| Fixed range | System enforces 2-5 | |

---

## Phase & To-do UI

### Q1: How does the teacher create phases?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline add | '+Add Phase' button, type name inline | ✓ |
| Modal form | Dialog with all fields | |
| Full page | Separate page | |

### Q2: Can teachers reorder?

| Option | Description | Selected |
|--------|-------------|----------|
| Drag & drop | Drag to reorder | ✓ |
| Up/down arrows | Arrow buttons | |
| Both | Drag + arrows | |

### Q3: How to edit phase details?

| Option | Description | Selected |
|--------|-------------|----------|
| Click to expand | Expand inline showing editable fields | ✓ |
| Side panel | Slide-in panel like Notion | |
| Edit dialog | Modal form | |

### Q4: How to add to-dos?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline add | '+Add To-do' inside phase | ✓ |
| Modal form | Dialog with all fields | |

### Q5: Group page layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical list | Phases as expandable sections | ✓ |
| Kanban columns | Phases as columns, to-dos as cards | |
| You decide | Claude picks | |

### Q6: Where to attach files to to-dos?

| Option | Description | Selected |
|--------|-------------|----------|
| In expanded to-do | Upload in inline expansion | ✓ |
| On detail page | Manage on separate page | |
| Both | Quick attach inline, full on detail | |

### Q7: Expanded to-do fields?

All selected: Notes/instructions, Submission mode, Deadline, Attachments

### Q8: Notes format?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text | Simple textarea | ✓ |
| Rich text (Tiptap) | Bold, lists, links | |

### Q9: Delete phases/to-dos?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes with confirm | Confirmation dialog | |
| Soft delete | Archive/hide, can restore | ✓ |
| Yes, no confirm | Immediate delete | |

### Q10: Empty group state?

| Option | Description | Selected |
|--------|-------------|----------|
| CTA to create | Big button to create first phase | |
| Template picker | Offer starter templates or blank | ✓ |
| You decide | Claude picks | |

---

## Student Navigation

### Q1: Student home page?

| Option | Description | Selected |
|--------|-------------|----------|
| Classroom cards | Cards for each classroom | |
| Direct to group | Skip to group if only 1 classroom | ✓ |
| Both | Auto-redirect if 1, list if multiple | |

### Q2: After entering classroom?

| Option | Description | Selected |
|--------|-------------|----------|
| Their group page | Direct to phases/to-dos | ✓ |
| Classroom overview | See info + group | |

---

## Phase Templates

### Q1: What starter templates?

| Option | Description | Selected |
|--------|-------------|----------|
| Innovator's defaults | Pre-built matching programs | ✓ |
| Generic + custom | Generic templates + blank | |
| Blank only for v1 | Just create button | |

**User's addition:** 4 templates: Market Research, Product Development, Pitch Preparation, Business Model Canvas

### Q2: Template source?

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded | Built into app | |
| Teacher-created | Teachers save own templates | ✓ |
| Both | Built-in + teacher-created | |

---

## Teacher-Student Views

### Q1: Same or different to-do page?

| Option | Description | Selected |
|--------|-------------|----------|
| Same + extra controls | Same layout, teacher sees edit/review tools | ✓ |
| Separate views | Different pages for each role | |
| You decide | Claude picks | |

### Q2: Teacher preview?

| Option | Description | Selected |
|--------|-------------|----------|
| No preview needed | Teacher view is close enough | ✓ |
| Preview button | 'View as student' toggle | |

---

## Claude's Discretion

- Drag & drop library choice
- Inline add animation/interaction details
- Template data structure
- Attachment upload UX within expanded to-do
- Student classroom card design
- Mobile responsive behavior for drag & drop

## Deferred Ideas

None — discussion stayed within phase scope
