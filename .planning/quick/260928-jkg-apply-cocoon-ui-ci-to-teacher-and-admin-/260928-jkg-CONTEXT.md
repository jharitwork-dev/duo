# Quick Task 260928-jkg: Desktop (Mac) Cocoon shell + student desktop alignment + teacher/admin CI - Context

**Gathered:** 2026-09-28 (revised after the user shared the Figma "Mac" page)
**Status:** Ready for planning

<domain>
## Task Boundary

The user shared the desktop designs: Figma page "Mac" (node 0:1) in the same file. All 22 frames were
exported at 1280×832 to **`design/mac/*.png`**. These PNGs are the visual targets (pixel-measure them;
view crops at full resolution). **Do NOT call Figma MCP tools** because the monthly budget is used up.

Frame map (file → Figma frame → what it is):
| file | frame | screen |
|------|-------|--------|
| login.png | 109:4 | Login (desktop 2-column) |
| login-1.png | 109:28 | Sign-up: สมัครด้วย Google, ชื่อที่แสดง, อีเมล, รับรหัส OTP, "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" |
| login-2.png | 109:52 | OTP entry empty: "Verification Code", 4 boxes, green "ส่ง OTP อีกครั้ง", "ย้อนกลับไปแก้ไขอีเมล" |
| login-3.png | 109:72 | OTP filled: boxes green border, orange "ยืนยัน" |
| home.png | 107:1365 | Student home: stepper + horizontal node path (active = ยังไม่ส่ง) |
| home-1.png | 109:96 | Student to-do DETAIL: "รายละเอียดงาน" card + "สิ่งที่ต้องส่ง" card with orange "เลือกไฟล์" |
| home-2.png | 109:120 | ส่งงาน upload, no files (confirm button disabled grey) |
| home-3.png | 109:146 | ส่งงาน upload, 2 files selected, orange "ยืนยันส่งงาน" |
| home-4.png | 109:185 | Submitted / รอตรวจ (2 columns: ส่งครั้งที่ 1 + ประวัติการส่ง), "กลับหน้าหลัก" |
| home-5.png | 109:222 | Home, active node = รอตรวจ (magnifier icon, blue ring arc) |
| home-6.png | 109:280 | Home, active node = ต้องแก้ไข (hand icon, yellow ring arc) |
| home-7.png | 109:338 | To-do ต้องแก้ไข: + "คำแนะนำจากผู้ตรวจ" yellow card, yellow "แก้ไขงาน" |
| home-8.png | 109:377 | แก้ไขงาน re-upload ("เลือกไฟล์ฉบับแก้ไข", yellow "ยืนยันส่งอีกครั้ง") |
| home-9.png | 109:416 | Submitted round 2 (history shows ครั้งที่ 2 รอตรวจ + ครั้งที่ 1 ต้องแก้ไข, "คำแนะนำครั้งก่อน") |
| home-10.png | 109:457 | Home, node = ผ่านแล้ว (target icon, full green ring) |
| home-11..17 | 109:515..803 | TEACHER review flow (ตรวจงาน) — Phase 4, see "Out of scope" |

In scope:
1. **Desktop shell (lg ≥ 1024px) for ALL roles, per the Mac frames.** Top header: Cocoon logo left
   (≈139×46 at x≈64..84, y≈23), bell right (≈28px, x≈1160), teacher/admin variant has a "ทีมของฉัน"
   text link left of the bell (see home-13/16); a 2px divider `#f1ece5` at y≈115 spanning the content width.
   Content gutter 64px → content max-width ≈1152px, centred. **No bottom tab bar at lg**: the tab
   destinations move into the header (for students a compact text nav or an avatar/profile menu next to
   the bell; for teachers ทีมของฉัน / ตรวจงาน / โปรไฟล์ (+ แอดมิน for superadmin)). Below lg keep the current
   mobile shell + BottomTabBar exactly as built in 260928-iwi (mobile must not regress).
   Desktop decor: measure the desktop shapes' placement from the PNGs (login has a rocket/book/lightbulb
   cluster in the left column; app screens have shapes along the right edge and the bottom). Reuse the
   existing SVGs in `public/figma/` (same illustrations) and position them for lg in DecorBackground (or
   a `DesktopDecor` sibling). Don't spend effort on pixel-perfect decor; the content must match.
