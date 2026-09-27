# 🔨 Duo Project — START HERE

> Fresh session? Read this first — this folder has no prior context. Then also read the hub:
> `~/Desktop/Innovators Tech/PROJECTS.md`.

## What we're building
A **gamified LMS (Duolingo-style)** for Innovator's:
- **Students** submit work
- **Mentors** assign work + review/give feedback
- Separate logins for both roles
- Fun, game-like interface (XP, streaks, progress path)

This is a **new, standalone app** — its own repo, own DB, own auth. Sibling to `web-cocoon`,
NOT nested inside it. Deploys to **`build.innovators.co.th`** (subdomain of the main domain).

## Locked default stack (swap only with a reason)
| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** (App Router) + **Vercel** → `build.innovators.co.th` |
| DB | **Neon** (serverless Postgres) |
| ORM | **Drizzle** |
| Auth | **Clerk** (student/mentor roles) — swap to Auth.js later if wanting zero-vendor |
| File uploads | **Cloudflare R2** + `aws4fetch` (reuse Cocoon pattern) |
| Email | **Resend** |
| Forms | react-hook-form + zod |
| Animation | `motion` (the Duolingo feel) |

## Reuse from the Cocoon codebase (copy, don't couple)
Source repo: `~/Desktop/Innovators Tech/web-cocoon/`
- **R2 presigned upload/download** → `src/cocoon/apply/r2.ts`, `create-upload-url.ts`
- **Resend email** → search `src/cocoon` for Resend usage
- **Form + zod patterns** → `src/cocoon/components/FileUploadForm.tsx`
- **Next.js 15 + Tailwind v4 + motion** scaffold conventions
Copy the *patterns/files* over; keep the two apps independent.

## Build plan — walking skeleton first, gamify LAST
| Phase | Ships | Note |
|-------|-------|------|
| **0. Skeleton** | Next.js + Neon + Drizzle + Clerk; both roles log in; protected routes | prove the spine end-to-end |
| **1. Core loop** | mentor assigns 1 task → student submits (file/link) → mentor reviews + feedback | the actual product |
| **2. Structure** | units/lessons, assignment lists, student + mentor dashboards | organize the loop |
| **3. Gamification** | XP, streaks, progress path, Duolingo look | only after the loop is solid |
| **4. Polish** | Resend notifications, analytics, edge cases | ship-ready |

Nail **Phase 1** = you have something real to test with students.

## Open decisions to confirm before Phase 0
- [ ] Auth: **Clerk** (default) vs Auth.js vs roll-own
- [ ] Submissions: files (R2) vs links/text vs **mix** (default: files + links)
- [ ] Draft the DB schema (users/roles/assignments/submissions/progress) before coding

## First moves in a fresh session
```bash
cd ~/Desktop/Innovators\ Tech/duo
claude --dangerously-skip-permissions
# 1) "read START-HERE.md and ~/Desktop/Innovators Tech/PROJECTS.md"
# 2) scaffold: npx create-next-app@latest . --ts --app --tailwind
# 3) run /gsd:new-project → PROJECT.md + roadmap → plan Phase 0
```

## Env vars you'll need (put in .env.local — never commit)
```
DATABASE_URL=            # Neon connection string
CLERK_SECRET_KEY=        # + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
R2_ACCOUNT_ID=  R2_ACCESS_KEY_ID=  R2_SECRET_ACCESS_KEY=  R2_BUCKET=   # if using file uploads
RESEND_API_KEY=          # if using email
```

---
_Created 2026-08-31 · status: not scaffolded yet, decisions above pending_
