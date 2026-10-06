---
phase: quick-261006-ij6
plan: 01
subsystem: classroom / groups / review
tags: [group-teachers, teacher-rank, migration, review-filter]
requires: [quick-261005-x9e]
provides: [group_teachers table, classroom_members.teacher_rank, setGroupTeacher, setClassroomTeacherRank, getGroupTeachersByClassroom, ResponsibleTeachersLabel, GroupTeachersControl, review ?mine=1]
affects: [teacher classroom page, teacher group page, student group home, /teacher/review]
tech-stack:
  added: []
  patterns: [pure decisions in src/lib + vitest, additive reviewed migration script, publicName-only data for student-facing labels]
key-files:
  created:
    - src/db/migrations/2026-10-06-group-teachers-and-rank.ts
    - src/lib/group-teachers.ts
    - src/lib/__tests__/group-teachers.test.ts
    - src/server/queries/group-teachers.ts
    - src/server/actions/group-teacher.ts
    - src/components/group/responsible-teachers.tsx
  modified:
    - src/db/schema/groups.ts
    - src/db/schema/classrooms.ts
    - src/server/actions/classroom.ts
    - src/server/queries/classroom.ts
    - src/components/classroom/classroom-teachers.tsx
    - src/app/(dashboard)/teacher/classroom/[classroomId]/page.tsx
    - src/app/(dashboard)/teacher/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/components/group/group-card.tsx
    - src/components/dashboard/group-status-card.tsx
    - src/app/(dashboard)/student/classroom/[classroomId]/group/[groupId]/page.tsx
    - src/server/queries/review.ts
    - src/lib/review.ts
    - src/app/(dashboard)/teacher/review/page.tsx
    - src/components/review/review-card.tsx
    - src/components/review/review-tabs.tsx
    - src/components/review/review-phase-stepper.tsx
decisions:
  - "teacher_rank is a nullable column on classroom_members (null = ครู); owner is always ครู via effectiveTeacherRank"
  - "Responsible-teacher labels use publicName everywhere (teacher views included) so one query serves students and teachers"
  - "Unassigning (responsible=false) skips the target-is-classroom-teacher check so stale rows can always be removed"
  - "mine filter is applied to source rows before buildReviewItems so tab counts and stepper badges match the list"
metrics:
  duration: ~8min
  completed: 2026-10-06
---

# Quick 261006-ij6: Group responsible teachers + classroom teacher rank Summary

Groups can now have several responsible teachers ("ครูที่ดูแล"). A classroom teacher can mark or unmark themselves, and the owner or a superadmin can assign anyone. The label shows on group cards, the teacher group page, the student home and review cards. `/teacher/review` has a "กลุ่มที่ฉันดูแล" filter (`?mine=1`). Each classroom teacher also has a display-only rank, ครู or ผู้ช่วยครู, which the owner or a superadmin sets in the ครูประจำห้อง card.

**Migration NOT applied. The orchestrator must run --apply BEFORE deploying, because the new code selects classroom_members.teacher_rank and group_teachers.**

```
npx tsx src/db/migrations/2026-10-06-group-teachers-and-rank.ts --apply
```

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Schema, additive migration script, pure decisions + tests (TDD) | 385e823 |
| 2 | Server actions/queries, rank select, group page control | 78739de |
| 3 | Labels on cards/student home/review + กลุ่มที่ฉันดูแล filter | af30d63 |

## --dry-run output (rolled back)

```
MODE: DRY RUN (will roll back)
BEFORE: classroom_members=42 groups=20 group_members=33
BEFORE columns: classroom_members.{id, classroom_id, user_id, role, joined_at}
AFTER:  classroom_members=42 groups=20 group_members=33
AFTER columns (new):
  classroom_members.teacher_rank text NULL
  group_teachers.id text NOT NULL
  group_teachers.group_id text NOT NULL
  group_teachers.user_id text NOT NULL
  group_teachers.created_at timestamp without time zone NOT NULL default now()
AFTER indexes (new):
  group_teachers_group_id_user_id_unique: UNIQUE btree (group_id, user_id)
  group_teachers_pkey: UNIQUE btree (id)
  group_teachers_user_id_idx: btree (user_id)
AFTER foreign keys / unique (new):
  group_teachers.group_teachers_group_id_groups_id_fk: FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
  group_teachers.group_teachers_group_id_user_id_unique: UNIQUE (group_id, user_id)
AFTER group_teachers=0 (expected 0)
AFTER classroom_members with teacher_rank set=0 (expected 0)
DRY RUN — rolled back
```

The executor did not run `--apply` or any drizzle-kit command.

## Verification

- `npx vitest run`: 557/557 pass, including 20 new group-teachers tests.
- `npx tsc --noEmit` is clean, eslint is clean on all touched files, and `npm run build` succeeds.
- `grep "delete(groupTeachers)" src/server/actions/classroom.ts` matches the cleanup inside `removeClassroomTeacher`'s transaction (D-04).
- `grep "\.email" src/server/queries/group-teachers.ts` finds nothing, so labels use publicName only.

## Deviations from Plan

**1. [Rule 2 - UX] The remove-teacher confirm dialog now warns about group responsibilities.** It says "การดูแลกลุ่มในห้องนี้ของครูคนนี้จะถูกนำออกด้วย", because D-04 now deletes those rows as well.

**2. [Minor] The "กลุ่มที่ฉันดูแล" toggle link uses `aria-current` instead of `aria-pressed`.** `aria-pressed` is not valid on a link role.

Otherwise the plan was executed as written.

## Known limitations / notes

- `?mine=1` stays set when you switch tabs or phases. It is not kept when you switch classroom (the picker) or go back from a review detail page. This is intentional, because the responsible groups differ for each classroom.
- `getGroupTeachersByClassroom` errors are caught on every page and fall back to no labels. Until the migration is applied, this hides labels but does not stop the pages from failing. `getClassroomById` now selects `teacher_rank`, so the migration must be applied first.

## Known Stubs

None.

## Self-Check: PASSED
- Files created exist; commits 385e823, 78739de, af30d63 present in git log.
