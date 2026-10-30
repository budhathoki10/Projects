# Roadmap

This is the build plan. Tick a box only when its code is merged locally **and** its tests pass. The other docs say *what* we're building: PRODUCT.md (features), TEMPLATES.md (templates), DESIGN.md (look and layout), ARCHITECTURE.md (code), SECURITY.md and TESTING.md.

## Definition of done (every item)
1. Code follows ARCHITECTURE.md: services are scoped by user id, and logic is in plain functions.
2. Unit tests cover the logic. Integration tests cover database rules. A browser test covers the user journey.
3. `npm run lint`, `npm run typecheck` and `npm run build` are clean.
4. It works at 375px wide and with a keyboard.
5. The copy follows DESIGN.md → Writing.
6. The docs are updated where they describe it.

## v1: the core (done)
- [x] Accounts: sign up, confirm email, log in, reset password, delete account, export data
- [x] Profile: import a PDF, DOCX or text CV (AI with a basic reader as fallback), editor
- [x] Jobs: add by link (safe fetch, JSON-LD) or pasted text, read the post
- [x] Match check: shown, listed or missing, with evidence, highlighting and a score
- [x] Tailored CV: proposed changes, diff, accept or reject, no-invention check
- [x] PDF (print page) and Word export
- [x] Cover letter, editable, fact-checked
- [x] Interview prep: questions and answer feedback
- [x] Tracker: statuses, follow-up after 7 days, daily email digest (cron-job.org)
- [x] Progress page
- [x] Passes: Paddle one-time (USD), Khalti (NPR), stacking, plan limits
- [x] Terms, Privacy and Refund pages
- [x] Tests: 49 unit, 14 integration, 11 browser (v1)

## v2: CV Studio and the new app

### 1. Docs
- [x] PRODUCT.md, TEMPLATES.md, DESIGN.md, ARCHITECTURE.md, SECURITY.md, ROADMAP.md, LAUNCH.md, TESTING.md, CLAUDE.md
- [x] Security hardening found while writing SECURITY.md:
  - CV files are read by their bytes, not their name
  - security headers and CSP

### 2. Template engine
- [x] `spec.ts`: zod schema, defaults, `parseSpec`
- [x] `fonts.ts`: the 15-family allowlist via `next/font`
- [x] `checks.ts`: `atsReport`, `contrastIssues`, `atsTwin`, `photoAdvice`
- [x] `fit.ts`: `fitSteps`
- [x] `CvDocument` renderer with the 10 engines, used for preview, print and thumbnails
- [x] Move the existing CV preview onto it (the current look becomes `sl-001 Classic`)

### 3. The 100 built-ins
- [x] 10 families, `sl-001`…`sl-100`, names, categories, colour families
- [x] `registry.ts`: lookup, filters, `recommendTemplates(profile, job?)`
- [x] Thumbnail script (`npm run templates:thumbs`) and committed WebP images
- [x] Public gallery `/templates` with a sample CV, for marketing

### 4. CV Studio
- [x] Database: `cv_templates`, `profile_photos`, `profiles.default_template_id`, `jobs.cv_style`, `jobs.interview_on`, `users.weekly_goal`
- [x] Services and actions: save, duplicate, rename, delete, set default, choose for a job, fit for a job
- [x] Studio home, gallery (filters, search, recommended), live preview with your own CV
- [x] Editor: controls, live page with page breaks, zoom, fit, undo and redo, checks, "What an ATS reads"
- [x] Profile photo: upload, re-encode, serve to the owner only, include in export, delete with the account
- [x] Per-job template and fit. Print and Word follow it. The cover letter print page matches
- [x] Word export follows the spec

### 5. App shell and dashboard
- [x] Sidebar, top bar, mobile tab bar, floating "Add job" button
- [x] ⌘K command bar
- [x] Today: next best action, KPIs with sparklines, follow-ups, interviews, weekly goal ring, mini pipeline, strength meter
- [x] Jobs: board and table toggle, drag between stages, interview date
- [x] CV strength meter (`src/lib/cv/strength.ts`)
- [x] Template try-on strip on the Tailored CV tab

### Found and fixed along the way
- CV uploads over 1 MB failed, because server actions accept 1 MB by default. The limit is now 6 MB.
- Two template saves arriving at once could pass the 50-template limit. Creation now takes a per-user lock.
- The red badge and faint text were below 4.5:1 contrast. Both tokens are darker now.
- The job tabs overflowed phones by 4px.
- An IPv4-mapped IPv6 address written in hex (`[::ffff:7f00:1]`, which the URL parser produces from `[::ffff:127.0.0.1]`) passed the private-address check. It's blocked now, with tests.

### 5b. Colour system (Jade)
- [x] Radix scales (sand, jade, tomato, amber) generated into `src/app/colors.css`, light and dark
- [x] Semantic tokens: one meaning each. Removed the lime, the beige paper, the navy hero, the glow and the hard-coded hexes
- [x] Consistent radii (8, 12, 16) and a 3-step elevation scale
- [x] `tests/palette.test.ts`: every text pair passes 4.5:1 in both themes, and components use no raw colours

### 6. Finish
- [x] All new tests (see TESTING.md), with `npm run test:all` green: 169 unit, 26 integration, 17 browser
- [x] axe checks on the main pages
- [x] Screenshots: Studio, gallery, editor, 12 templates, Today in light and dark
- [x] README updated
- [ ] Push to the `budhathoki10/shortlist` private repo (waiting on the repo being created and the Claude GitHub App getting access)

## Launch blockers (owner: you)
See LAUNCH.md for the steps.
- [ ] Create the GitHub repo and give the Claude GitHub App access
- [ ] Domain and hosting (Vercel) plus Postgres
- [ ] `ANTHROPIC_API_KEY`
- [ ] Resend domain verified
- [ ] Paddle approval and the two one-time prices
- [ ] Khalti merchant account
- [ ] cron-job.org daily job
- [ ] Legal details: operator name, country, support email
- [ ] Manual check: 3 real CVs × 3 real jobs with AI on, and nothing invented gets through

## Later (not in v2)
- Sharing templates by link (needs moderation)
- A page for each template (`/templates/[id]`) for search engines
- Keeping a chosen template through sign-up (`/signup?template=…`)
- Languages other than English
- LinkedIn profile import (their terms don't allow scraping, so this means a file export only)
- A browser extension that saves job posts in one click
