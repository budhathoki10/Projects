# Security

Shortlist stores CVs, which are personal data: names, phone numbers, work history and sometimes photos. This file covers what we protect, how, and where in the code.

## Reporting a problem
Email the address in `SUPPORT_EMAIL` with "Security" in the subject. Please don't open a public issue. We reply within 3 working days.

## What we protect, and from whom

| Asset | Threat | Main controls |
|---|---|---|
| A user's CV, jobs, letters, photo | Another user reading them | Every query is scoped by user id, and tests try cross-account access |
| Accounts | Password guessing, stolen sessions | Hashed passwords, login throttling per email and per IP, httpOnly session cookies, reset limits |
| The server and internal network | SSRF through job links | `safeFetch` |
| AI output | Prompt injection in job posts or CVs, invented facts | Quoted inputs, schema checks, the fact check, user review |
| The app's pages | XSS, CSS injection through templates | React escaping, specs made only of enums, hex colours and bounded numbers |
| Payments | Fake webhooks, replayed callbacks, paying for 30 days and getting 90 | Signature checks, the provider's own lookup, unique payment refs, days taken from the price |
| Scheduled jobs | Anyone triggering mass email | `CRON_JOB_SECRET` with a constant-time compare |
| Uploads | Malicious files, huge files, location data in photos | Size and type limits, parsing in memory, photos re-encoded |

## Controls

### Accounts and sessions (`src/lib/auth/`)
- Passwords are hashed with scrypt and a per-user salt (`password.ts`). The minimum length is 8.
- A session id is 32 random bytes. The cookie is `HttpOnly`, `Secure` in production, and `SameSite=Lax`. The database stores only a SHA-256 hash of it.
- Email-confirmation and reset tokens are single use, hashed in the database and expire. Resets are limited to 3 an hour.
- **Login throttling** (`src/lib/auth/throttle.ts`):
  - After 8 wrong passwords for one email in 15 minutes, logins for that email pause.
  - After 30 wrong passwords from one IP address, logins from that address pause, which stops guessing across many accounts.
  - Only hashes of the email and the IP are stored. Rows older than a day are deleted.
  - A successful login clears that email's count.
- A password reset logs out every session.
- Login redirects only go to same-site paths (`safeNext`).
- Server actions are protected by Next.js's built-in Origin check. All state changes go through POST.

### Access control
- Every service function takes `userId` and filters by it. Examples: `ownedJob`, `getTemplate` and `getTailoredCv`.
- The print, download, photo and export routes call `requireUser()` and the same owned-lookups. A missing or foreign id returns 404, never 403, so ids can't be probed.
- Built-in template ids (`sl-NNN`) are public. A custom template id is only resolved for its owner. Setting someone else's template id on your own job falls back to the default template.

### Job links: SSRF (`src/lib/safe-fetch.ts`)
- Only `http` and `https` are allowed, on the standard ports 80 and 443.
- The hostname is resolved and every address checked. Private, loopback, link-local, CGNAT, multicast and metadata ranges are refused, for IPv4 and IPv6, including IPv4-mapped addresses in either form (`::ffff:127.0.0.1` and `::ffff:7f00:1`).
- Redirects are followed by hand (at most 5), and each hop is checked again.
- Limits: 10 seconds, 3 MB, no cookies, a fixed user agent.
- `FETCH_ALLOW_PRIVATE_HOSTS` exists only for tests.

### AI (`src/lib/ai.ts`, `src/lib/tailor/`)
- CV text, job text and the CV builder's rough notes are wrapped with `quoted(label, text)`. The system prompt says it is data, and that any instructions inside it must be ignored. Builder suggestions go through the same fact check as tailoring and are only saved once the person ticks and keeps them.
- Output must match a zod schema, or it's rejected.
- **No-invention check** (`fact-check.ts`): plain code that blocks any number, proper noun, acronym, technical term or qualification that isn't in the profile, or in the job post where allowed. Blocked changes can't be accepted.
- Nothing the AI writes is used until the user accepts it.

### Rendering and templates (`src/lib/templates/spec.ts`)
- A TemplateSpec is validated with zod on every save and every read from the database. Colours must match `^#[0-9a-f]{6}$`, fonts and layouts come from allowlists, and numbers are bounded. No user value is ever placed into CSS as free text, so there's no way to inject CSS or HTML.
- Template names are plain text, limited to 60 characters, and rendered by React, which escapes them.
- Users can save at most 50 templates. Creating one takes a per-user database lock, so parallel requests can't pass the limit.
- The PDF page's `@page` rule is built only from the validated page size (an enum) and margin (a bounded number).
- CV content is rendered as text by React. There's no `dangerouslySetInnerHTML` anywhere.

### Uploads
- **CV files:** up to 5 MB. They're checked by content (PDF magic bytes, DOCX zip structure), parsed in memory and never stored. Only the extracted text becomes the profile.
- **Photos:** JPEG, PNG or WebP, up to 3 MB.
  - They're decoded and re-encoded with `sharp` to a 600×600 WebP. This strips EXIF data, including GPS, and any trailing data.
  - Anything that fails to decode is rejected.
  - They're stored in Postgres, never in a public bucket.
  - They're served by `/app/photo` only to the owner, with `Content-Type: image/webp`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.

### Payments (`src/lib/billing/`, `src/app/api/`)
- **Paddle:** the `Paddle-Signature` HMAC is verified with a timestamp tolerance. The days come from the price id that was paid (`passDaysForPrice`), never from `custom_data`. The unique `provider_ref` makes a payment count once.
- **Khalti:** the callback's query string is not trusted. The payment is looked up with Khalti's API using our secret key, and the amount and status must match. A pending payment can only move to completed once, in a single conditional update.
- We never store card or wallet details.

### Limits and abuse
- Monthly allowances are counted with one atomic `INSERT … ON CONFLICT DO UPDATE … WHERE count < limit`, so parallel requests can't go past the limit.
- Resend cooldowns apply to verification and reset emails.

### Secrets
- Secrets live only in environment variables. `.env*` files are git-ignored.
- Only variables named `NEXT_PUBLIC_*` reach the browser: the Paddle client token and price ids, which are meant to be public.
- `CRON_JOB_SECRET` is compared in constant time, and is better sent as a header than in the URL.

### Request size
Server actions accept bodies up to 6 MB (`next.config.ts`): enough for a 5 MB CV or a 3 MB photo plus form overhead, and no more.

### Headers
`next.config.ts` sets:
- `X-Frame-Options: DENY` and `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone and geolocation off)
- a Content Security Policy that allows Paddle's checkout

### Privacy
- CVs aren't used to train models. Anthropic's API doesn't train on API data by default.
- Settings → "Download my data" exports everything as JSON. "Delete account" removes every row, including photos, by cascade.
- Logs never contain CV text, passwords or tokens.

## Checking it
- **Tests that guard these controls:** see TESTING.md, "Security tests". They cover cross-account access, SSRF ranges, signature checks, single-use payments, spec validation, photo re-encoding and deletion.
- **Before launch:**
  - Run `npm audit --omit=dev`.
  - Confirm the security headers with securityheaders.com.
  - Check that `PADDLE_WEBHOOK_SECRET`, `KHALTI_SECRET_KEY` and `CRON_JOB_SECRET` are set in production and are not the sandbox values.
