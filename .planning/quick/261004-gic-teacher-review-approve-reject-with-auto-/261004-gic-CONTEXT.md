# Quick Task 261004-gic: Teacher review — approve / send back, auto phase unlock (ROADMAP Phase 4) - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning. Run after 261004-fgj (comments) and 261004-03i (deadlines + edit-after-submit) are merged, because
review comments go into the fgj thread and the review statuses interact with 03i's edit rules.

<domain>
## Task Boundary

The user (Thai): "ครูยังตรวจงานไม่ได้หรอ". Teachers can only *view* submissions today. Build the review flow that the Figma design already
specifies. Desktop: `design/mac/home-11.png … home-17.png`. Mobile: Figma frames 18:5823 (list), 18:5829 (detail), 118:2286 / 123:1807
(send-back dialog incl. empty-validation state), 118:2548 (pass dialog); screenshots in
`.planning/quick/260928-jkg-apply-cocoon-ui-ci-to-teacher-and-admin-/refs/07-teacher-review-list.png` and `08-teacher-review-detail.png`.
Exact copy from Figma:
- List page: title "ตรวจงาน", phase stepper (Phase 1/2/3) for choosing the phase, segmented tabs **รอตรวจ / รอแก้ไข / ผ่าน** (active pill: blue for
  รอตรวจ, yellow for รอแก้ไข, green for ผ่าน). Cards: "● {group name}", big to-do title, meta "ส่งเมื่อ 18 ก.ย. 13:59 · ครั้งที่ 1 · 2 ไฟล์",
  a status pill, and a button "เช็คงาน" (blue) for pending or "ดูงาน" (yellow/green) for the others. Tab hints: "รอทีมส่งไฟล์ฉบับแก้ไข งานจึงจะกลับมาอยู่
  ในแท็บรอตรวจ" (รอแก้ไข); success banner "✓ บันทึกผลแล้ว · แจ้งเตือนทีมเรียบร้อย" (ผ่าน, after an approval).
- Detail page: back link "‹ งานของฉัน" (use the classroom/review list instead), title "ตรวจงาน", subtitle "{to-do} · {group}", status pill top-right;
  left card "ส่งครั้งที่ n" + date + submitted content (work page snapshot read-only via the 01i viewer + files with "เปิด"); right card "ประวัติการส่ง";
  a "คำแนะนำครั้งก่อน" yellow card when a previous round was rejected; footer hint "ตรวจไฟล์ให้ครบก่อนบันทึกผล"; buttons **ให้แก้ไข** (yellow) and
  **ให้ผ่าน** (green). The comment thread (fgj) is below.
- Send-back dialog: "!" icon, "ส่งกลับให้แก้ไข", "ระบุสิ่งที่ต้องแก้ไขให้ชัดเจน", label "คำแนะนำ *", textarea (required; error "กรุณาระบุคำแนะนำก่อน
  ส่งกลับ"), buttons "ส่งกลับให้แก้ไข" (yellow) / "ยกเลิก".
- Pass dialog: "✓" icon, "ยืนยันให้งานผ่าน?", to-do title, "ผลตรวจจะถูกส่งให้ทีมทราบ", buttons "ยืนยันให้ผ่าน" (green) / "กลับไปตรวจ"; the mobile frame
  adds "สถานะหลังยืนยัน: ผ่านการตรวจ".

### Behaviour
- Server actions `approveSubmission({ submissionId })` and `rejectSubmission({ submissionId, feedback })`: classroom editor only
  (`assertTodoEditor`); only the LATEST pending submission of that thread can be reviewed (stale → "งานนี้มีการส่งฉบับใหม่แล้ว"); set
  status, `reviewed_by`, `reviewed_at`. Reject posts the feedback as a teacher comment (fgj `postComment` internals) tied to that submission,
  so the student's "คำแนะนำจากผู้ตรวจ" card and the thread both show it. Approve may include an optional note (also posted as a comment).
- **Auto phase unlock (REV-04):** after an approval, if every non-archived to-do in that phase for that group has its latest submission
  `approved` (group mode: one per group; individual mode: every current group member's latest submission approved), mark the group's phase
  `completed` and the next phase (by orderIndex) `active` unless it is already active/completed. A free-access phase does not block. Same
  transaction. Teachers can still override manually (existing `setGroupPhaseStatus`). Pure helper `computePhaseCompletion` with tests.
- Edit-lock interplay (03i): reviewing sets the status, so the student's "อัปเดตงานที่ส่ง" window closes immediately. If a student update races
  a review, 03i's check rejects it.
- Navigation: the teacher bottom tab / desktop header "ตรวจงาน" (`/teacher/review`, currently ComingSoon) becomes the review list across
  the teacher's classrooms (classroom picker when there is more than one, default the most recent). Each to-do row on the group page (fgj
  added "ดูงาน" + status pill) links to the detail page. Counts badge on the ตรวจงาน tab = number of pending submissions.
- Student side: after a review the node shows ผ่านแล้ว (target, green ring) / ต้องแก้ไข (hand, yellow ring), which already exists. The work page
  becomes editable again on rejection (01i), and the history shows the round statuses.

Out of scope: notifications beyond in-app (LINE/email = Phase 6), grading/scores, bulk approve.
</domain>

<decisions>
## Implementation Decisions
- Follow the Figma copy and flow above exactly; desktop from the Mac PNGs, mobile from the iPhone refs.
- Feedback is required when sending back and optional when approving.
- Auto-unlock is per group, from ROADMAP REV-04 and the earlier per-group-unlock decision.

### Claude's Discretion
- Route structure (`/teacher/review`, `/teacher/review/[submissionId]` or reuse `/todo/[id]?review=`), the multi-classroom picker, empty states.
</decisions>

<specifics>
## Specific Ideas
- Reuse StatusPill, ConfirmDialog patterns, the WorkPageViewer from 01i, the comment thread from fgj, and design tokens from `src/components/cocoon/ui.ts`.
- Unit tests: `computePhaseCompletion` (group/individual, archived to-dos, free access, last phase), review eligibility (latest pending only).
- `authz-coverage.test.ts` must cover the new review action file.
- No schema change expected (submissions.status/reviewed_by/reviewed_at already exist). If one is needed: additive script with --dry-run/--apply only.
</specifics>
