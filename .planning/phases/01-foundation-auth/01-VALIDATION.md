---
phase: 1
slug: foundation-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None yet — Phase 1 establishes foundation. Manual verification via dev server. |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm run dev` + manual check |
| **Full suite command** | `npx drizzle-kit push && npm run dev` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run dev` and verify no build errors
- **After every plan wave:** Full schema push + dev server check
- **Before `/gsd:verify-work`:** All success criteria manually verified
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | manual | Dev server + Clerk sign-in | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-02 | manual | Dev server + Clerk sign-in | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | AUTH-03 | manual | Unauthorized route access test | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | AUTH-04 | manual | Server Action role check | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | L10N-01 | manual | Thai text renders in browser | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | L10N-02 | manual | Date shows BE year | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Database schema deployed to Neon (all tables created)
- [ ] Clerk app configured with publishable + secret keys
- [ ] Dev server runs without errors (`npm run dev`)

---

## Validation Architecture

Sourced from 01-RESEARCH.md — verification approach for each requirement:

| Requirement | Verification Method |
|-------------|-------------------|
| AUTH-01 | Teacher signs in via Clerk, sees teacher dashboard shell |
| AUTH-02 | Student signs in via Clerk, sees student view shell |
| AUTH-03 | Unauthorized role cannot access protected routes or Server Actions |
| AUTH-04 | Server Actions check role in function body, not just middleware |
| L10N-01 | Thai text visible in UI, English terms mixed naturally |
| L10N-02 | Dates display Buddhist Era year (2569 for 2026) |
