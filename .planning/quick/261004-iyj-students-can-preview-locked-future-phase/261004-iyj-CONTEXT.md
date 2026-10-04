# Quick Task: Students can preview locked future phases (greyed) - Context

**Gathered:** 2026-10-04 · **Status:** Ready for planning

User (Thai): "อยากให้น้องสามารถดู phase ถัดไปได้ถึงแม้จะยังไม่เข้าถึงช่วงเวลา แต่ใส่สีเทาไว้"

- On the student group home, phase stepper circles for LOCKED phases become clickable (`?phase=<id>`) — currently only active/completed/free-access are viewable.
- Viewing a locked phase shows a preview: banner "Phase นี้ยังไม่ปลดล็อค · ดูล่วงหน้าได้ แต่ยังส่งงานไม่ได้" (grey), the node path / desktop path with ALL nodes in the existing locked style (grey ring, lock icon, pill "ยังไม่ปลดล็อค"), showing title, subtitle and deadline line. Nodes are NOT links and not focusable as links (aria-disabled), no comment dots.
- Stepper visual: locked circles stay white/grey-bordered (distinguish from reached phases), current viewed phase highlighted with a ring; phase label + date as today.
- Server-side: do NOT relax any write/access rules — work-page/submit/comment actions still refuse locked phases; `/todo/[id]` for a to-do in a locked phase keeps current behaviour (no editing). Only the read-only preview on the home page is new; make sure the query for the viewed phase returns that group's to-dos for locked phases without exposing other groups' data.
- Teachers unaffected. Mobile + desktop. Keep tests green; add/adjust unit tests for the "viewable phase" helper (pickDefaultPhaseId should still default to the active phase; locked phases are previewable when explicitly requested).
- No schema change, no DB writes. Lint baseline: scan src/ only.
