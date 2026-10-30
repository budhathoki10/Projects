# Shortlist

A job-hunt helper for anyone applying for jobs. Add your CV once. Then for each job you paste, Shortlist gives you:

1. **Match check.** Which requirements your CV already shows, which ones are only in your skills list, and which you're missing.
2. **Tailored CV.** The summary and bullets are rewritten for the job. You accept or reject each change, and any change that adds a fact not in your CV is blocked.
3. **CV Studio.**
   - **100 templates** in 12 categories, each honestly labelled for applicant tracking systems (ATS), previewed with your own CV.
   - **Make your own template** with an editor: layout, fonts, colours, section order, photo, fit to one page, undo and redo, and "what an ATS reads".
   - **Each job can have its own look.** PDF and Word follow it.
4. **Cover letter.** Written from your real experience, editable, and printed in the same look as your CV.
5. **Interview prep.** Likely questions, including the gaps, with feedback on your typed answers. Booked interviews show on Today and Interviews.
6. **Tracker.** A board you can drag between stages, or a table. A week after you apply with no answer, Today and a daily email remind you, with a polite follow-up message ready to copy.
7. **Today.**
   - One "next best step"
   - KPIs with an 8-week trend
   - Weekly goal ring and pipeline
   - CV strength meter
   - A Ctrl+K command bar to jump anywhere

The rule everything follows: **Shortlist only uses what's in your profile.** The AI can reword and reorder. It can't add an employer, title, degree, number or skill you don't have. A plain-code check (`src/lib/tailor/fact-check.ts`) catches anything that slips through, so it doesn't rely on the model behaving.

![Today](docs/screenshots/today.png)

| | | |
|---|---|---|
| ![CV Studio](docs/screenshots/studio.png) | ![Templates](docs/screenshots/templates.png) | ![Template editor](docs/screenshots/editor.png) |
| ![Preview with your CV](docs/screenshots/template-preview.png) | ![Match check](docs/screenshots/match.png) | ![Tailored CV](docs/screenshots/tailored-cv.png) |
| ![Jobs](docs/screenshots/jobs.png) | ![Dark mode](docs/screenshots/today-dark.png) | ![Phone](docs/screenshots/mobile-today.png) |

## The docs

| File | What's in it |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Who it's for, every feature, principles, what's out of scope |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's built, what's next, and the launch blockers |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, data model, flows, AI calls |
| [docs/DESIGN.md](docs/DESIGN.md) | Design tokens, app shell, page layouts, writing rules |
| [docs/TEMPLATES.md](docs/TEMPLATES.md) | The template spec, the 10 layout engines, how to add a template |
| [SECURITY.md](SECURITY.md) | Threat model and every control |
| [TESTING.md](TESTING.md) | Every test suite and the manual launch checks |
| [docs/LAUNCH.md](docs/LAUNCH.md) | Step-by-step go-live checklist |

## Plans

| | Free | Job-hunt pass |
|---|---|---|
| Tailored CVs | 3 a month | 200 a month |
| Cover letters | 3 a month | 200 a month |
| Interview prep sessions | 3 a month | 200 a month |
| CV imports | 5 a month | 50 a month |
| All 100 templates, your own templates, PDF | Yes | Yes |
| Tracker, reminders, Today, Progress | Yes | Yes |
| Word (.docx) download | No | Yes |
| Price | $0 | $15 for 30 days or $35 for 90 days (NPR 1,500 / 3,500 with Khalti) |

A pass is a one-time payment. It never renews. Buying another adds its days to the end of the current one. Limits live in `src/lib/plans.ts`.

## Running it locally

You need Node 20 or newer and Postgres 15 or newer.

```bash
npm install
cp .env.example .env            # then fill in DATABASE_URL at least
createdb shortlist               # or point DATABASE_URL at Neon, Supabase, Railway...
npm run db:migrate
npm run dev                      # http://localhost:3000
```

Everything works without any keys:

- **No `ANTHROPIC_API_KEY`:** CVs and job posts are read with plain code, and tailoring only reorders bullets and skills. Cover letters and interview feedback use simple templates. It's useful for development, but not what you'd sell.
- **No `RESEND_API_KEY`:** emails are printed to the console, so you can click confirmation and reset links from there.
- **No payment keys:** the billing page shows the plans, but buying a pass is off.

## Environment variables

All of these are in `.env.example`, with comments.

| Variable | Needed | What it's for |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `APP_URL` | Yes in production | Public URL, used in email links and payment return URLs |
| `CRON_JOB_SECRET` | For reminders | Protects `/api/cron-job/*`. Make it long and random: `openssl rand -hex 32` |
| `LEGAL_OPERATOR_NAME`, `LEGAL_COUNTRY`, `SUPPORT_EMAIL` | Before launch | Shown on Terms, Privacy and Refund. Paddle checks these pages |
| `ANTHROPIC_API_KEY` | For the real product | Claude reads CVs and job posts, and writes changes, letters and feedback |
| `AI_READ_MODEL`, `AI_WRITE_MODEL` | No | Override the models. Defaults: `claude-haiku-5-5` for reading, `claude-opus-5-5` for writing |
| `RESEND_API_KEY`, `EMAIL_FROM` | For email | Confirmations, password resets and follow-up reminders |
| `PADDLE_ENV`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET` | For card payments | Paddle sells the passes in USD |
| `NEXT_PUBLIC_PADDLE_PRICE_30`, `NEXT_PUBLIC_PADDLE_PRICE_90` | For card payments | The two one-time price ids |
| `KHALTI_ENV`, `KHALTI_SECRET_KEY` | For Nepal | Khalti sells the passes in NPR |
| `KHALTI_PASS_30_NPR`, `KHALTI_PASS_90_NPR` | No | Khalti prices in rupees. Defaults: 1500 and 3500 |

## Going live

### 1. Hosting and database

Deploy to Vercel (or anywhere that runs Next.js), with any hosted Postgres. Run `npm run db:migrate` against the production database once, and again after each schema change.

### 2. Email (Resend)

1. Create an account at resend.com and verify your sending domain.
2. Set `RESEND_API_KEY`, and set `EMAIL_FROM` to an address on that domain.

### 3. Card payments (Paddle)

Paddle is the Merchant of Record. Buyers pay Paddle, Paddle handles sales tax, and pays you out. You never hold anyone's money.

1. Get approved by Paddle. They check the site, the Terms, Privacy and Refund pages, and that the product matches the description.
2. Create a product named "Job-hunt pass" with **two one-time prices** (not subscriptions): $15 and $35. Put their ids in `NEXT_PUBLIC_PADDLE_PRICE_30` and `NEXT_PUBLIC_PADDLE_PRICE_90`.
3. Copy the client-side token into `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
4. Add a notification destination for `https://YOUR_DOMAIN/api/webhooks/paddle` with the `transaction.completed` event. Put its secret key in `PADDLE_WEBHOOK_SECRET`.
5. Set `PADDLE_ENV=production` when you switch from sandbox.

