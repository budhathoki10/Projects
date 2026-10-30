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
| Cross-account access | integration "keeps everyone's jobs and documents private" and "keeps each person's templates private…", e2e "people can never open each other's jobs or downloads" and the photo test |
| SSRF | unit `safe-fetch.test.ts` (private IPv4 and IPv6 ranges, hex-written mapped addresses, schemes, ports, credentials). Integration "reading job links" uses `FETCH_ALLOW_PRIVATE_HOSTS` only for the fixture host |
| Payment integrity | unit "takes the days from the price paid", integration "completes once", e2e Paddle webhook |
| Password guessing | integration "login throttling", e2e "logins pause after too many wrong passwords" |
| Cron secret | e2e "the daily reminder job needs its secret" |
| No invented facts | the unit no-invention suite and the e2e journey |
| Template spec validation | unit "template spec" and "never put user text into styles", integration "refuses a stored spec that isn't valid" |
| Limits under load | integration "can't be overspent…" and "stops at the limit, even with saves arriving at once" |
| Accessibility | e2e "the main pages pass automated accessibility checks" |
| Photo re-encoding and privacy | integration "profile photos", e2e "a photo shows on photo templates…" |

### CV Studio and the new app
**Unit:**
- `templates.test.ts`:
  - The spec schema rejects CSS in colours, bad hex, unknown fonts and layouts, display fonts for body text, numbers out of range, and missing or duplicated sections.
  - **All 100 built-ins** validate, have unique permanent ids and names, and fill all 12 categories.
  - Only truly ATS-safe templates are labelled ATS-safe, and every template passes the contrast check.
  - Every template renders a real CV, a long CV and a first-job CV with every fact readable, in reading order.
  - Empty and hidden sections are left out, the photo only shows where there's a slot, and no user text reaches styles.
  - ATS labels, the ATS-safe twin, WCAG contrast and photo advice by country.
  - Fit-to-pages steps only tighten and stay in range.
  - Gallery filters and recommendations.
  - The Word file for every layout engine contains every fact, and uses the template's fonts, colours and paper.
- `palette.test.ts`:
  - Every text and background pair passes 4.5:1, in light and dark: foreground and muted on every surface, buttons, and the strong text on each tint.
  - Brand marks reach 3:1.
  - No component uses a raw colour.
- `today-and-strength.test.ts`:
  - The next best step's order of priority.
  - The 8-week trend and upcoming interviews.
  - Days left on a pass.
  - The CV strength checks, including fair treatment of first-job CVs.

**Integration:**
- Templates are private everywhere an id can be used:
  - reading, saving over, renaming, deleting
  - setting as default or using for a job
  - an id planted on someone else's job resolves to their default
- A job's look resolves to the job's choice, then the default, then Classic, with the fit applied.
- Deleting a template sends its jobs back to the default.
- The 50-template limit holds with saves arriving at once.
- A tampered spec in the database is refused.
- Photos:
  - They're re-encoded to a 600px WebP and the EXIF GPS data is gone.
  - Non-images and files over 3 MB are refused.
  - The URL changes when the photo does.
  - They're deleted with the account.
- The weekly goal stays between 1 and 30.

**Browser (`e2e/studio.spec.ts`):**
- Filter the gallery, preview a template with your own CV, and make it your default.
- Customise it (font, colour, section order, undo and redo), save it as your own, and check "What an ATS reads".
- Use another look for a job from the try-on strip. Print and Word follow the job's look, and the cover letter PDF matches.
- A photo shows on photo templates, never on ATS-safe ones. It's served only to its owner, as `image/webp` with `nosniff`.
- Ctrl+K jumps to a job.
- Jobs move between stages by drag and drop, by the card menu and by the table.
- An interview date shows on Today and Interviews.
- axe finds no serious WCAG 2 AA problems on Today, Jobs, Studio, the gallery, the editor, a job, its Tailored CV tab and the public gallery.
- Phones get the bottom tabs and the "More" sheet, and Studio, the gallery, the editor and Interviews fit the screen.

**Current totals:** 167 unit, 26 integration and 17 browser tests, plus the screenshot run.

## Screenshots
`SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts` seeds an example account and saves the images to `docs/screenshots/`. This includes Studio, the gallery, a preview, the editor, Today in dark mode and Today on a phone.

Template thumbnails come from `npm run templates:thumbs`, run with the dev server on. After changing any template or `cv.css`, run it and commit `public/template-thumbs/`.

## Manual checks before launch
These need real services or human eyes, so they aren't automated:
1. With a real `ANTHROPIC_API_KEY`, try 3 real CVs × 3 real job posts. Accept every change, and confirm nothing untrue reaches the CV, the letter or the interview feedback.
2. Print 5 different templates (including a sidebar one and a photo one) to PDF in Chrome. Check the page breaks, and that you can select and copy the text.
3. Open 3 Word downloads in Microsoft Word and Google Docs.
4. Buy a pass in the Paddle sandbox and the Khalti sandbox.
5. Check that the confirmation, reset and reminder emails arrive in Gmail and Outlook, not in spam.
6. Do the whole journey on a real phone.
