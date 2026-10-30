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
- [x] Tests: 49 unit, 14 integration, 11 browser

## v2: CV Studio and the new app

### 1. Docs
- [x] PRODUCT.md, TEMPLATES.md, DESIGN.md, ARCHITECTURE.md, SECURITY.md, ROADMAP.md, LAUNCH.md, TESTING.md, CLAUDE.md
- [x] Security hardening found while writing SECURITY.md:
  - CV files are read by their bytes, not their name
  - security headers and CSP

### 2. Template engine
- [ ] `spec.ts`: zod schema, defaults, `parseSpec`
- [ ] `fonts.ts`: the 15-family allowlist via `next/font`
- [ ] `checks.ts`: `atsReport`, `contrastIssues`, `atsTwin`, `photoAdvice`
- [ ] `fit.ts`: `fitSteps`
- [ ] `CvDocument` renderer with the 10 engines, used for preview, print and thumbnails
- [ ] Move the existing CV preview onto it (the current look becomes `sl-001 Classic`)

### 3. The 100 built-ins
- [ ] 10 families, `sl-001`…`sl-100`, names, categories, colour families
- [ ] `registry.ts`: lookup, filters, `recommendTemplates(profile, job?)`
- [ ] Thumbnail script (`npm run templates:thumbs`) and committed WebP images
- [ ] Public gallery `/templates` and `/templates/[id]` with a sample CV, for marketing

### 4. CV Studio
- [ ] Database: `cv_templates`, `profile_photos`, `profiles.default_template_id`, `jobs.cv_style`, `jobs.interview_on`, `users.weekly_goal`
- [ ] Services and actions: save, duplicate, rename, delete, set default, choose for a job, fit for a job
- [ ] Studio home, gallery (filters, search, recommended), live preview with your own CV
- [ ] Editor: controls, live page with page breaks, zoom, fit, undo and redo, checks, "What an ATS reads"
- [ ] Profile photo: upload, re-encode, serve to the owner only, include in export, delete with the account
- [ ] Per-job template and fit. Print and Word follow it. The cover letter print page matches
- [ ] Word export follows the spec

### 5. App shell and dashboard
- [ ] Sidebar, top bar, mobile tab bar, floating "Add job" button
- [ ] ⌘K command bar
- [ ] Today: next best action, KPIs with sparklines, follow-ups, interviews, weekly goal ring, mini pipeline, strength meter
- [ ] Jobs: board and table toggle, drag between stages, interview date
- [ ] CV strength meter (`src/lib/cv/strength.ts`)
- [ ] Template try-on strip on the Tailored CV tab

### 6. Finish
- [ ] All new tests (see TESTING.md), with `npm run test:all` green
- [ ] axe checks on the main pages
- [ ] Screenshots: Studio, gallery, editor, 12 templates, Today in light and dark
- [ ] README updated
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
- Languages other than English
- LinkedIn profile import (their terms don't allow scraping, so this means a file export only)
- A browser extension that saves job posts in one click
