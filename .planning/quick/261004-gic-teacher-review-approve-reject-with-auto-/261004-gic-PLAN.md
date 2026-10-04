---
phase: quick-261004-gic
plan: 01
type: execute
wave: 1
depends_on: [quick-261004-03i]   # run ONLY after 03i Tasks 2 + 3 are merged on main
files_modified:
  # Task 1 — data layer (pure helpers, actions, queries, authz)
  - src/lib/review.ts
  - src/lib/__tests__/review.test.ts
  - src/server/review-helpers.ts
  - src/server/actions/review.ts
  - src/server/comment-access.ts
  - src/server/actions/comment.ts
  - src/server/queries/review.ts
  - src/server/__tests__/authz-coverage.test.ts
  # Task 2 — review list + nav badge
  - src/app/(dashboard)/teacher/review/page.tsx
  - src/components/review/review-phase-stepper.tsx
  - src/components/review/review-tabs.tsx
  - src/components/review/review-card.tsx
  - src/components/review/review-classroom-picker.tsx
  - src/components/review/review-success-banner.tsx
  - src/app/(dashboard)/layout.tsx
  - src/components/cocoon/app-shell.tsx
  - src/components/cocoon/bottom-tab-bar.tsx
  - src/components/cocoon/desktop-header.tsx
  - src/components/cocoon/nav-items.ts
  # Task 3 — review detail + dialogs + entry links
  - src/app/(dashboard)/teacher/review/[submissionId]/page.tsx
  - src/components/review/review-submission-card.tsx
  - src/components/review/review-history-card.tsx
  - src/components/review/review-actions.tsx
  - src/components/review/send-back-dialog.tsx
  - src/components/review/pass-dialog.tsx
  - src/components/work-page/teacher-work-page-panel.tsx
  - src/components/student/submission-status-view.tsx
autonomous: true
requirements: [REV-01, REV-02, REV-03, REV-04, PHASE-05, TOOL-03]

must_haves:
  truths:
    - "A classroom editor can approve (optional note) or send back (required feedback) the LATEST pending submission of a to-do owner; anyone else throws (assertTodoEditor)"
    - "Reviewing a stale submission (a newer one exists in scope) returns 'งานนี้มีการส่งฉบับใหม่แล้ว'; reviewing an already-reviewed one returns 'งานนี้ตรวจแล้ว'; nothing is written"
    - "Review transactions lock FOR UPDATE in the order group row → work page row → submission row, and the UPDATE is guarded by status = 'pending'; a racing student 'อัปเดตงานที่ส่ง' (03i) gets reviewed:true"
    - "Send-back feedback and the optional approval note are stored as teacher comments with submission_id = the reviewed submission, so the fgj thread AND the student's 'คำแนะนำจากผู้ตรวจ' card show them"
    - "After an approval, if every non-archived to-do of that phase for that group has its latest submission approved (group: the group's latest; individual: every CURRENT member's latest), the group's phase becomes completed and the next gating phase becomes active — in the same transaction"
    - "/teacher/review shows the Figma list: classroom picker (>1 classroom), Phase stepper, รอตรวจ/รอแก้ไข/ผ่าน tabs, cards with 'ส่งเมื่อ … · ครั้งที่ n · k ไฟล์', 'เช็คงาน'/'ดูงาน', รอแก้ไข hint and the ผ่าน success banner"
    - "The ตรวจงาน nav tab (mobile + desktop) shows the pending-review count badge for teachers/superadmins"
    - "/teacher/review/[submissionId] shows ส่งครั้งที่ n (snapshot via WorkPageViewer + files with 'เปิด'), ประวัติการส่ง, คำแนะนำครั้งก่อน (when the previous round was rejected), footer hint, ให้แก้ไข/ให้ผ่าน dialogs with exact Figma copy, and the fgj comment thread"
  artifacts:
    - path: "src/lib/review.ts"
      provides: "Pure computePhaseCompletion, checkReviewEligibility, buildReviewItems, copy constants"
      exports: ["computePhaseCompletion", "checkReviewEligibility", "buildReviewItems", "REVIEW_MESSAGES", "REVIEW_TAB_LABEL"]
    - path: "src/lib/__tests__/review.test.ts"
      provides: "Unit tests for completion (group/individual/archived/free-access/last phase/manual override) + eligibility + list building"
    - path: "src/server/actions/review.ts"
      provides: "approveSubmission, rejectSubmission server actions"
      exports: ["approveSubmission", "rejectSubmission"]
    - path: "src/server/review-helpers.ts"
      provides: "Plain-module transaction helpers: lockReviewTarget, applyAutoPhaseUnlock"
    - path: "src/server/queries/review.ts"
      provides: "getReviewList, getReviewDetail, getPendingReviewCount"
    - path: "src/app/(dashboard)/teacher/review/page.tsx"
      provides: "Review list page (replaces ComingSoon)"
    - path: "src/app/(dashboard)/teacher/review/[submissionId]/page.tsx"
      provides: "Review detail page"
  key_links:
    - from: "src/server/actions/review.ts"
      to: "submissions row lock"
      via: "tx.select().from(submissions)...for('update') then UPDATE ... WHERE status = 'pending'"
      pattern: "for\\('update'\\)"
    - from: "src/server/actions/review.ts (approve)"
      to: "group_phase_progress"
      via: "applyAutoPhaseUnlock(tx, …) → computePhaseCompletion → onConflictDoUpdate upserts"
      pattern: "applyAutoPhaseUnlock\\("
    - from: "src/server/actions/review.ts"
      to: "comments table"
      via: "insertThreadComment(tx, { submissionId: target.id, authorRole: 'teacher' })"
      pattern: "insertThreadComment\\("
    - from: "src/components/review/review-actions.tsx"
      to: "approveSubmission / rejectSubmission"
      via: "dialog confirm → action → router.push('/teacher/review?…&tab=…&done=…')"
      pattern: "(approve|reject)Submission\\("
    - from: "src/app/(dashboard)/layout.tsx"
      to: "getPendingReviewCount"
      via: "badge prop → AppShell → BottomTabBar/DesktopHeader"
      pattern: "getPendingReviewCount\\("