2. **Student desktop screens aligned to home*.png** (same data and actions as mobile):
   - Home (home.png / home-5/6/10): stepper full-width (circles at x≈70 and 1200, labels "Phase n" under
     each), "งานของฉัน" title, **horizontal** node row (nodes ≈220px, connectors: ring buttons ≈56px with
     → between nodes, + between the parallel pair, trailing →). Hint text bottom-left
     "เลือกงานเพื่อดูรายละเอียด ไฟล์ที่ส่ง และผลตรวจล่าสุด". Wraps to multiple rows if there are many to-dos.
   - **Status-specific node icon + ring** on BOTH mobile and desktop: none → briefcase + orange partial arc
     (existing); pending → magnifier (`/figma/ff79c.svg` + `/figma/c536c.svg`) + blue partial arc;
     rejected → hand icon (the yellow hand shape exists in the decor SVGs; if not isolatable, use the
     lucide `Hand` in cocoon-yellow) + yellow partial arc; approved → target icon (green/red target; reuse
     the decor target SVGs `987f9/867e9/3b971/b579c` composited, or a simple SVG) + **full green ring**,
     pill "ผ่านแล้ว".
   - **New to-do detail step** (home-1): route `/todo/[id]` for a student with no submission shows
     "‹ งานของฉัน" back link, title, subtitle, "รายละเอียดงาน" card (todo.description + todo.notes) and
     "สิ่งที่ต้องส่ง" card (render lines of `todo.notes` that start with "-", "•" or "✓" as ✓ items;
     otherwise just the button) with orange "เลือกไฟล์" → goes to the upload view (`?step=upload`, or a
     client state switch). Apply on mobile too (stacked cards), replacing the current "รายละเอียดจากครู" card.
   - Upload (home-2/3): two cards side-by-side (upload card: ↑ icon, "อัปโหลดไฟล์งาน", helper, solid
     blue "เลือกไฟล์", support text; selected-files card: "ไฟล์ที่เลือก (n ไฟล์)", rows with "เปิด"
     (local object URL preview) — keep a remove affordance, "เพิ่มไฟล์" link, hint), confirm button
     bottom-right (grey disabled when empty). Keep the existing confirm dialog.
   - Submitted (home-4/9): 2 columns (ส่งครั้งที่ n card with file rows + "เปิด" link; ประวัติการส่ง card
     with coloured "● ครั้งที่ n · status" + date lines), status pill top-right of the title row, footer
     text "รอผู้ตรวจตรวจงาน แล้วจะแจ้งผลให้ทราบ" left + orange "กลับหน้าหลัก" right.
   - Rejected (home-7) and re-upload (home-8): "คำแนะนำจากผู้ตรวจ" yellow card (bg `#fdf3dc`-ish, border
     `#f6dfa6`-ish; measure) shows the latest reviewer comment if the `comments` table has one for that
     submission (read-only, no comment UI yet); yellow "แก้ไขงาน" → upload view titled "แก้ไขงาน" with
     "เลือกไฟล์ฉบับแก้ไข" and yellow "ยืนยันส่งอีกครั้ง". Round-2 view shows "คำแนะนำครั้งก่อน".
   - Mobile versions of these new states follow the same structure stacked in one column with the mobile
     spacing from 260928-iwi.
3. **Login / sign-up / OTP desktop** (login*.png): 2-column layout at lg (left: "เข้าสู่ระบบ" 56px-ish orange,
   blue highlight bar with white text, illustration cluster; right: white card ≈380px wide). OTP = **4-digit**
   boxes? NO — Clerk email codes are 6 digits: render 6 boxes in the same style (the design shows 4). Resend
   button green (`#12a150`-ish, measure), confirm orange. Sign-up page (login-1) becomes a custom Clerk sign-up
   with Google + display name + email OTP (useSignUp from `@clerk/nextjs/legacy`: create → prepareEmailAddressVerification
   → attemptEmailAddressVerification → setActive → `/onboarding`). Mobile keeps the current layout,
   restyled to reuse the same components.
