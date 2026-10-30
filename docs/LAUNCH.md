# Launch checklist

Work through this top to bottom. Each step says where to do it and how to check it worked.

## 1. Code and repository
- [ ] Create the private repo `budhathoki10/shortlist` on GitHub and give the Claude GitHub App access (https://claude.ai/connect-github).
- [ ] `npm run test:all` passes on `main`.
- [ ] `npm audit --omit=dev` has no high or critical issues.

## 2. Database
- [ ] Create a Postgres database (Neon, Supabase or Railway). Pick the region closest to your hosting.
- [ ] Turn on daily backups with at least 7 days kept. Neon and Supabase have this in their settings.
- [ ] Run `DATABASE_URL=… npm run db:migrate` once. Run it again after every schema change before deploying.
- **Check:** `psql $DATABASE_URL -c '\dt'` lists `users`, `jobs`, `cv_templates` and the other tables.

## 3. Hosting (Vercel)
- [ ] Import the repo as a new Vercel project. The framework is detected as Next.js.
- [ ] Add every variable from `.env.example` under Settings → Environment Variables (Production).
- [ ] Set `APP_URL` to the final https URL with no trailing slash.
- [ ] Add your domain under Settings → Domains, and set the DNS records Vercel shows.
- **Check:** the home page loads on your domain, and signing up sends an email.

## 4. AI
- [ ] Create an API key at console.anthropic.com and set `ANTHROPIC_API_KEY`.
- [ ] Set a monthly spend limit in the console. $50 is plenty to start: one tailored application costs about $0.01–0.04.
- **Check:** import a real CV. The profile page should say it was read with AI, not with the basic reader.

## 5. Email (Resend)
- [ ] Add and verify your domain at resend.com (SPF and DKIM DNS records).
- [ ] Set `RESEND_API_KEY` and `EMAIL_FROM` (for example `Shortlist <hello@yourdomain.com>`).
- **Check:** "Send it again" on the confirmation banner delivers to Gmail's inbox, not spam.

## 6. Legal pages
- [ ] Set `LEGAL_OPERATOR_NAME`, `LEGAL_COUNTRY` and `SUPPORT_EMAIL`.
- [ ] Read /terms, /privacy and /refund once as a customer would.

## 7. Card payments (Paddle)
- [ ] Apply for a Paddle account. They review the website, the legal pages and the product. Approval takes a few days.
- [ ] In the sandbox first, create the product "Job-hunt pass" with two one-time prices: $15 (30 days) and $35 (90 days).
- [ ] Set `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_30`, `NEXT_PUBLIC_PADDLE_PRICE_90` and `PADDLE_ENV=sandbox`.
- [ ] Add a notification destination: `https://YOUR_DOMAIN/api/webhooks/paddle`, event `transaction.completed`. Copy its secret to `PADDLE_WEBHOOK_SECRET`.
- [ ] Buy a pass with a Paddle test card.
- **Check:** Billing shows "Pass · 30 days left".
- [ ] Repeat with live keys and prices, and set `PADDLE_ENV=production`.

## 8. Nepal payments (Khalti)
- [ ] Apply for a Khalti merchant account and get the live secret key.
- [ ] Test in the sandbox first with `KHALTI_ENV=sandbox` and the test key.
- [ ] Set `KHALTI_SECRET_KEY` and `KHALTI_ENV=production`.
- **Check:** buy the 30-day pass for NPR 1,500 with a real wallet. Billing shows the pass.

## 9. Daily reminders (cron-job.org)
- [ ] Generate a secret: `openssl rand -hex 32`. Set it as `CRON_JOB_SECRET`, then redeploy.
- [ ] At cron-job.org, create a job for `https://YOUR_DOMAIN/api/cron-job/daily`, once a day. Under Advanced, add the header `Authorization: Bearer <secret>`.
- **Check:** `curl -H "Authorization: Bearer <secret>" "https://YOUR_DOMAIN/api/cron-job/daily?wait=1"` returns a JSON result, and the same call without the header returns 401.

## 10. Security checks
- [ ] securityheaders.com gives the domain an A.
- [ ] Production secrets are not the sandbox ones.
- [ ] Sign up two accounts. Paste a job URL from one into the other. It must show "not found".

## 11. Final run as a real user
- [ ] With AI on, use 3 real CVs × 3 real job posts. Accept every change, and confirm nothing in the CV, letter or interview answers is untrue.
- [ ] Print 5 different templates to PDF in Chrome, and open them in a PDF reader.
- [ ] Open 3 Word downloads in Word and Google Docs.
- [ ] Do the whole journey on a phone.

## 12. After launch
- Watch the Vercel logs for errors in the first days.
- Check Anthropic spend weekly.
- Check that cron-job.org shows a successful run every day.