---

<objective>
Ship the teacher review flow from Figma (desktop design/mac/home-11..17, mobile refs 07/08): a review list at
`/teacher/review`, a review detail page with "ให้แก้ไข" / "ให้ผ่าน" dialogs, review server actions that lock rows and post the
feedback into the fgj thread, and automatic per-group phase completion + next-phase unlock (REV-04 / PHASE-05).

Purpose: "ครูยังตรวจงานไม่ได้หรอ" — teachers can only view today. Approval must gate progression (Core Value).
Output: pure helpers + tests, `src/server/actions/review.ts`, review queries, two pages, dialogs, nav badge.

PRECONDITION: 261004-03i must be fully merged (Tasks 2 and 3). Before Task 1, run `git log --oneline | head` and confirm the
03i Task 2/3 commits + SUMMARY exist; if not, STOP and report. Several files below (nav-items.ts, teacher-work-page-panel.tsx,
submission-status-view.tsx) are also edited by 03i — always re-read the CURRENT file before editing and keep 03i's changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261004-gic-teacher-review-approve-reject-with-auto-/261004-gic-CONTEXT.md
@.planning/quick/261004-03i-clear-deadlines-with-overdue-and-late-su/261004-03i-HANDOFF.md
@.planning/quick/261004-fgj-task-discussion-thread-for-teachers-and-/261004-fgj-SUMMARY.md
@AGENTS.md

HARD SAFETY RULES (shared DB with the live site):
- NEVER run `drizzle-kit push/generate/migrate`, seeds, `--apply` scripts, or any write against DATABASE_URL.
- No schema change is expected (submissions.status / reviewed_by / reviewed_at and comments.submission_id already exist).
  If one turns out to be required: write an additive script under src/db/migrations with --dry-run/--apply, run --dry-run only,
  and record it in the SUMMARY for the user.
- Next.js in this repo has breaking changes: check `node_modules/next/dist/docs/` before using page props / searchParams /
  revalidation APIs (params and searchParams are Promises — see src/app/(dashboard)/todo/[todoId]/page.tsx).
- Every task ends with `npx tsc --noEmit`, `npm run lint` (baseline: 10 errors / 5 warnings, none may be in touched files),
  and `npm test`. Task 3 also runs `npm run build`.

<interfaces>
<!-- Extracted from the codebase at 6e311fc. Re-verify after 03i merges. -->

src/lib/action-result.ts:
  export type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };
  export function actionError(error: string)

src/server/phase-helpers.ts (plain module):
  export type DbLike = typeof db | <transaction tx>;
  export async function assertTodoEditor(todoId, userId): Promise<{ todo, classroom }>   // throws if not editor
  export async function assertClassroomEditor(classroomId, userId)
  export async function loadClassroomAccess(classroomId, userId): { classroom, allowed }

src/server/work-page-access.ts (plain module):
  export type WorkPageOwner = { groupId: string; userId: string | null };   // group mode: userId null; individual: student id
  export async function findPage(tx, todoId, owner, opts?: { lock?: boolean })
  export async function getOrCreatePage(tx, todoId, owner, userId, opts?: { lock?: boolean; markAuthor?: boolean })
  export async function latestScopedSubmission(tx, todoId, mode, groupId, userId, opts?: { lock?: boolean })
    -> { id, status, reviewedAt, reviewedBy, createdAt, updatedAt } | null
  // Student updateSubmittedWorkPage (03i) locks: page row FOR UPDATE, then latest submission FOR UPDATE, and rejects with
  // reviewed:true when status !== 'pending' || reviewedAt || reviewedBy. Its comment: "NOTE for 261004-gic: review actions MUST
  // also SELECT ... FOR UPDATE the submission row and check status = 'pending' before writing".

