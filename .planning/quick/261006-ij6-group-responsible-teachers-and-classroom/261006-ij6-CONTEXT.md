# Quick Task 261006-ij6: Group responsible teachers + classroom teacher rank - Context

**Gathered:** 2026-10-06
**Status:** Ready for planning

<domain>
## Task Boundary

A classroom can have several teachers (261005-x9e added classroom teacher membership and the "ครูประจำห้อง" card).
Add:
1. Group responsibility: teachers say which groups they mainly look after; a label shows students and teachers who looks after each group.
2. Teacher rank per classroom: ครู (teacher) or ผู้ช่วยครู (assistant teacher).

Additive DB migration through a reviewed script in src/db/migrations (--dry-run, then --apply). Never drizzle-kit push. The DB is shared by dev and the live site.

</domain>

<decisions>
## Implementation Decisions

### Teachers per group
- **Many-to-many.** A group can have several responsible teachers (for example a ครู plus a ผู้ช่วยครู), and a teacher can look after several groups. The label lists all of them.
- Only teachers of that classroom can be responsible: the owner, or rows in classroom_members with role 'teacher'.

### Who assigns
- **Self-service:** a classroom teacher can mark or unmark *themselves* as responsible for any group in that classroom ("ดูแลกลุ่มนี้" toggle).
- **Override:** the classroom owner and superadmins can assign or unassign *any* classroom teacher to or from any group.
- When a teacher is removed from the classroom, their group-responsibility rows for that classroom are removed too.

### Rank
- **Values:** ครู (`teacher`) or ผู้ช่วยครู (`assistant`). The rank belongs to each classroom (teacher A can be ครู in one room and ผู้ช่วยครู in another).
- **Who sets it:** the owner or a superadmin, in the "ครูประจำห้อง" card. The owner is always ครู and their rank can't be changed. New teachers start as ครู.
- **Display only:** rank does not change permissions. A ผู้ช่วยครู can still edit the classroom, review work, and so on, exactly like a ครู.
- **Where shown:** the rank appears next to the teacher's name in the ครูประจำห้อง card and in every responsible-teacher label.

### Where the "ครูที่ดูแล" label appears
- **Teacher group cards:** the groups tab and the overview status cards in the classroom dashboard.
- **Teacher group page header:** also the place to toggle "ดูแลกลุ่มนี้" and, for the owner or a superadmin, to assign others.
- **Student home:** the student sees who looks after their group, by name and rank.
- **Teacher review list:** each item shows the group's responsible teachers, plus a "กลุ่มที่ฉันดูแล" filter.

### Claude's Discretion
- **Schema shape:** for example, a new `group_teachers (group_id, user_id, created_at)` table with a unique (group_id, user_id), plus a `teacher_rank` column on classroom_members (nullable or defaulted, used only for role='teacher'). Alternatively, the owner's rank could be implied.
- **Label styling and wording:** reuse the existing pills and MemberIdentity.
- **Student-facing names:** use publicDisplayName (students must never see teacher emails).
- **Empty state:** no label, or "ยังไม่มีครูดูแล", on teacher views only.

</decisions>

<specifics>
## Specific Ideas

- The UI is in Thai.
- Follow the patterns from 261005-x9e:
  - pure decision functions in src/lib with vitest tests
  - server actions returning ActionResult with Thai errors
  - canManageClassroomTeachers for owner/superadmin overrides
- Students must only ever see display names (publicName), never emails.

</specifics>

<canonical_refs>
## Canonical References

- .planning/quick/261005-x9e-superadmin-and-classroom-owner-assign-te/ (PLAN, SUMMARY): classroom teacher membership, ClassroomTeachers card, canManageClassroomTeachers
- STATE.md Blockers/Concerns: migration rules (never drizzle-kit push; scripts in src/db/migrations with --dry-run/--apply)

</canonical_refs>
