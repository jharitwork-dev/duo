# Quick Task: Classroom-level locked tasks (งานของห้องเรียน) - Context

**Gathered:** 2026-10-04 · **Status:** Ready for planning (run as quick --full; additive migration with --dry-run/--apply)

User (Thai, on the classroom Phase tab): "ใน phase ทั้งห้องเรียนที่มี อยากให้เพิ่มงานที่ lock กับทั้งห้องเรียนต้องทำได้ด้วย (แล้วจะเพิ่มรายกลุ่ม ทั้งหมด เพิ่มทีหลังได้เหมือนเดิม)"

Proposed behaviour (Claude's interpretation — confirm the 3 marked items with the user before planning):
- On the classroom **Phase** tab each phase gets a section "งานของห้องเรียน (ทุกกลุ่มต้องทำ)" with "+ เพิ่มงานของห้องเรียน". A classroom task is defined once and **every group — including groups created later — gets it automatically**.
- On group pages these tasks show with a 🔒 "งานของห้องเรียน" badge; teachers **cannot edit/delete them per group** — only from the Phase tab, and **edits propagate to all groups** (title, description/notes, deliverables, deadline, file requirement, attachments). [confirm: propagate edits?]
- Deleting/archiving a classroom task removes it from all groups (ConfirmDialog with impact counts; type-to-confirm if any submissions). [confirm]
- Per-group tasks (existing "เพิ่มงาน" with group checkboxes) stay exactly as today; ordering: classroom tasks first, then group tasks. [confirm order]
- Students see no difference except the badge; submissions/review/deadlines work unchanged (each group still has its own row so work pages/submissions stay per group).
- Data (additive): `classroom_tasks` table (id, phase_id FK cascade, title, description, notes, file_requirement, deadline, order_index, is_archived, created_by, timestamps) + `todos.classroom_task_id` FK (nullable, set null on delete handled explicitly). Materialize one `todos` row per group per classroom task; sync on: classroom task create/update/archive/delete, group create (incl. self-create), phase reorder. Backfill: none required (existing todos stay group tasks).
- Authz via assertClassroomEditor; extend authz-coverage test; unit-test the sync planner (pure: given groups × classroom tasks × existing copies → inserts/updates/deletes).
