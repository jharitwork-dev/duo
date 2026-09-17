@AGENTS.md

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Duo — Project-Based Learning Platform**

A project-based learning platform for Innovator's Academy (Grades 9-12) and their incubation programs (e.g., Cocoon). Teachers and students plan projects together through phases and to-do lists, with a Duolingo-style progression UI. Students submit work (files, links, text), teachers review, comment, and approve to unlock the next phase.

**Core Value:** Teachers and student groups can plan, execute, and track project-based work through a clear phase→to-do progression — with teacher approval gating advancement.

### Constraints

- **Tech stack**: Next.js 15 (App Router), Neon Postgres, Drizzle ORM, Clerk, R2, Resend — locked defaults from START-HERE.md
- **Reuse**: Copy patterns from web-cocoon (R2 uploads, Resend, form+zod), don't couple the apps
- **Language**: Thai primary UI with English technical terms mixed in
- **Scale**: Start small (< 100 users), no need for heavy optimization
- **Domain**: `build.innovators.co.th` — CNAME to Vercel
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Locked Stack (Not Researched -- Predetermined)
| Technology | Purpose |
|------------|---------|
| Next.js 15 (App Router) | Full-stack framework |
| Neon Postgres | Database |
| Drizzle ORM | Database ORM |
| Clerk | Authentication (teacher/student roles) |
| Cloudflare R2 | File storage (submissions, assignment downloads) |
| Resend | Transactional email |
| Vercel | Deployment |
## Recommended Additional Stack
### UI Foundation
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | v4.3+ | Utility-first CSS | CSS-first config in v4, 5x faster builds via Lightning CSS. Locked default with Next.js 15 + shadcn. | HIGH |
| shadcn/ui | latest (CLI-installed) | Component library | Not a dependency -- copies components into your codebase. Built on Radix UI primitives (accessible by default). 75K GitHub stars, the 2026 default for Next.js + Tailwind projects. Provides Dialog, Dropdown, Table, Tabs, Card, Form -- covers 80% of UI needs out of the box. | HIGH |
| Radix UI Primitives | (via shadcn) | Accessible headless components | Comes bundled with shadcn. AAA accessibility without custom ARIA work. Do not install separately -- shadcn handles it. | HIGH |
### Animation and Visual Path
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Motion (prev. Framer Motion) | v13.3+ | Animation library | Renamed from framer-motion to motion in 2025. Import from `motion/react`. Powers the Duolingo-style phase progression path: spring physics for node transitions, AnimatePresence for phase unlocks, layout animations for reordering. 31KB gzipped, 30M+ monthly npm downloads. The sister project (web-cocoon) already uses motion -- reuse patterns. | HIGH |
### Forms and Validation
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React Hook Form | v7.83+ | Form state management | Uncontrolled forms = minimal re-renders. shadcn/ui Form component wraps it natively. The 2026 standard with Zod. Sister project already uses form+zod pattern. | HIGH |
| Zod | v4.3+ | Schema validation | Zod 4 is stable. Shared schemas between client forms and server actions. @hookform/resolvers v5+ supports Zod 4. Also validates API inputs, Drizzle schema inference. | HIGH |
| @hookform/resolvers | v5.2+ | Bridge RHF to Zod | Required glue. Zod 4 compatible. | HIGH |
### File Upload (Submissions + Assignment Downloads)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @aws-sdk/client-s3 | v3.x | R2 client (S3-compatible) | Cloudflare R2 is S3-compatible. Use PutObjectCommand/GetObjectCommand. Set `region: "auto"` and endpoint to R2 account URL. Well-documented pattern for Next.js 15. | HIGH |
| @aws-sdk/s3-request-presigner | v3.x | Generate presigned URLs | Direct-to-R2 uploads via presigned URLs. Server action generates short-lived URL, client uploads directly. No file data through your server = faster, cheaper. | HIGH |
| react-dropzone | v20.1+ | Drag-and-drop file UI | Hook-based, lightweight. Provides drag-drop zone for file submissions. Works with any upload backend (presigned URLs). | HIGH |
### Rich Text (Teacher Notes + Student Text Submissions)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tiptap | v2.x (@tiptap/react, @tiptap/starter-kit) | Rich text editor | Headless editor built on ProseMirror. Fully customizable -- style with your own Tailwind/shadcn components. Supports markdown shortcuts, basic formatting (bold, italic, lists, links, code). No opinionated UI to fight against. Better than BlockNote for this use case because you do NOT need block-based editing or collaboration -- just clean notes and text submissions. | MEDIUM |
### Data Fetching and Server State
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TanStack Query | v5.102+ (@tanstack/react-query) | Client-side data fetching | Server Components handle initial data loads. TanStack Query handles mutations with optimistic UI (approve submission -> instant UI feedback), background refetching after actions, and cache invalidation. Critical for teacher review workflow: approve/comment/reject need instant feedback. | HIGH |
### Client State
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | v5.x | Client-side state | 1.1KB gzipped. For UI-only state: sidebar open/closed, active filters, multi-step form wizards. Most client state lives in URL (nuqs) or server (TanStack Query) -- Zustand fills the small gap. Do NOT use for server-derived state. | MEDIUM |
| nuqs | v2.10+ | URL query state | Type-safe URL state management. Use for: active classroom filter, current phase view, submission status filters. Shareable URLs, survives refresh, SSR-compatible. | MEDIUM |
### Notifications and Feedback
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Sonner | v2.0+ | Toast notifications | 2.5KB gzipped. shadcn/ui has a built-in Sonner wrapper component. Community default since shadcn adopted it. Use for: "Submission approved", "Phase unlocked", "Comment posted". | HIGH |
### Date and Time
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| date-fns | v4.4+ | Date formatting and manipulation | Tree-shakeable (only import what you use). First-class timezone support via @date-fns/tz in v4. Needed for: submission timestamps, deadline display, "submitted 3 hours ago" relative time. 85M weekly downloads, TypeScript-first. | HIGH |
### Dev Tooling
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TypeScript | v5.5+ | Type safety | Non-negotiable for Next.js 15 projects. Zod 4 requires strict mode. | HIGH |
| ESLint | v9.x | Linting | Flat config format in v9. Next.js 15 ships with eslint-config-next. | HIGH |
| Prettier | v3.x | Code formatting | Consistent formatting. Use prettier-plugin-tailwindcss for class sorting. | HIGH |
| drizzle-kit | latest | DB migrations | Bundled with Drizzle ORM workflow. `drizzle-kit push` for dev, `drizzle-kit generate` + `drizzle-kit migrate` for prod. | HIGH |
### Icons
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Lucide React | latest | Icon library | Default icon set for shadcn/ui. Tree-shakeable, consistent style. Already integrated into shadcn components. | HIGH |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI Components | shadcn/ui | MUI, Chakra UI | MUI is heavy (100KB+), opinionated Material Design. Chakra has performance issues with Tailwind. shadcn gives you ownership of components. |
| Rich Text | Tiptap | BlockNote | Block-based editing is overkill for notes/submissions. Adds complexity without value. |
| Rich Text | Tiptap | Lexical (Meta) | Lower-level, steeper learning curve. Tiptap's abstraction over ProseMirror is the right level for this project. |
| Animation | Motion | CSS animations only | Duolingo-style path needs spring physics, gesture support, layout animations. CSS cannot do this well. |
| File Upload | Presigned URLs + react-dropzone | UploadThing | UploadThing adds a paid SaaS dependency. R2 is already in the stack. Presigned URLs are the standard pattern for R2. |
| State | Zustand | Redux Toolkit | Redux is 11KB, massive boilerplate. This app has minimal client state. Zustand at 1.1KB is proportional. |
| State | Zustand | Jotai | Jotai's atomic model is better for highly granular state. This project has simple UI state -- Zustand's store model is simpler to reason about. |
| Date | date-fns | Day.js | Day.js lacks native timezone support, weaker TypeScript ergonomics. date-fns v4 is the better modern choice. |
| Toast | Sonner | react-hot-toast, react-toastify | Sonner is the shadcn default, smallest bundle, best DX. No reason to deviate. |
## What NOT to Install
| Library | Why Not |
|---------|---------|
| axios | fetch() is native in Next.js 15 with caching. No need for axios. |
| lodash | Modern JS (structuredClone, Object.groupBy, Array.at) covers most use cases. Import individual functions if truly needed. |
| moment.js | Deprecated. Use date-fns. |
| styled-components / emotion | Tailwind CSS is the styling solution. Do not mix paradigms. |
| next-auth / Auth.js | Clerk is the locked auth provider. |
| prisma | Drizzle is the locked ORM. |
| redux | Overkill for this project's state needs. |
| formik | React Hook Form is superior in 2026 (uncontrolled, smaller, better DX). |
## Installation
# UI Foundation
# Animation
# Forms + Validation
# File Upload
# Rich Text Editor
# Data Fetching + State
# Notifications
# (Sonner is added via shadcn: npx shadcn@latest add sonner)
# Date
# Icons (added via shadcn, but can install directly)
# Dev dependencies
## Sources
- [shadcn/ui installation for Next.js](https://ui.shadcn.com/docs/installation/next) - HIGH confidence
- [Motion (prev. Framer Motion) docs](https://motion.dev/docs/react) - HIGH confidence
- [TanStack Query SSR guide](https://tanstack.com/query/latest/docs/react/guides/advanced-ssr) - HIGH confidence
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) - HIGH confidence
- [nuqs documentation](https://nuqs.dev/) - HIGH confidence
- [Sonner via shadcn](https://ui.shadcn.com/docs/components/radix/sonner) - HIGH confidence
- [react-dropzone npm](https://www.npmjs.com/package/react-dropzone) - HIGH confidence
- [Tiptap React docs](https://tiptap.dev/) - MEDIUM confidence (version details from training data)
- [date-fns v4 vs Day.js comparison](https://www.pkgpulse.com/guides/date-fns-v4-vs-temporal-api-vs-dayjs-2026) - HIGH confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