4. **shadcn token theme** in `src/app/globals.css` `:root` so every shadcn component follows the CI:
   `--background #fffaf3`, `--foreground #1d2531`, `--card #fff`, `--primary #ef4924` / fg white,
   `--secondary #f0f9ff` / fg `#0069a6`, `--muted #f5f3ef`, `--muted-foreground #878ea8`, `--accent #fff0ea`,
   `--border`/`--input #e4e1dc`, `--ring #0069a6`, `--radius 0.75rem`. Also update `--color-cocoon-green` to
   the green measured from the PNGs (buttons "ให้ผ่าน"/"ยืนยันให้ผ่าน", pill "ผ่าน"). Verify student screens unchanged.
5. **Teacher/admin management screens** (no design exists; Claude designs in the same language): teacher
   dashboard (classroom list), new classroom, classroom page (tabs → segmented pill like home-11 tabs,
   settings form, invite code, group cards, assign-student dialog), group phase/to-do editor (phase list,
   phase item, inline add/edit, to-do list/items, attachments, template picker), teacher branch of
   `/todo/[id]`, teacher branch of the group page, `admin/page.tsx`, `(auth)/onboarding`. Page pattern:
   "‹ parent" back link 12px blue, title 26px bold blue, subtitle 13px muted, white cards radius 12 border
   `#e4e1dc`, primary orange, info/solid-blue secondary (like "เช็คงาน"). Behaviour/data flow unchanged.
   Teacher tabs (mobile bottom bar / desktop header): หน้าแรก `/teacher`, ตรวจงาน `/teacher/review`
   (ComingSoonCard until Phase 4), โปรไฟล์ `/teacher/profile` (reuse student profile component, role label
   ครู/ผู้ดูแลระบบ), + แอดมิน `/admin` for superadmin. "ทีมของฉัน" header link → `/teacher`.
   Remove AppSidebar/UserNav usage from the dashboard layout; delete those files only if unused.
6. `vitest.config.ts`: exclude `.claude/**` (worktree copies were being collected).

Out of scope: Phase 4 teacher review (home-11..17: review list, review detail, send-back/pass dialogs,
comments write, approve/reject, phase unlock) — it will be planned as a real GSD phase next and will
use these PNGs. No schema changes, no DB pushes, no Figma calls.
</domain>

<decisions>
## Implementation Decisions

- Mobile (< lg) must keep matching the 260928-iwi refs; desktop (≥ lg) follows `design/mac/*.png`.
  Tablet (md) = mobile layout in a wider centred column (current behaviour) unless trivially better.
- Same UI/CI for teacher as student (user decision). Teacher management screens are Claude-designed.
- OTP boxes: 6 (Clerk code length) styled like the design's boxes.
- "สิ่งที่ต้องส่ง" has no schema field; derive from notes lines as described, no migration.
- Keep all server actions, data flow and behaviour intact; this is a UI task plus the sign-up custom flow.

### Claude's Discretion
- Component organisation, exact desktop nav treatment for student tab destinations, decor placement,
  wrap behaviour for >3 nodes, teacher management page layouts.
</decisions>

<specifics>
## Specific Ideas

- Measured from home.png: page bg `#fffaf3`; header divider `#f1ece5` 2px at y=115-116; stepper track `#ece8e2`.
- `design/mac/` is untracked. Commit it in the first task (≈1.8 MB) so it's available to Phase 4.
- Reuse `src/components/cocoon/*` and `src/components/student/*` from 260928-iwi; extend rather than fork.
- Next.js 16.3 has breaking changes (read `node_modules/next/dist/docs/`). Fonts stay on CSS @import.
- Lint: 10 pre-existing errors in untouched files. Add none.
</specifics>

<canonical_refs>
## Canonical References

- `design/mac/*.png` (desktop visual targets, 1280×832)
- `.planning/quick/260928-iwi-cocoon-ui-redesign-from-figma-student-fl/260928-iwi-CONTEXT.md` + SUMMARY.md
- `.planning/quick/260928-jkg-apply-cocoon-ui-ci-to-teacher-and-admin-/refs/` (mobile refs incl. teacher 07/08)
</canonical_refs>