The webhook works out the number of days from the price id that was actually paid. It never trusts the checkout's custom data for that, so a buyer can't turn a 30-day payment into 90 days.

### 4. Nepal payments (Khalti)

1. Get a merchant account at khalti.com and set `KHALTI_SECRET_KEY`.
2. Set `KHALTI_ENV=production` when you go live.

Payments are confirmed with Khalti's lookup API on the return URL. Each payment can only add days once, even if the callback arrives twice at the same moment.

### 5. Daily reminders (cron-job.org)

Follow-up emails are sent by `/api/cron-job/daily`. Anything that can call a URL once a day will do. With cron-job.org:

1. Create a job for `https://YOUR_DOMAIN/api/cron-job/daily`, once a day (for example 08:00 in your users' main time zone).
2. Under **Advanced**, add the header `Authorization: Bearer YOUR_CRON_JOB_SECRET`. (`?key=YOUR_CRON_JOB_SECRET` in the URL also works, but headers stay out of logs.)

The route answers right away with `202` and sends the emails in the background. To run it by hand and see the result, add `?wait=1`:

```bash
curl -H "Authorization: Bearer $CRON_JOB_SECRET" "https://YOUR_DOMAIN/api/cron-job/daily?wait=1"
```

Each person gets at most one email a day, listing every application that's due.

## How it's built

- **Next.js 16** App Router with server actions, Postgres with **Drizzle**, Tailwind 4.
- **Accounts:** email and password, with database sessions in httpOnly cookies, email confirmation, password reset, data export and account deletion.
- **AI:** the Anthropic SDK with structured outputs (`src/lib/ai.ts`). Every AI feature has a plain-code fallback.

Where things live:

| Path | What |
|---|---|
| `src/lib/cv/` | Reading PDF, DOCX and text CVs into a profile |
| `src/lib/jobs/` | Fetching job links safely and reading job posts (JSON-LD first, then the page text) |
| `src/lib/match/` | The match score and keyword highlighting. Plain code, no AI |
| `src/lib/templates/` | Template spec, fonts, checks, fit, the 100 built-ins and the registry |
| `src/components/cv/` | The one CV renderer, the live page, mini previews and the matching letter |
| `src/components/studio/` | Gallery, editor, photo upload, a job's look |
| `src/lib/tailor/` | Tailoring, cover letters, interview questions and feedback, follow-up messages, and the fact check |
| `src/lib/export/docx.ts` | Word export following the template. PDF comes from the print pages (`/app/print/cv/[id]`, `/app/print/letter/[id]`) |
| `src/lib/services/` | Database reads and writes |
| `src/lib/billing/` | Paddle and Khalti |
| `src/app/app/` | The signed-in app |

## Security and privacy

- CVs are personal data. They're stored in the user's account only, can be downloaded as JSON from Settings, and are deleted with the account. They aren't used to train models. The Privacy page says so.
- Every job, document and download is checked against the signed-in user. The tests try to open another person's pages and downloads.
- Job links are fetched with `safeFetch`, which refuses private and internal addresses (also after redirects), limits size and time, and never sends cookies.
- Templates are data, not code: every value is an enum, a hex colour or a bounded number, checked on save and on read. Nobody else can see or use your templates.
- Profile photos are re-encoded (removing location data), kept in the database, and served only to their owner.
- CV and job text is passed to the model as quoted data, with instructions to ignore any instructions inside it.
- Monthly allowances are counted with a single atomic database update, so parallel requests can't go past the limit. A failed AI call gives the allowance back.
- Webhook signatures are verified, and payment amounts are taken from the payment provider, not from the browser.

## Limits worth knowing

- Many job boards, LinkedIn especially, block automated reading or need a login. When that happens Shortlist asks the user to paste the text, which always works.
- Scanned (image-only) PDFs have no text to read. Users get a message asking for a DOCX or pasted text.
- The match score is keyword and word-overlap matching, not a judgement of the person. It's labelled as a guide.
- English only for now.
- Shortlist doesn't apply to jobs for anyone. Auto-applying breaks most job sites' terms and gets accounts banned.

## Tests

`npm run test:all` runs lint, typecheck, unit (169), integration with a real Postgres (26) and browser tests (17, including axe accessibility checks). See [TESTING.md](TESTING.md).

After changing a template or `src/components/cv/cv.css`, run `npm run templates:thumbs` with the dev server on and commit the new thumbnails.