src/server/actions/comment.ts ('use server' — every export becomes an action; do NOT export helpers from it):
  postComment: resolveCommentThread → normalizeCommentBody(body) (src/lib/comment-thread.ts, returns {ok, body}) →
  tx: getOrCreatePage(tx, todoId, thread.owner, userId, { markAuthor: false }) → tx.insert(comments).values({ workPageId,
  submissionId, userId, authorRole: thread.isEditor ? 'teacher' : 'student', content }).

src/db/schema: submissions { id, todoId, submittedBy, groupId, status 'pending'|'approved'|'rejected', content (WorkPageDoc),
  reviewedBy, reviewedAt, createdAt, updatedAt }; submissionFiles { submissionId, fileName, fileKey, contentType, fileSize };
  todos { id, phaseId, groupId (to-dos are per-group copies), title, submissionMode 'group'|'individual', isArchived, deadline };
  phases { id, classroomId, name, orderIndex, isFreeAccess, isArchived }; groupPhaseProgress { groupId, phaseId, status
  'locked'|'active'|'completed', updatedAt } unique(groupId, phaseId); groups { id, classroomId, name };
  groupMembers { groupId, userId }; comments { submissionId, workPageId, userId, authorRole, content, deletedAt }.

src/lib/node-path.ts:
  export function resolveGroupPhaseStatuses(phases: {id}[] /* non-archived, ordered */, rows: {phaseId,status}[])
    -> Record<phaseId, PhaseStatus>   // missing row: index 0 active, rest locked
src/lib/todo-review-status.ts: summarizeTodoReview(rowsNewestFirst, mode, groupId) (latest-per-owner pattern to mirror)
src/server/queries/submission.ts: isInSubmissionScope(row, mode, groupId, userId); getSubmissionHistory (student-scoped; its
  `comments` `with` clause = latest non-deleted teacher comment per submission → reviewerComment — mirror it for teachers)
src/server/queries/classroom.ts: getTeacherClassrooms(userId) (rows incl. isArchived, createdAt)
src/lib/user-directory.ts: getUserDirectory(ids) -> Map<id, { name, publicName, imageUrl }>
src/lib/format.ts: formatSubmissionDate(date)
src/components/cocoon/status-pill.tsx: <StatusPill status="none|locked|pending|rejected|approved" size="sm|lg|xl" label? />
src/components/cocoon/ui.ts: PAGE_BODY, CARD, CARD_TITLE, CARD_META, BTN_INFO (blue), BTN_APPROVE (green), BTN_TERTIARY,
  TEXTAREA, LABEL, SEGMENT_LIST, SEGMENT_TRIGGER, DIALOG_PANEL, DIALOG_TITLE, EMPTY_CARD.  Tokens: cocoon-blue, -blue-soft,
  -green, -yellow, -orange, -ink, -muted, -subtle, -line, -track.  No yellow button const yet → add BTN_WARN only inside review
  components (local const) — do not edit ui.ts.
src/components/ui/dialog.tsx (shadcn Dialog), src/components/ui/textarea.tsx, sonner toast.
src/components/work-page/work-page-viewer.tsx: <WorkPageViewer content={doc} />
src/components/student/submission-status-view.tsx: export function SubmittedFiles({ files: {id,fileName,fileSize}[], className })
  (opens files through getSubmissionFileUrl — editors are allowed)
src/components/comment/comment-thread-section.tsx: async <CommentThreadSection todoId groupId? studentId? viewer="teacher" />
  + CommentThreadSkeleton (wrap in <Suspense>)
