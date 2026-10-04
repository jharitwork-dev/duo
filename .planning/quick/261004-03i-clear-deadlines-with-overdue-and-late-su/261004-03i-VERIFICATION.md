---
phase: quick-261004-03i
verified: 2026-10-04T05:55:00Z
status: passed
score: 10/10 must-haves verified
---

# Quick Task 261004-03i: Clear deadlines with overdue/late-submission status — Verification Report

**Task Goal:** Clear deadlines with overdue/late/on-time/due-soon status (first-submission lateness, Bangkok time), edit-after-submit before deadline ("อัปเดตงานที่ส่ง" same round; locked after deadline/approval; review-race rejection), student deadline UI + /student/deadlines, teacher dashboard (/teacher, classroom ภาพรวม tab matrix, /teacher/deadlines), date+time deadline inputs.

**Verified:** 2026-10-04
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Effective deadline = todo ?? phase; status computed in UTC, displayed Bangkok, first-submission lateness (exactly at deadline = on_time) | ✓ VERIFIED | `src/lib/deadline.ts` `getEffectiveDeadline`/`getDeadlineStatus`; `deadline.test.ts` covers boundary cases; passes under `TZ=UTC` and `TZ=America/New_York` (70/70 in deadline+dashboard suites) |
| 2 | Student node path deadline lines + red overdue dot; stepper phase deadline date | ✓ VERIFIED | `src/lib/node-deadline.ts` (`buildNodeDeadlines`, tested 5/5), `node-path.tsx` exports `OverdueDot`/`NodeDeadlineLine`, `phase-stepper.tsx` renders `StepperPhase.deadline` |
| 3 | Student to-do deadline banner + confirm-dialog late warning, submit still allowed | ✓ VERIFIED | `deadline-banner.tsx` wired into `student-todo-view.tsx`; `submission-confirm-dialog.tsx:108-113` renders "ส่งหลังกำหนด ระบบจะบันทึกว่าส่งช้า" when `late && mode !== 'update'` |
| 4 | Pending + not-yet-deadline stays editable; "อัปเดตงานที่ส่ง" rewrites same round (updated_at, createdAt untouched); after deadline read-only "เลยกำหนดแก้ไขแล้ว"; approved always locked; rejected → new round | ✓ VERIFIED | `src/server/actions/work-page.ts:272-384` `updateSubmittedWorkPage`; `work-page.ts` matrix tests (status × deadline × action) pass; `READ_ONLY_BANNER.deadline_passed` in `student-work-page.tsx:67` |
| 5 | Update after teacher reviewed/started reviewing is rejected server-side with 'ครูตรวจงานนี้แล้ว', page refreshes | ✓ VERIFIED | `work-page.ts:291-294` checks `latest.id`, `status`, `reviewedAt`, `reviewedBy` under `FOR UPDATE`; UPDATE itself guarded `WHERE status='pending'` (line 326); client calls `router.refresh()` on `reviewed` (`student-work-page.tsx`) |
| 6 | /student/deadlines sections เลยกำหนด/ใกล้ถึงกำหนด(48h)/กำลังจะมาถึง/ส่งแล้ว, linking to /todo/<id> | ✓ VERIFIED | `src/app/(dashboard)/student/deadlines/page.tsx` calls `getStudentDeadlines`; `student-deadline-list.tsx` renders the 4 sections |
| 7 | /teacher dashboard: summary chips across non-archived classrooms, one section per classroom, classroom cards below | ✓ VERIFIED | `src/app/(dashboard)/teacher/page.tsx` renders `DashboardSummaryChips` + per-classroom `GroupStatusCard` sections + existing `ClassroomCard` grid under "ห้องเรียนทั้งหมด" |
| 8 | Classroom page opens on ภาพรวม tab: group cards + matrix (pill + chip + date per cell, "—" for none), filterable by phase/problems/group search | ✓ VERIFIED | `teacher/classroom/[classroomId]/page.tsx:29,45-153` default tab 'overview', `getClassroomDashboard` wired, `classroom-matrix.tsx` implements `filterMatrixRows` |
| 9 | /teacher/deadlines cross-classroom timeline (เลยกำหนด/วันนี้/7วัน/ภายหลัง) with "ส่งแล้ว x/y กลุ่ม" | ✓ VERIFIED | `src/app/(dashboard)/teacher/deadlines/page.tsx` calls `getTeacherDeadlineTimeline`; `deadline-timeline.tsx` renders the 4 sections |
| 10 | Teachers set date+time deadlines (default 23:59 Bangkok), clearable; to-do form hints inherited phase deadline | ✓ VERIFIED | `deadline-input.tsx` uses `bangkokInputToUtc`/`utcToBangkokInput` only; wired in `phase-edit-form.tsx`, `todo-edit-form.tsx`, `assign-todo-dialog.tsx`; `createTodoSchema` in `src/server/actions/todo.ts` accepts `deadline` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/lib/deadline.ts` | Effective deadline, status, Bangkok formatting, input conversion | ✓ VERIFIED | All exports present (`getEffectiveDeadline`, `getDeadlineStatus`, `formatDeadline`, `formatDeadlineRelative`, `formatLateness`, `bangkokInputToUtc`, `utcToBangkokInput`); 35/35 unit tests pass under both TZs |
| `src/lib/deadline-dashboard.ts` | Pure aggregation: cells, matrix, group cards, counts, filters, timeline, student sections | ✓ VERIFIED | `buildClassroomDashboard`, `filterMatrixRows`, `summarizeDashboards`, `buildDeadlineTimeline`, `buildStudentDeadlineSections` all present and exercised by tests |
| `src/server/queries/deadline.ts` | Batched snapshot + 5 dashboard query functions | ✓ VERIFIED | `loadClassroomSnapshots` issues exactly 7 `Promise.all`'d `inArray`-filtered queries (constant, no per-row loop); `getClassroomDashboard`/`getTeacherDashboard`/`getTeacherDeadlineTimeline`/`getGroupDeadlineCells`/`getStudentDeadlines` all present and wired into pages |
| `src/server/actions/work-page.ts` (`updateSubmittedWorkPage`) | Deadline-aware save/attach/remove/upload gates + update action | ✓ VERIFIED | Present with FOR UPDATE locks, pending/reviewed guard, createdAt untouched, orphan-only R2 cleanup |
| `src/app/(dashboard)/teacher/deadlines/page.tsx` | Teacher deadline timeline page | ✓ VERIFIED | Exists, calls `getTeacherDeadlineTimeline`, renders `DeadlineTimeline`, listed as route `ƒ /teacher/deadlines` in build output |
| `src/app/(dashboard)/student/deadlines/page.tsx` | Student deadline list (replaces ComingSoon) | ✓ VERIFIED | No `ComingSoonCard` reference; renders `StudentDeadlineList` from real `getStudentDeadlines` data |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `work-page.ts` actions | `lib/work-page.ts` | `canEditWorkPage`/`canSubmitWorkPage` called with `{ deadline: access.deadline, now }` | ✓ WIRED |
| `updateSubmittedWorkPage` | submissions row | `SELECT ... FOR UPDATE` on latest scoped submission, compare id/status/reviewedAt, then UPDATE + replace submission_files | ✓ WIRED (`work-page-access.ts:72,146`, `work-page.ts:291-346`) |
| `server/queries/deadline.ts` | `lib/deadline-dashboard.ts` | snapshot (7 queries) → pure builders | ✓ WIRED |
| `student-work-page.tsx` | `updateSubmittedWorkPage` | submit bar in update mode | ✓ WIRED (`student-work-page.tsx:288`) |
| `teacher/classroom/[classroomId]/page.tsx` | `getClassroomDashboard` | 'overview' TabsContent | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `/teacher` dashboard | `overview` (`getTeacherDashboard`) | `loadClassroomSnapshots` → real DB rows via Drizzle `inArray` queries | Yes | ✓ FLOWING |
| `/student/deadlines` | `sections` (`getStudentDeadlines`) | classroom/group membership queries → batched snapshot → `buildStudentDeadlineSections` | Yes | ✓ FLOWING |
| Classroom "ภาพรวม" tab | `overview` (`getClassroomDashboard`, `.catch(() => null)`) | same batched snapshot; null-safe empty state "โหลดภาพรวมไม่สำเร็จ" on failure | Yes | ✓ FLOWING |
| `student-work-page.tsx` live lock | `clientLock` (`useNow` + `getWorkPageLock`) | server-provided `deadline`/`lock`/`serverNow` props, ticking client clock | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Deadline/dashboard/work-page unit matrix (TZ=UTC) | `TZ=UTC npm test` | 18 files, 413/413 passed | ✓ PASS |
| Timezone independence | `TZ=America/New_York npx vitest run deadline.test.ts deadline-dashboard.test.ts` | 70/70 passed | ✓ PASS |
| authz-coverage (comment-access untouched, work-page export surface) | `npx vitest run src/server/__tests__/authz-coverage.test.ts` | 53/53 passed | ✓ PASS |
| Full build | `npm run build` | Compiled successfully; `/teacher/deadlines`, `/student/deadlines` present as dynamic routes | ✓ PASS |
| tsc | `npx tsc --noEmit` | Clean, no output | ✓ PASS |
| eslint baseline | `npx eslint src --ignore-pattern '.claude/**'` | 15 problems (10 errors/5 warnings) — identical to pre-existing baseline, none in touched files | ✓ PASS |
| No browser-local deadline rendering | `grep -rn toLocaleDateString src \| grep -i deadline` | empty (only hit is unrelated shadcn `calendar.tsx` `data-day` attr) | ✓ PASS |
| No schema change | `git diff --stat ace35dc..85bdc1d -- src/db drizzle` | empty | ✓ PASS |

(Note: an initial unscoped `npx eslint .` run found 30 problems because this working tree contains an untracked `.claude/worktrees/agent-.../` directory that duplicates the entire `src/` tree — an artifact of the agent harness, not of this task. Scoping to `src/` with the worktree excluded reproduces the SUMMARY's claimed 15-problem baseline exactly.)

### Requirements Coverage

No `.planning/REQUIREMENTS.md` entry exists for `QUICK-261004-03i` (quick tasks are not tracked in REQUIREMENTS.md in this project) — not applicable.

### Anti-Patterns Found

None blocking. No TODO/FIXME/placeholder markers, no empty handlers, and no hardcoded-empty data flowing into rendered deadline/dashboard UI were found in the touched files.

### Human Verification Required

The SUMMARY itself lists a manual verification checklist (visual/responsive checks at 360px, OS-timezone-independent save round-trip, horizontal-scroll sticky column, bottom-tab-bar fit) that could not be run here because port 3000 is main's dev server and the database is the shared live instance. These are genuinely visual/interactive and appropriately deferred:

### 1. Responsive layout at 360px
**Test:** Open `/teacher`, the classroom "ภาพรวม" tab, and `/teacher/deadlines` on a 360px viewport.
**Expected:** Summary chips, group cards, the 5-segment tab list, and the bottom nav (5 items) all fit without overlap or horizontal overflow (other than the matrix's intentional `overflow-x-auto`).
**Why human:** Requires visual rendering; cannot be verified via grep/tsc/tests.

### 2. Deadline input timezone independence
**Test:** Set the OS/browser timezone to non-Bangkok, set a deadline via `DeadlineInput`, save, and reload.
**Expected:** The stored instant and the displayed Bangkok time are unaffected by the browser's local timezone.
**Why human:** Requires an actual browser environment with a non-Bangkok system clock; unit tests already assert the pure conversion functions but not an end-to-end browser round-trip.

### 3. Live lock transition and autosave flush
**Test:** Open a pending submission's work page with a deadline a minute or two in the future; wait for the deadline to pass while the page is open.
**Expected:** The page flips to read-only "เลยกำหนดแก้ไขแล้ว" live (via `useNow`), and any in-flight autosave is flushed first.
**Why human:** Timing-dependent, real-time UI behavior not practical to assert via static analysis.

### Gaps Summary

No gaps found. All 10 must-have truths, all 6 required artifacts, and all 5 key links verified against the actual codebase (not just SUMMARY claims). `tsc`, the project's full test suite under two time zones, the authz-coverage regression test, and `npm run build` all pass cleanly. No DB writes, migrations, or schema changes were made or are needed. Three items are flagged for human/visual verification per the SUMMARY's own manual-verification list, none of which are server-side-enforcement concerns (those are fully covered by the automated matrix tests and code inspection above).

---

_Verified: 2026-10-04T05:55:00Z_
_Verifier: Claude (gsd-verifier)_
