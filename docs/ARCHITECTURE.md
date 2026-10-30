# Architecture

## Stack
- Next.js 16 App Router with React 19 server components and server actions. Request checks live in `src/proxy.ts`.
- Postgres through Drizzle ORM and postgres.js. Migrations are in `drizzle/`, applied by `scripts/migrate.mts`.
- Tailwind CSS 4, with tokens in `src/app/globals.css`.
- The Anthropic SDK (`src/lib/ai.ts`), with structured outputs checked by zod. Every AI feature has a plain-code fallback.
- Resend for email. Without a key, mail goes to the console or `EMAIL_DEV_OUTBOX`.
- Paddle (USD) and Khalti (NPR) for one-time passes.
- `docx` for Word export, and the browser's print-to-PDF for PDF.
- `sharp` for profile photos.
- Vitest for unit and integration tests, and Playwright for browser tests.

## Modules

```
src/
  app/
    (public)  page.tsx, templates/, login, signup, terms, privacy, refund ...
    app/      the signed-in app: Today, jobs, studio, profile, progress, settings, billing,
              print/ (PDF pages), download/ (Word), photo (profile photo)
    actions/  server actions: auth, profile, jobs, tailor, templates, billing
    api/      webhooks/paddle, billing/khalti/callback, cron-job/[job]
  components/ UI pieces, plus cv/ (the CV renderer) and studio/ (gallery and editor)
  db/         schema.ts, index.ts
  lib/
    ai.ts           Claude calls: structured(), quoted(), fallbacks
    auth/           sessions, passwords, one-time tokens
    cv/             reading CV files, the basic profile reader, the strength meter
    jobs/           safe fetching of job links, JSON-LD, reading job posts
    match/          match score and highlighting (plain code)
    tailor/         tailoring, cover letter, interview, follow-up, fact check, applying changes
    templates/      spec, fonts, checks, fit, built-ins, registry
    export/         Word
    services/       every database read and write, always scoped by user id
    billing/        Paddle and Khalti clients
    plans.ts        limits per plan
```

Rules:
- **Pages and actions never query the database directly.** They call `src/lib/services/*`, and every service function takes the `userId` and filters by it.
- **Plain code first.** Scoring, the fact check, applying changes, spec checks and fitting are pure functions with unit tests.
- **AI output is a suggestion.** It's validated with zod, fact-checked, and shown to the user before anything is used.

## Data model

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, email, password_hash, name, email_verified_at, pass_until, weekly_goal | `pass_until` in the future means they have a pass |
| `sessions` | id (hashed), user_id, expires_at | httpOnly cookie holds the raw id |
| `auth_tokens` | id (hashed), user_id, purpose, expires_at, used_at | Email confirmation and password reset |
| `payments` | provider, provider_ref (unique), status, amount, currency, days | Unique ref means a payment counts once |
| `profiles` | user_id (PK), data (Profile JSON), default_template_id | The one source of facts |
| `profile_photos` | user_id (PK), image (bytea, WebP), updated_at | Re-encoded, no EXIF |
| `cv_templates` | id, user_id, name, based_on, spec (TemplateSpec JSON) | A user's own templates |
| `jobs` | id, user_id, url, post_text, post (JSON), match (JSON), status, applied_on, follow_up_on, interview_on, notes, cv_style (JSON) | `cv_style` = { templateId, density? } |
| `documents` | id, user_id, job_id, kind (cv, cover_letter), cv (changes JSON), text | One of each kind per job |
| `interviews` | job_id (PK), user_id, questions (JSON) | One practice set per job |
| `usage` | (user_id, month, kind) PK, count | Monthly allowance, counted atomically |

Every user-owned table has `ON DELETE CASCADE` from `users`, so deleting an account removes everything.

## Main flows

### Import a CV
1. `importCv` checks the allowance (`spendAllowance(user, "import")`).
2. `cvFileToText` reads the file (PDF with unpdf, DOCX with mammoth, or plain text, up to 5 MB).
3. `parseCv` asks Claude for a Profile JSON. If that fails, `heuristicProfile` reads it with plain code.
4. The profile is saved and every job's match is re-scored.

### Add a job and check the match
1. `addJob` takes a link or pasted text. A link goes through `fetchJobPost` → `safeFetch` (SSRF-safe), which prefers JSON-LD `JobPosting` and otherwise reads the page text.
2. If the page is blocked or needs a login, the user is asked to paste the text.
3. `extractJob` (Claude, with `heuristicJob` as the fallback) produces a JobPost, then `scoreMatch(profile, post)` runs as plain code.

### Tailor
`tailorCv` → `proposeChanges` (Claude) → each change goes through `unsupportedFacts` → flagged changes are blocked → the user accepts or rejects each one → `applyChanges(profile, changes)` produces the CV.

### Render and export
1. `resolveStyle(job, profile)` picks the job's template, or else the user's default, or else `sl-001`, and applies any fit density.
2. `CvDocument({ spec, cv, photoUrl })` renders the CV, on screen and on `/app/print/cv/[id]` for PDF.
3. `/app/download/cv/[id]` builds the Word file from the same spec (pass only).

### Templates
- **Built-ins** live in code (`registry.ts`).
- **Users' own templates** are in `cv_templates`.
- A template id is either `sl-NNN` (built-in) or a uuid (custom).
- `getTemplate(userId, id)` returns a built-in, or a custom template only if `user_id` matches.

### Passes
- **Paddle:** the `transaction.completed` webhook is verified, the days come from the price id, `recordPayment` stores it (unique ref), and `extendPass` extends access.
- **Khalti:** the return URL is checked with Khalti's lookup API, then `completePendingPayment` runs. The pending→completed update only succeeds once.

### Reminders
cron-job.org calls `/api/cron-job/daily` with the secret. `sendFollowUpDigests` sends at most one email per person, listing every application that's due.

## AI calls

| Task | Model (env) | Fallback |
|---|---|---|
| Read a CV | `AI_READ_MODEL` (Haiku) | `heuristicProfile` |
| Read a job post | `AI_READ_MODEL` | `heuristicJob` |
| Tailor | `AI_WRITE_MODEL` (Opus) | Reorder only |
| Cover letter | `AI_WRITE_MODEL` | Template letter |
| Interview questions and feedback | `AI_WRITE_MODEL` | Rule-based questions and feedback |

- Inputs are passed as quoted data, with an instruction to ignore instructions inside them.
- Outputs are parsed with zod.
- `refusal` and `max_tokens` stop reasons are handled.
- If an AI call fails, the user's allowance is refunded.