src/components/cocoon/nav-items.ts: NavItem { href, label, desktopLabel?, icon, match }; TEACHER_REVIEW href '/teacher/review'
src/app/(dashboard)/layout.tsx renders <AppShell role={navRole}>; AppShell → BottomTabBar({role}) + DesktopHeader({role})
src/server/__tests__/authz-coverage.test.ts: SCANNED file list + EDITOR_CHECK /assert(Classroom|Group|Phase|Todo)Editor\(/
  applied to every export whose body contains `requireRole(ROLES.TEACHER`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure review helpers + tests, review actions with row locks / comment posting / auto phase unlock, review queries, authz coverage</name>
  <files>src/lib/review.ts, src/lib/__tests__/review.test.ts, src/server/review-helpers.ts, src/server/actions/review.ts, src/server/comment-access.ts, src/server/actions/comment.ts, src/server/queries/review.ts, src/server/__tests__/authz-coverage.test.ts</files>
  <behavior>
    computePhaseCompletion (src/lib/review.ts), input:
      { phases: {id, isFreeAccess}[] (non-archived, ordered by orderIndex), progressRows: {phaseId,status}[], phaseId,
        todos: {id, submissionMode}[] (this group's NON-ARCHIVED to-dos in phaseId), submissions: {todoId, groupId,
        submittedBy, status}[] newest first, groupId, memberIds: string[] }
      output: { complete: boolean; upserts: {phaseId, status}[]; completedPhaseId: string|null; unlockedPhaseId: string|null }
    - Test: group mode, all to-dos' latest group submission approved → complete; current phase 'completed', next phase 'active'
    - Test: one to-do latest = pending or rejected (even with an older approved) → not complete, no upserts
    - Test: a to-do with no submission → not complete
    - Test: archived to-dos are excluded by the caller; helper ignores submissions whose todoId is not in `todos`
    - Test: individual mode: every memberId's latest approved → complete; one member missing/rejected → not; a submission
      by a former member (not in memberIds) is ignored; memberIds empty → not complete
    - Test: mixed group + individual to-dos
    - Test: last phase → completedPhaseId set, unlockedPhaseId null
    - Test: next phase already 'active' or 'completed' → no upsert for it (never downgrade)
    - Test: free access — the next phase(s) with isFreeAccess are skipped (left untouched, they never block) and the first
      following NON-free-access phase is activated; if only free-access phases follow → unlockedPhaseId null
    - Test: approval inside a free-access phase may mark that phase completed but never activates another phase
    - Test: current phase already 'completed' (teacher override) → no-op; current phase 'locked' and not free-access → no-op
    - Test: missing progress rows use resolveGroupPhaseStatuses defaults (first phase active)
    - Test: phase with zero to-dos → not complete
    checkReviewEligibility({ target: {id, status, reviewedAt, reviewedBy}, latestInScopeId: string|null })
      → { ok: true } | { ok: false; reason: 'stale'|'already_reviewed'; message }
    - Test: latest + pending + unreviewed → ok
    - Test: latestInScopeId !== target.id → stale, 'งานนี้มีการส่งฉบับใหม่แล้ว' (checked FIRST)
    - Test: status !== pending or reviewedAt/reviewedBy set → already_reviewed, 'งานนี้ตรวจแล้ว'
    buildReviewItems(rows newest first: {id, todoId, todoTitle, submissionMode, groupId, groupName, submittedBy, status,
      createdAt, fileCount}[]) → ReviewItem[] with { ..., attempt (1-based, oldest = 1, per to-do+owner), tab:
      'pending'|'rejected'|'approved' } keeping ONLY the latest per (todo, owner) where owner = groupId (group mode) or
      submittedBy (individual)
    - Test: two rounds (rejected then pending) → one item, attempt 2, tab 'pending'
    - Test: individual to-do with two students → two items
  </behavior>
  <action>
    1. RED: write src/lib/__tests__/review.test.ts for the behaviour above (vitest, same style as phase-progress.test.ts /
       todo-review-status.test.ts). Run `npm test` → fails. Commit `test(quick-261004-gic): failing tests for review helpers`.

    2. GREEN src/lib/review.ts (pure, no DB/React imports): computePhaseCompletion, checkReviewEligibility, buildReviewItems,
       plus copy constants used by later tasks:
       REVIEW_MESSAGES = { stale: 'งานนี้มีการส่งฉบับใหม่แล้ว', alreadyReviewed: 'งานนี้ตรวจแล้ว', feedbackRequired:
       'กรุณาระบุคำแนะนำก่อนส่งกลับ', feedbackTooLong: 'คำแนะนำต้องไม่เกิน 2000 ตัวอักษร' },
       REVIEW_TAB_LABEL = { pending: 'รอตรวจ', rejected: 'รอแก้ไข', approved: 'ผ่าน' }, type ReviewTab, type ReviewItem,
       REVIEW_PENDING_HINT for รอแก้ไข: 'รอทีมส่งไฟล์ฉบับแก้ไข งานจึงจะกลับมาอยู่ในแท็บรอตรวจ',
       REVIEW_SUCCESS_BANNER: '✓ บันทึกผลแล้ว · แจ้งเตือนทีมเรียบร้อย'.
       Use resolveGroupPhaseStatuses for effective statuses. Free-access interpretation (Claude's discretion, document it in the
       file header): free-access phases are always viewable so they never block and are skipped when choosing the phase to
       activate; approvals inside a free-access phase never activate another phase.

    3. src/server/comment-access.ts (plain module): add and export
       `insertThreadComment(tx: DbLike, v: { workPageId; submissionId: string|null; userId; authorRole: 'teacher'|'student';
       content: string })` that inserts into `comments` and returns the row. Refactor postComment in
       src/server/actions/comment.ts to call it (behaviour identical; keep its latest-submission lookup). Do not add exports to
       comment.ts.

    4. src/server/review-helpers.ts (plain module, NOT 'use server'):
       - `lockReviewTarget(tx, submissionId)`: `tx.select().from(submissions).where(eq(submissions.id, submissionId)).for('update')`.
       - `applyAutoPhaseUnlock(tx, { groupId, phaseId, classroomId })`: loads non-archived classroom phases ordered by orderIndex,
         the group's groupPhaseProgress rows, the group's non-archived to-dos in phaseId, all submissions of those to-dos
         (newest first), and current groupMembers userIds; calls computePhaseCompletion; upserts each `upserts` row with
         `.onConflictDoUpdate({ target: [groupPhaseProgress.groupId, groupPhaseProgress.phaseId], set: { status, updatedAt: new Date() } })`
         (same shape as setGroupPhaseStatus); returns { completedPhaseId, unlockedPhaseId, unlockedPhaseName }.

    5. src/server/actions/review.ts ('use server'). Header comment describes lock order. Both exports:
       `await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN); const userId = await getCurrentUserId();` → zod safeParse
       (`approveSchema = { submissionId: id, note: z.string().max(20_000).optional() }`, `rejectSchema = { submissionId: id,
       feedback: z.string().max(20_000) }`; parse failure → actionError('ข้อมูลไม่ถูกต้อง')) → load the submission (missing →
       throw 'Submission not found or not authorized') → `const { todo, classroom } = await assertTodoEditor(sub.todoId, userId)`.
       Reject: normalizeCommentBody(feedback); not ok/empty → actionError(REVIEW_MESSAGES.feedbackRequired) (or tooLong).
       Approve: note optional; normalise only when non-blank.
       db.transaction, in THIS order (no deadlock with 03i's page → submission order):
         a. lock the group row: `tx.select({id: groups.id}).from(groups).where(eq(groups.id, todo.groupId)).for('update')` —
            serialises concurrent approvals of the same group so the "last to-do approved" check cannot be missed (write skew);
         b. owner = group mode { groupId: todo.groupId, userId: null } / individual { groupId: todo.groupId, userId: sub.submittedBy };
            `page = await getOrCreatePage(tx, todo.id, owner, userId, { lock: true, markAuthor: false })` (page lock BEFORE submission);
         c. `target = await lockReviewTarget(tx, id)`; `latest = await latestScopedSubmission(tx, todo.id, todo.submissionMode,
            todo.groupId, sub.submittedBy, { lock: true })`; `checkReviewEligibility` → on failure return { kind: 'fail', message };
         d. `UPDATE submissions SET status, reviewedBy: userId, reviewedAt: now WHERE id = target.id AND status = 'pending'`
            `.returning({ id })`; zero rows → fail alreadyReviewed. Do NOT change createdAt or updatedAt (03i lateness/liveIsNewer);
         e. feedback / note → `insertThreadComment(tx, { workPageId: page.id, submissionId: target.id, userId, authorRole: 'teacher', content })`;
         f. approve only: `applyAutoPhaseUnlock(tx, { groupId: todo.groupId, phaseId: todo.phaseId, classroomId: classroom.id })`.
       After commit: `revalidatePath('/teacher/review')` (check Next docs for the signature). Do NOT revalidate the student to-do
       page (fgj note: it would re-render the autosaving editor). Return types:
       approve → ActionResult<{ phaseCompleted: boolean; unlockedPhaseName: string | null }>; reject → ActionResult.

    6. src/server/queries/review.ts (plain module):
       - `getReviewList(userId, { classroomId?, phaseId? })`: classrooms = getTeacherClassrooms(userId) non-archived, sorted
         createdAt desc; selected = param if present (assertClassroomEditor) else the first; none → { classrooms: [], … }.
         Load non-archived phases (ordered), groups, non-archived to-dos in non-archived phases, their submissions with file
         counts (one grouped count query), build items via buildReviewItems, attach ownerLabel for individual to-dos via
         getUserDirectory. Return { classrooms: {id,name}[], classroomId, phases: {id,name,orderIndex}[], phaseId (param, else
         first phase with a pending item, else first phase), items (selected phase), countsByPhase: Record<phaseId,
         {pending,rejected,approved}> }. Serialise Dates to ISO strings.
       - `getPendingReviewCount(userId)`: ONE SQL count of pending submissions whose to-do and phase are non-archived and whose
         classroom is non-archived and created by the user (same classroom scope as getTeacherClassrooms). Pending can only be the
         latest round (a new round starts only after rejection), so no per-owner dedupe is needed — note this in a comment.
       - `getReviewDetail(submissionId, userId)`: loads submission + todo + phase + group + classroom, calls assertTodoEditor;
         loads all in-scope submissions of that owner (isInSubmissionScope with todo.groupId / sub.submittedBy), newest first,
         `with: { files: true, comments: <same where/orderBy/limit as getSubmissionHistory> }`; returns { submission (attempt,
         status, createdAt ISO, content, files), todo {id,title,submissionMode}, group {id,name}, classroom {id,name}, phase
         {id,name}, ownerLabel, studentId (individual) , history: {id, attempt, status, createdAt}[], previousFeedback: string|null
         (reviewerComment of the round right before this one when it was rejected), canReview (= this is the latest in scope AND
         pending AND unreviewed) }. Returns null when the submission does not exist.

    7. src/server/__tests__/authz-coverage.test.ts: add 'review.ts' to SCANNED (EDITOR_CHECK then covers both exports) and a
       new test asserting for approveSubmission and rejectSubmission bodies: contains `assertTodoEditor(`, `lockReviewTarget(`,
       `latestScopedSubmission(`, `eq(submissions.status, 'pending')`, `insertThreadComment(`; approve contains
       `applyAutoPhaseUnlock(`; and review-helpers.ts source contains `.for('update')`.

    Commit `feat(quick-261004-gic): review actions with row locks, review comments and auto phase unlock`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint; npm test -- src/lib/__tests__/review.test.ts src/server/__tests__/authz-coverage.test.ts && npm test</automated>
  </verify>
  <done>review.test.ts green (all listed cases), authz-coverage covers review.ts, full suite green, tsc clean, lint at baseline
  (no new errors in touched files), postComment behaviour unchanged, no DB writes performed.</done>
</task>

<task type="auto">
  <name>Task 2: Review list page /teacher/review (picker, phase stepper, tabs, cards, banner) + pending badge on the ตรวจงาน tab</name>
  <files>src/app/(dashboard)/teacher/review/page.tsx, src/components/review/review-phase-stepper.tsx, src/components/review/review-tabs.tsx, src/components/review/review-card.tsx, src/components/review/review-classroom-picker.tsx, src/components/review/review-success-banner.tsx, src/app/(dashboard)/layout.tsx, src/components/cocoon/app-shell.tsx, src/components/cocoon/bottom-tab-bar.tsx, src/components/cocoon/desktop-header.tsx, src/components/cocoon/nav-items.ts</files>
  <action>
    Look at design/mac/home-11.png (list, รอตรวจ), home-14..17 (other tabs / banner) and refs/07-teacher-review-list.png (mobile)
    before building. URL state only (no client store): `/teacher/review?classroom=&phase=&tab=pending|rejected|approved&done=approved|rejected`.

    1. page.tsx (server): `await requireRole(ROLES.TEACHER, ROLES.SUPERADMIN)`; await searchParams; call getReviewList. Layout:
       CocoonHeader variant="home"; on desktop the Phase stepper sits on top (home-11), then a row with the title "ตรวจงาน"
       (CARD-title blue, large) on the left and the segmented tabs on the right; on mobile title, stepper, tabs stack. Classroom
       picker shown only when classrooms.length > 1. Empty states (EMPTY_CARD): no classroom → "ยังไม่มีห้องเรียน" + link to
       /teacher; no phases → "ห้องเรียนนี้ยังไม่มี Phase"; empty tab → "ยังไม่มีงานรอตรวจ" / "ไม่มีงานที่รอแก้ไข" / "ยังไม่มีงานที่ผ่าน".
       Cards in a 2-column grid on lg, 1 column on mobile. Remove the ComingSoonCard import.
    2. review-phase-stepper.tsx (server-safe, Links): circles numbered 1..n with "Phase n" captions (use phase index, not name, as
       in Figma; title attribute = phase name), active = filled cocoon-blue, others outlined; the track fills up to the active
       index; a small count dot when that phase has pending items. Each circle is a Link preserving classroom/tab. Do NOT reuse
       src/components/student/phase-stepper.tsx (03i-owned, student semantics).
    3. review-tabs.tsx: three Links styled with SEGMENT_LIST / SEGMENT_TRIGGER; active pill colours: รอตรวจ bg-cocoon-blue
       text-white, รอแก้ไข bg-cocoon-yellow text-white, ผ่าน bg-cocoon-green text-white; inactive text colours blue / yellow /
       green (as in home-11). Show counts in parentheses only when > 0. Under the tabs: รอแก้ไข shows REVIEW_PENDING_HINT.
    4. review-card.tsx: "● {groupName}" (append " · {ownerLabel}" for individual to-dos), title (text-[22px] bold ink),
       meta `ส่งเมื่อ ${formatSubmissionDate(createdAt)} · ครั้งที่ ${attempt} · ${fileCount} ไฟล์` (CARD_META),
       StatusPill (pending/rejected/approved, size sm) bottom-left, button bottom-right: pending → "เช็คงาน" (BTN_INFO),
       rejected → "ดูงาน" yellow (local BTN_WARN = BTN_INFO's shape with bg-cocoon-yellow), approved → "ดูงาน" (BTN_APPROVE).
       Button is a Link to `/teacher/review/${submissionId}`.
    5. review-classroom-picker.tsx ('use client'): shadcn Select (or SELECT class) listing classrooms; onChange →
       router.push(`/teacher/review?classroom=${id}`).
    6. review-success-banner.tsx: when `done` is set, a green soft banner with REVIEW_SUCCESS_BANNER (approved) or
       "✓ ส่งกลับให้แก้ไขแล้ว · แจ้งเตือนทีมเรียบร้อย" (rejected); show it above the cards. Static (server) is fine.
    7. Badge: nav-items.ts — re-read (03i may have changed it); add optional `badge?: 'review'` to NavItem and set it on
       TEACHER_REVIEW only. layout.tsx — for teacher/superadmin compute `reviewCount = await getPendingReviewCount(userId).catch(() => 0)`
       and pass `badges={{ review: reviewCount }}` to AppShell; AppShell forwards to BottomTabBar and DesktopHeader; both render a
       small pill (bg-cocoon-orange text-white text-[11px] font-bold, min-w-[18px], "99+" cap) next to/over the icon or label
       when the item has `badge` and the count > 0, with an aria-label "รอตรวจ n งาน". Student layout path unchanged.
    Commit `feat(quick-261004-gic): teacher review list with phase stepper, status tabs and pending badge`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint; npm test</automated>
  </verify>
  <done>/teacher/review renders the Figma list instead of ComingSoon (picker only with >1 classroom; stepper; three coloured tabs;
  cards with meta + pill + เช็คงาน/ดูงาน linking to /teacher/review/[id]; รอแก้ไข hint; success banner on ?done=); the ตรวจงาน tab
  shows the pending count on mobile and desktop; tsc clean, lint at baseline, tests green.</done>
</task>

<task type="auto">
  <name>Task 3: Review detail page + send-back / pass dialogs + entry link from the teacher work panel + student-side check + build</name>
  <files>src/app/(dashboard)/teacher/review/[submissionId]/page.tsx, src/components/review/review-submission-card.tsx, src/components/review/review-history-card.tsx, src/components/review/review-actions.tsx, src/components/review/send-back-dialog.tsx, src/components/review/pass-dialog.tsx, src/components/work-page/teacher-work-page-panel.tsx, src/components/student/submission-status-view.tsx</files>
  <action>
    Look at design/mac/home-12.png (detail), home-13.png (send-back dialog), home-14..17 (pass dialog / reviewed states) and
    refs/08-teacher-review-detail.png (mobile) first.

    1. [submissionId]/page.tsx (server): requireRole(TEACHER, SUPERADMIN); getReviewDetail (null → notFound()). Back link
       "‹ ตรวจงาน" → `/teacher/review?classroom={classroomId}&phase={phaseId}&tab={status tab}` (Figma says "งานของฉัน";
       per CONTEXT use the review list instead). Title "ตรวจงาน", subtitle "{todo.title} · {group.name}" (+ " · {ownerLabel}"
       for individual), StatusPill (lg) top-right. Two-column grid on lg (left ~60%: ReviewSubmissionCard; right: ReviewHistoryCard),
       stacked on mobile. When previousFeedback → yellow card (border-cocoon-yellow, bg yellow soft) "คำแนะนำครั้งก่อน" + text,
       placed above the grid. Then ReviewActions (only when canReview; otherwise a muted line "ตรวจแล้ว" / for a stale round
       "มีการส่งฉบับใหม่แล้ว" with a link to the newest round). Then the fgj thread:
       `<Suspense fallback={<CommentThreadSkeleton/>}><CommentThreadSection todoId groupId={group.id} studentId={individual ? studentId : undefined} viewer="teacher"/></Suspense>`
       with an id="comments" anchor.
    2. review-submission-card.tsx: CARD; "ส่งครั้งที่ {attempt}" (CARD_TITLE), date "18 ก.ย. · 13:59" via formatSubmissionDate;
       content → <WorkPageViewer content/> (legacy null → "ส่งเป็นไฟล์"); files → SubmittedFiles (shows "เปิด"; opens via
       getSubmissionFileUrl which allows editors).
    3. review-history-card.tsx: CARD "ประวัติการส่ง"; list newest first: "● ครั้งที่ n · {REVIEW_TAB_LABEL-like status label:
       รอตรวจ / ให้แก้ไข / ผ่าน}" coloured by status (blue / yellow / green) + date; current round bold; each other round links to
       its own /teacher/review/[id].
    4. review-actions.tsx ('use client'): footer hint "ตรวจไฟล์ให้ครบก่อนบันทึกผล" (cocoon-blue text-[16px]); buttons right-aligned:
       "ให้แก้ไข" (yellow BTN_WARN) and "ให้ผ่าน" (BTN_APPROVE); full-width stacked on mobile. Opens the dialogs. On success:
       toast.success (approve: "บันทึกผลแล้ว" and, when unlockedPhaseName, a second line "ปลดล็อค {name} ให้ทีมแล้ว"; phaseCompleted
       without unlock: "ทีมผ่าน Phase นี้แล้ว"), then router.push(`/teacher/review?classroom=…&phase=…&tab=approved&done=approved`)
       (reject: tab=rejected&done=rejected) and router.refresh() so the nav badge updates. On `{success:false}` (stale / already
       reviewed): toast.error(error) + router.refresh(); keep the dialog closed.
    5. send-back-dialog.tsx ('use client', shadcn Dialog + DIALOG_PANEL): orange-yellow "!" glyph (text-cocoon-yellow, text-[40px]
       bold, centered), title "ส่งกลับให้แก้ไข" (DIALOG_TITLE), subtitle "ระบุสิ่งที่ต้องแก้ไขให้ชัดเจน" (cocoon-muted), label
       "คำแนะนำ *" (LABEL), Textarea (TEXTAREA, rows 4, maxLength 2000, autoFocus). Submitting an empty/whitespace value shows
       the inline error "กรุณาระบุคำแนะนำก่อนส่งกลับ" (text-cocoon-orange, aria-invalid on the textarea) without calling the
       server (mobile frame 123:1807). Buttons: full-width "ส่งกลับให้แก้ไข" (yellow, disabled + spinner while pending) and a
       text button "ยกเลิก" (cocoon-blue). Calls rejectSubmission({ submissionId, feedback }).
    6. pass-dialog.tsx: green "✓" glyph, title "ยืนยันให้งานผ่าน?", the to-do title (bold ink), "ผลตรวจจะถูกส่งให้ทีมทราบ"
       (muted), a small row "สถานะหลังยืนยัน: ผ่านการตรวจ" (mobile frame; show on all sizes, green), an OPTIONAL textarea labelled
       "ข้อความถึงทีม (ไม่บังคับ)" (per CONTEXT decision: optional note), buttons "ยืนยันให้ผ่าน" (BTN_APPROVE full width) and
       "กลับไปตรวจ" (text button). Calls approveSubmission({ submissionId, note }).
    7. teacher-work-page-panel.tsx (re-read: 03i may have edited it): in EntryBlock, when `sub` exists add a Link next to the
       StatusPill → `/teacher/review/${sub.id}`, label "เช็คงาน" (BTN_INFO, h-10 text-[14px]) when sub.status === 'pending',
       otherwise "ดูผลตรวจ" (BTN_TERTIARY). This gives the group page's to-do row "ดูงาน" (→ /todo/[id]) a one-click path to
       review without editing 03i-owned todo-item.tsx.
    8. Student side (submission-status-view.tsx, re-read first — 03i Task 2 edits it): verify the round history shows each round's
       status (ส่งแล้ว รอตรวจ / ต้องแก้ไข / ผ่านแล้ว) and the "คำแนะนำจากผู้ตรวจ" card shows the feedback posted by
       rejectSubmission (reviewerComment = latest teacher comment tied to that submission). Only if a round's status label or the
       approved-note case is missing, add it (approved round with a teacher comment → green card "ข้อความจากผู้ตรวจ"). Leave
       the file untouched otherwise and say so in the SUMMARY.
    9. Regression + build: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` (must succeed; RSC props must be
       serialisable — Dates as ISO strings). Grep sanity: `grep -rn "ComingSoonCard" src/app/(dashboard)/teacher/review` → none.
    Commit `feat(quick-261004-gic): review detail page with send-back and pass dialogs`. Write the SUMMARY with: route list,
    free-access interpretation, lock order, manual-QA script for the user (approve the last to-do of Phase 1 → group's Phase 2
    unlocks on the student path; send back with empty feedback shows the error; student update racing a review gets
    "ครูตรวจงานนี้แล้ว"), and "no schema change / no DB writes".
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint; npm test && npm run build</automated>
  </verify>
  <done>/teacher/review/[submissionId] matches home-12/13 and refs/08 with exact Figma copy; empty send-back shows "กรุณาระบุคำแนะนำก่อนส่งกลับ"
  client-side; approve/reject redirect to the right tab with the banner and update the badge; stale/already-reviewed errors toast;
  the teacher work panel links to review; student history/feedback verified; tsc clean, lint at baseline, all tests green, build passes.</done>
</task>

</tasks>

<verification>
- `npm test` green incl. src/lib/__tests__/review.test.ts and the extended authz-coverage test.
- `grep -n "for('update')" src/server/review-helpers.ts src/server/actions/review.ts` shows the group, page (via getOrCreatePage lock), and submission locks.
- `grep -n "status, 'pending'" src/server/actions/review.ts` — guarded UPDATE.
- `grep -rn "drizzle-kit\|--apply" .planning/quick/261004-gic-*/*SUMMARY.md` only appears as "not run".
- `npm run build` succeeds.
</verification>

<success_criteria>
- REV-02: editors approve / send back the latest pending submission; feedback lands in the thread and the student feedback card.
- REV-04 / PHASE-05: the last approval in a phase completes it for that group and activates the next gating phase in the same transaction; teacher overrides via setGroupPhaseStatus still work.
- TOOL-03: /teacher/review lists pending / sent-back / passed work per classroom and phase, with a pending count badge.
- No schema change, no DB writes, no 03i regressions (updateSubmittedWorkPage race returns reviewed:true).
</success_criteria>

<output>
After completion, create `.planning/quick/261004-gic-teacher-review-approve-reject-with-auto-/261004-gic-SUMMARY.md`
</output>

<!-- TOOL-03 note: TOOL-03 is a Phase 6 requirement satisfied by /teacher/review here; record this in the SUMMARY so Phase 6 does not rebuild it. -->
