---
phase: 02-content-structure
plan: "02-03"
subsystem: classroom-management-ui
tags: [ui, classroom, groups, teacher-dashboard]
dependency_graph:
  requires: ["02-01"]
  provides: [teacher-classroom-list, classroom-dashboard, group-management-ui, student-group-picker]
  affects: [02-05]
tech_stack:
  added: []
  patterns: [server-component-page, client-form-with-rhf-zod, dialog-pattern, tabs-layout]
key_files:
  created:
    - src/app/(dashboard)/teacher/classroom/new/page.tsx
    - src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx
    - src/components/classroom/classroom-card.tsx
    - src/components/classroom/create-classroom-form.tsx
    - src/components/classroom/invite-code-display.tsx
    - src/components/classroom/classroom-settings-form.tsx
    - src/components/group/group-card.tsx
    - src/components/group/create-group-form.tsx
    - src/components/group/assign-student-dialog.tsx
    - src/components/group/student-group-picker.tsx
  modified:
    - src/app/(dashboard)/teacher/page.tsx
decisions:
  - "Inline tab content for classroom dashboard (groups + settings) rather than separate routes"
  - "ClassroomMember userId shown as-is since Clerk user display names require separate API call (deferred to UI polish phase)"
metrics:
  duration: "2min"
  completed: "2026-09-27"
---

# Phase 02 Plan 03: Teacher Classroom & Group Management UI Summary

Teacher classroom dashboard with create form, groups overview with tabs, invite code management, group CRUD, and student self-join picker -- all wired to 02-01 server actions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Teacher Classroom List + Create Form | dfc9cca | teacher/page.tsx, classroom-card.tsx, create-classroom-form.tsx, classroom/new/page.tsx |
| 2 | Classroom Dashboard (Groups + Settings) | 414d655 | [classroomId]/page.tsx, invite-code-display.tsx, classroom-settings-form.tsx |
| 3 | Group Management (Create, Assign, Self-Join) | 2ba24ed | group-card.tsx, create-group-form.tsx, assign-student-dialog.tsx, student-group-picker.tsx |

## What Was Built

### Teacher Classroom List (/teacher)
- Server component fetching classrooms with member/group counts via `getTeacherClassrooms`
- Grid of ClassroomCard components with name, description, badges for member count and group count
- Empty state with Thai copy ("ยังไม่มีห้องเรียน") and create button
- "สร้างห้องเรียน" button linking to /teacher/classroom/new

### Create Classroom Form (/teacher/classroom/new)
- React Hook Form + Zod validation for name (required), description (optional), maxGroupSize (optional)
- Calls `createClassroom` server action, toast feedback, redirects to classroom dashboard on success

### Classroom Dashboard (/teacher/classroom/[id])
- Breadcrumb navigation: "ห้องเรียน > [Name]"
- Tabs layout: "กลุ่ม" (Groups) and "ตั้งค่า" (Settings)
- Groups tab: grid of GroupCard components, empty state, create group button
- Settings tab: InviteCodeDisplay + ClassroomSettingsForm + student member list

### Invite Code Display
- Large monospace code display
- Copy code / copy link buttons with clipboard API
- Regenerate with AlertDialog confirmation calling `regenerateInviteCode`
- Local state updates after regeneration

### Classroom Settings Form
- Pre-filled form for name, description, maxGroupSize
- Calls `updateClassroomSettings` on submit
- Student member list with remove button calling `removeStudent`

### Group Management Components
- **GroupCard**: Card with name, member count badge, avatar stack, assign student button
- **CreateGroupForm**: Dialog with name input, calls `createGroup`, toast + refresh on success
- **AssignStudentDialog**: Dialog listing classroom students with "เพิ่ม" (Add) buttons, calls `assignStudent`
- **StudentGroupPicker**: For student self-join flow, shows groups as cards with spots remaining, "เข้าร่วม" (Join) button disabled when full

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

- **Student member display**: ClassroomSettingsForm and AssignStudentDialog show `member.userId` (Clerk ID string) instead of display name. Resolving display names requires Clerk Backend API calls which belong in a UI polish phase.

## Verification

All acceptance criteria verified via automated grep checks (PASS for all 3 tasks).

## Self-Check: PASSED

All 11 files confirmed present. All 3 commit hashes verified in git log.
