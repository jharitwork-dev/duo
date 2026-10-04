# Quick Task 261004-fgj: Task discussion thread (teacher ↔ students) - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning. **Run after 261004-01i (work pages) is merged**, since it renders on the same student to-do page and teacher views.

<domain>
## Task Boundary

The user (Thai): "อยากให้ครูสามารถ comment ที่ task นักเรียนได้ และนักเรียนก็ comment ได้"

User decisions (2026-10-04):
- **One discussion thread at the bottom of each task**, scoped like the work page: per (to-do, group) for group to-dos and per
  (to-do, student) for individual ones. Teachers and students can post at any time, before or after submitting.
- **Visibility:** the classroom's teachers (editors) plus the members of that group (or that student for individual to-dos).
  Other groups never see it.

### Data (additive migration; the DB is shared with the LIVE site)
The existing `comments` table is tied to `submission_id` (NOT NULL) and has 0 rows. Evolve it additively:
- Add `comments.work_page_id` (FK work_pages, cascade; nullable during migration). Make `submission_id` NULLABLE and keep it as
  "written at round n" context: the latest submission id at posting time, or null if none yet.
- Add `comments.edited_at` (nullable) and `comments.deleted_at` (soft delete shows "ข้อความถูกลบ").
- Every new comment requires `work_page_id`. Comments attach to the work page (created on demand like autosave does), so the thread
  survives resubmissions.
- Migration script in `src/db/migrations/` with `--dry-run` / `--apply`; the executor runs only `--dry-run`.

### Behaviour
- Server actions (`src/server/actions/comment.ts`): `postComment({ todoId, body })`, `editComment` (author only, within 15 min),
  `deleteComment` (author or classroom editor), `listComments({ todoId, groupId? })`. Teachers pass `groupId` to choose the thread.
  Authorize with the existing helpers (`authorizeTodoViewer` from 01i for read, editors for moderation); add to `authz-coverage.test.ts`.
  Body: plain text with line breaks and auto-linked URLs, 1–2000 chars, rendered safely (no HTML).
- Thread UI (Cocoon CI): a "ความคิดเห็น (n)" card under the work page/history. Messages are chat-like: avatar + name + role badge (ครู in
  blue, นักเรียน) + time ("18 ต.ค. 13.59", relative when < 24 h), plus a small "ส่งครั้งที่ n" tag when the comment was written after
  submission n. Teacher messages are tinted blue-soft and student messages white. A composer at the bottom (textarea that auto-grows;
  Enter adds a newline, Cmd/Ctrl+Enter sends; a "ส่ง" button). Includes empty, loading and error states. No realtime: refresh after
  posting, plus `router.refresh()` polling every 30 s while the page is visible.
- Teacher views: the teacher group page and the to-do review view show the same thread for that group. On the teacher group page each
  to-do row shows a 💬 count chip linking to the thread.
- Student home node path: a small 💬 dot on a node when there are comments from a teacher the student hasn't seen. Track last-seen with
  `comment_reads(user_id, work_page_id, last_seen_at)` (part of the same migration).
- Phase 4 compatibility: the future "ส่งกลับให้แก้ไข / ให้ผ่าน" review dialogs will post their คำแนะนำ as a teacher comment tied to that
  submission, so the existing "คำแนะนำจากผู้ตรวจ" card should read the latest teacher comment tied to the latest rejected submission. Keep
  `getSubmissionHistory`'s `reviewerComment` working with the new columns.

Out of scope: realtime, @mentions, attachments in comments, LINE/email notifications (Phase 6), inline text comments.
</domain>

<decisions>
## Implementation Decisions (locked)
- Thread at the bottom of the task (not per round, not inline).
- Visible to the classroom's teachers plus that group (or that student).

### Claude's Discretion
- Exact visuals, polling interval, edit window, unread indicator style.
</decisions>

<specifics>
## Specific Ideas
- Reuse `MemberIdentity`/`getUserDirectory` for names and avatars; never expose emails to students.
- Unit-test the pure helpers: thread key resolution, canEdit/canDelete, round tagging, linkify (no HTML injection).
- Lint baseline: 10 pre-existing errors; add none.
</specifics>
