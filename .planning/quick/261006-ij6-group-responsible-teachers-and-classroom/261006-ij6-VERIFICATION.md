---
phase: quick-261006-ij6
verified: 2026-10-06T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
---

# Quick 261006-ij6 Verification

**Goal:** Group responsible teachers and per-classroom teacher rank.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Teacher self toggle | VERIFIED | `setGroupTeacher` allows self for classroom teachers; `GroupTeachersControl` is rendered on the teacher group page |
| 2 | Owner/superadmin assign anyone; others get a Thai error | VERIFIED | `canManageClassroomTeachers` + `decideGroupTeacherChange` (ERR_ASSIGN_OTHERS) |
| 3 | Many-to-many with rank in labels | VERIFIED | `group_teachers` unique(group_id, user_id); the query sorts and ranks |
| 4 | Rank set by owner/superadmin, owner fixed, null = ครู | VERIFIED | `setClassroomTeacherRank` uses `loadManagedClassroom` and `decideSetTeacherRank`; the select is in classroom-teachers.tsx |
| 5 | Label on the 5 surfaces | VERIFIED | GroupCard, GroupStatusCard, group page control, student page (line 164), review-card |
| 6 | Review `?mine=1` filter | VERIFIED | Filters sourceRows before `buildReviewItems`; `mine` is forwarded in tabs and stepper; toggle link on the page |
| 7 | Removing a teacher deletes their group_teachers rows | VERIFIED | `tx.delete(groupTeachers)` with a subquery on the classroom's groups, in the same transaction as the member delete |
| 8 | Additive migration script with dry-run; students get publicName only | VERIFIED | Migration file exists; the query has no `.email`/`.name` and uses `publicName` |

## Spot-checks
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 557/557 pass.
- I did not run the build or the migration, as instructed.

## Anti-patterns
None found.

## Human verification (needs the live DB and UI)
1. As a teacher member, toggle "ดูแลกลุ่มนี้". Expect the label to update on the group page, the cards, the student home and the review cards.
2. As owner, set a teacher to ผู้ช่วยครู and assign another teacher to a group. Expect "ชื่อ · ผู้ช่วยครู" in labels, and no permission change.
3. On /teacher/review, toggle "กลุ่มที่ฉันดูแล". Expect items and counts to filter, and the filter to survive tab/phase clicks.
4. Remove a teacher from the classroom. Expect their labels to disappear.
5. Check that student pages show only publicName and no emails.
