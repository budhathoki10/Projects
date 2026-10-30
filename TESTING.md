# Testing

```bash
npm run test:all     # everything below, in order
npm run lint
npm run typecheck
npm test             # unit (Vitest), no database, no network
npm run test:integration   # Vitest against a real Postgres
npm run test:e2e     # Playwright: builds the app, starts it and a fake-sites server
```

## Setup
- **Postgres** has to be running locally, with a `shortlist` role (password `shortlist`) that can create databases.
  - Integration tests use `shortlist_integration`.
  - Browser tests use `shortlist_test`.
  - Both are migrated automatically before the run.
  - Override them with `TEST_DATABASE_URL`.
- **Chromium for Playwright** must be installed. `@playwright/test` is pinned to match the installed browser.
- **No API keys are needed.** With no `ANTHROPIC_API_KEY`, the plain-code fallbacks run, so results are deterministic. Emails go to a JSON-lines outbox the tests read. Khalti is a fake server (`e2e/fixture-sites/server.mjs`), and Paddle webhooks are signed with a test secret.

## What each suite proves

### Unit (`tests/*.test.ts`)
- **CV and job reading** (`cv-and-jobs.test.ts`):
  - The basic reader finds contact details, roles, dates, bullets, education, skills and languages.
  - It reads job posts: basics, must-haves versus nice-to-haves, real skills, and not currencies or abbreviations.
  - It prefers JSON-LD job data.
- **Match check:** shown, listed and missing; stemming and synonyms; must-haves weigh more; the score stays between 0 and 100; highlighting.
- **No-invention check** (`tailoring.test.ts`):
  - Rewording passes.
  - Invented employers, numbers, degrees and skills are blocked.
  - Job-post names are allowed in cover letters.
  - Generic words like "degree" are allowed only when the profile has one.
- **Applying changes:** accepted changes only, by original position, and skills can be reordered but never added.
- **Fallbacks without AI:** tailoring only reorders, and the letter, interview and feedback contain nothing unsupported.
- **Export and helpers:**
  - The Word file reads back as text.
  - The word diff, the follow-up message and the plan limits.
- **Paddle:** the days come from the price paid, and signatures are verified.

### Integration (`tests/integration/*.test.ts`, real Postgres)
- **Allowance:**
  - It stops at the limit, a refund gives one back, and it resets monthly.
  - It can't be overspent by parallel requests.
- **Passes:** they start today and stack. A Khalti payment completes once, even with simultaneous callbacks.
- **Jobs:**
  - Applying sets a follow-up; an answer clears it.
  - Progress counts are right, and jobs are re-scored when the profile changes.
  - Jobs and documents are private per user.
- **Documents:** one tailored CV, letter and interview per job, updated in place.
- **Job links:** the JSON-LD page is read, and blocked, login and empty pages are explained.
- **Accounts:** deleting an account removes every row.
- **Reminders:** one email per person, listing every due application.

### Browser (`e2e/*.spec.ts`, Playwright)
- **The journey:** sign up → upload a PDF CV → add a job by link → match check → tailor → accept → PDF and Word → cover letter → mark applied → follow-up appears → interview practice.
- **The free limit:** it runs out, a Khalti pass lifts it and unlocks Word.
- **Pasted text:** a pasted job works when the site blocks reading.
- **Access:**
  - Signed-out visitors are sent to log in.
  - People can't open each other's jobs or downloads.
- **Account emails:** confirming an email, resetting a password and exporting data.
- **Paddle:** a signed webhook adds exactly the days paid for, once.
- **Cron:** the cron route needs its secret.
- **Deletion:** deleting an account removes everything.
- **Layout:** no page is wider than a phone screen.

### Security tests (where each SECURITY.md control is checked)

| Control | Test |
|---|---|
| Cross-account access | integration "keeps everyone's jobs and documents private", e2e "people can never open each other's jobs or downloads", v2 template and photo ownership tests |
| SSRF | integration "reading job links" uses `FETCH_ALLOW_PRIVATE_HOSTS` only for the fixture host. Unit tests for `isPrivateAddress` |
| Payment integrity | unit "takes the days from the price paid", integration "completes once", e2e Paddle webhook |
| Cron secret | e2e "the daily reminder job needs its secret" |
| No invented facts | the unit no-invention suite and the e2e journey |
| Template spec validation | v2 unit spec tests |
| Photo re-encoding | v2 integration photo tests |

## v2 tests (CV Studio and the new app)
These are added as each ROADMAP item lands:

- **Unit:**
  - The spec schema rejects bad colours, unknown fonts and layouts, and numbers out of range.
  - All 100 built-ins validate, render with 3 profiles (short, long, no experience), and contain every profile fact in reading order.
  - ATS-safe templates pass the contrast check.
  - `atsTwin` and `atsReport`.
  - `fitSteps` never drops content.
  - Word export for every engine.
  - The strength meter.
  - Recommendations.
  - The next best action.
- **Integration:**
  - Template CRUD is owner-only, including the case where a job points at another user's template.
  - The 50-template cap.
  - Photos are re-encoded with no EXIF, deleted with the account and included in the export.
  - A job's template choice is used by downloads.
  - The weekly goal.
- **Browser:**
  - Gallery filters, preview with your own CV, customise, save, use for a job, and print and Word follow it.
  - Photo upload: it shows on photo templates and not on ATS-safe ones.
  - ⌘K, the mobile tab bar, and dragging between stages.
  - axe on Today, Jobs, Studio and the editor.
  - No horizontal scroll, including Studio on a phone.

## Screenshots
`SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts` seeds an example account and saves the images to `docs/screenshots/`.

## Manual checks before launch
These need real services or human eyes, so they aren't automated:
1. With a real `ANTHROPIC_API_KEY`, try 3 real CVs × 3 real job posts. Accept every change, and confirm nothing untrue reaches the CV, the letter or the interview feedback.
2. Print 5 different templates (including a sidebar one and a photo one) to PDF in Chrome. Check the page breaks, and that you can select and copy the text.
3. Open 3 Word downloads in Microsoft Word and Google Docs.
4. Buy a pass in the Paddle sandbox and the Khalti sandbox.
5. Check that the confirmation, reset and reminder emails arrive in Gmail and Outlook, not in spam.
6. Do the whole journey on a real phone.
