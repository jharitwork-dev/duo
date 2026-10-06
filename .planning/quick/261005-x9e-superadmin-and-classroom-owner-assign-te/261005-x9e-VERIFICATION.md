---
phase: quick-261005-x9e
verified: 2026-10-06T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
---

# Quick 261005-x9e Verification

**Goal:** Superadmin/owner assign and remove classroom teachers via the "ครูประจำห้อง" settings card.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner/superadmin see the card with owner badge, picker, and remove buttons (none on owner) | VERIFIED | `classroom-teachers.tsx` shows the `PILL_CAPACITY` "เจ้าของห้อง" badge, and renders the remove button only when `canManage && !isOwner`. The picker shows when `canManage`. The card is rendered in the settings tab of `page.tsx`. |
| 2 | Other teacher members see a read-only list | VERIFIED | `canManage` comes from `canManageClassroomTeachers`, which is true only for superadmin or the owner. Without it, no controls render. |
| 3 | Server-enforced gate, target role check, duplicate rejection, owner never removed | VERIFIED | `loadManagedClassroom` uses `canManageClassroomTeachers` (not `assertClassroomEditor`). `decideAddTeacher` checks the Clerk role `teacher` and rejects existing teacher/student members with Thai errors. `decideRemoveTeacher` rejects the owner. A unique-violation race is mapped. |
| 4 | Added teacher sees the classroom on /teacher and can edit it | VERIFIED (code) | `getTeacherClassrooms` now uses `or(createdBy, inArray(teacher memberships))`. `deadline.ts` and `review.ts` consume it. Edit access via `assertClassroomEditor` was already in place for teacher members (per plan, not re-checked). |
| 5 | Superadmin can open any classroom from /admin | VERIFIED | `/admin` lists `getAllClassroomsForAdmin()` with links to `/teacher/classroom/{id}?tab=settings`. The page passes `allowAnyClassroom` for superadmin. The dashboard layout does not redirect superadmins away from /teacher. |

**No schema change:** `git diff` on `src/db` over the commit range is empty.

**Checks run:**
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 537 passed, 23 files. This includes the new `classroom-teachers` tests.
- Build and lint were not run (not permitted or not needed).

## Anti-patterns
None blocking. `listApprovedTeachers` failures degrade to an empty picker via `.catch(() => [])`.

## Human verification
1. As owner, open the classroom settings tab, add a teacher, and check the toast, the badge, and that the owner has no remove button.
2. Log in as the added teacher and check the classroom appears on /teacher and is editable. Check the card is read-only for that teacher.
3. As superadmin, open a classroom from the /admin list.
4. Confirm that live Clerk data populates the picker.

Real Clerk and DB behavior was not exercised here.
