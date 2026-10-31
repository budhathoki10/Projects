# Billing with Freemius

Payments run through **Freemius** (monthly and yearly subscriptions) and nothing else.

This document is the setup guide and the record of what was built, what was tested, and what still needs you.

## How access works

Paid access comes only from a Freemius subscription, and is worked out from stored, provider-confirmed dates on every request. Prices are set in Freemius; the pricing page only shows optional text labels.

## How it works

```
Browser                         This server                         Freemius
  │ "Subscribe monthly"            │                                    │
  ├───────────────────────────────▶│ startCheckout (server action)      │
  │                                │  • checks login, rate limit, no live subscription
  │                                │  • saves a "pending" row (grants nothing)
  │                                │  • builds checkout options with the SDK:
  │                                │    plan + pricing + sandbox flag + buyer email LOCKED
  │◀───────────────────────────────┤ options (no secrets)               │
  │ opens overlay (iframe) ────────┼───────────────────────────────────▶│ pays
  │                                │◀── signed webhook ─────────────────┤ license.created, subscription.created
  │                                │  • HMAC verified by the SDK
  │                                │  • event recorded once (ledger)
  │                                │  • subscription row set from verified data → access
  │ "I paid" callback ─────────────▶ confirmCheckout: asks Freemius's API (sends no data)
```

**Paid access is only ever granted from data that came from Freemius** (a signature-verified webhook, or a call to Freemius's API). The browser's "success" callback only makes the server *go and check*; it supplies nothing to be forged.

### Files

| Path | Role |
|---|---|
| `src/lib/billing/config.ts` | Reads and validates every `FREEMIUS_*` / `BILLING_*` variable; clear errors naming what's missing |
| `src/lib/billing/freemius.ts` | The one SDK client (server-only) and the `BillingGateway` seam around the SDK calls |
| `src/lib/billing/snapshot.ts` | Maps Freemius entities to this app's terms (rejects any non-string/number id) |
| `src/lib/billing/access.ts` | **The access policy**: what each state is worth. Pure and unit tested |
| `src/lib/billing/events.ts` | Dispatches each webhook event; `handleFreemiusEvent` = claim → process → record |
| `src/lib/billing/webhook-ledger.ts` | Event ledger: idempotency, locking, retry |
| `src/lib/billing/sync.ts` | On-request check against Freemius's API (after checkout, on cancel), payment bookkeeping |
| `src/lib/services/subscriptions.ts` | Subscription rows: merge rules, optimistic concurrency, checkout rows |
| `src/app/api/webhooks/freemius/route.ts` | The webhook endpoint |
| `src/app/actions/subscription.ts` | Checkout, confirm, abandon, cancel (server actions) |
| `src/components/subscribe-plans.tsx` | Billing UI (opens the overlay with the server's options) |

## Webhook events

Verified against the SDK's own types (`@freemius/sdk` 0.5.0, `WebhookEventDataMap`) and Freemius's events documentation. Subscribe the listener to these (subscribing to everything is harmless: unknown events are acknowledged and ignored).

| Event | Effect |
|---|---|
| `license.created` | Creates (or links) the subscription; sets paid-through date |
| `subscription.created` | Adds the subscription id, interval, amount, next payment |
| `license.extended` | A renewal or recovered payment: period moves forward, failures clear |
| `license.shortened`, `license.updated`, `license.plan.changed` | Dates / plan re-applied (older data never overwrites newer) |
| `subscription.renewal.failed` | `past_due`; records a failed payment; grace period starts |
| `subscription.renewal.failed.last` | `suspended` (the last retry failed) |
| `subscription.cancelled` | `cancelled`: renewals stop, access continues to the paid-through date |
| `license.cancelled` | Reflects the license's `is_cancelled` flag → `suspended` |
| `license.expired` | Period over → `expired` |
| `license.deleted` | Access ends immediately |

**Not handled, on purpose:** all refund events (this app has no refund handling). The SDK does not type a `payment.created` event, so **payments are recorded by reading Freemius's payments API** after each license/subscription event and when a customer's billing is checked, keyed by Freemius's payment id (so each is recorded once).

### If a webhook is missed

Billing runs on webhooks alone: there is no scheduled job. I don't know whether Freemius retries a delivery your server didn't acknowledge (the documentation pages I read don't say), so treat it as possible but unconfirmed. Check the Webhooks section of your Freemius dashboard, or watch a sandbox delivery fail.

If an event is lost for good:

- **Access can never outlast what was paid for.** It is judged from the paid-through date on every request, so a lost "expired" or "cancelled" event cannot give anyone free time.
- **A lost renewal, recovery or cancellation leaves the account on its old dates** until the next event for that subscription arrives. The only things that ask Freemius's API directly are finishing a checkout, the **Check again** button (shown only while a checkout is waiting), and cancelling from the app. There is nothing a customer with an existing subscription can press to force a refresh, and a lost *renewal* would eventually show as expired even though they paid.
- A lost payment *record* is filled in the next time that subscription's events or billing check run.

If that gap isn't acceptable for your customers, checking Freemius's API on a schedule, or each time someone opens the billing page, is a small addition: `syncLicense` in `src/lib/billing/sync.ts` already refreshes one license.

### Delivery guarantees

- **Authenticity:** the SDK checks the `x-signature` header (HMAC-SHA256 of the raw body with your product's secret key, constant-time compare). Bad, missing or tampered signatures get **401** and nothing is recorded.
- **Idempotent:** every event is recorded by Freemius's event id. A redelivery returns 200 and does nothing.
- **Concurrent deliveries:** one wins the claim; the others get "already done" or a 500 ("busy, retry") and never run a second time.
- **Retry-safe:** a failure marks the event `failed` and returns **500**, so it's retried; the retry takes it over. A crashed worker's claim expires after 60s.
- **Out of order / delayed:** each piece of data carries Freemius's own `updated` time, and older data never overwrites newer. A late "renewal failed" after a recovery is ignored.
- **Safe to run in parallel:** writes use optimistic concurrency (a `version` field) plus a unique index on the Freemius license id. MongoDB multi-document transactions aren't used (they need a replica set; local and test servers are standalone). Every write is a single-document operation instead.
- **Logs:** one JSON line per problem with ids and the *kind* of error; never payloads, headers or keys.

## Subscription states

| State | Meaning | Paid access |
|---|---|---|
| `pending` | Checkout opened, or purchase not yet confirmed | No |
| `active` | Paid through `paidThrough` | Until `paidThrough` |
| `past_due` | A renewal failed | Until `paidThrough` + grace days (`BILLING_GRACE_DAYS`, default 3) |
| `cancelled` | Freemius confirmed the cancellation | Until `paidThrough` |
| `suspended` | Last renewal attempt failed, or seller cancelled the license | `BILLING_SUSPENDED_ACCESS`: `none` (default) or the grace period |
| `expired` | `paidThrough` (plus grace) has passed | No |

"Cancel" in the app is a **request**: it asks Freemius to cancel (`api.subscription.cancel`) and records `cancelRequestedAt`. The status only becomes `cancelled` when Freemius confirms.

Access is **judged from dates on every request**, not from the stored status, so a missed "expired" event can never leave someone paid up forever. The stored status can lag behind the dates (it only changes when an event arrives); nothing reads it for access decisions.

`past_due` and `suspended` are this app's states, not Freemius's.

## Database

Created automatically on first connect (or run `npm run db:setup`). No existing data is changed.

| Collection | New? | Holds |
|---|---|---|
| `subscriptions` | new | One row per Freemius license: user, Freemius customer/license/subscription/product/plan/pricing ids, interval, status, start, current period, `paidThrough`, next payment, failed payments, cancellation request/confirmation, amount/currency, environment |
| `webhook_events` | new | One row per event: id, type, status (`processing`/`processed`/`ignored`/`failed`), attempts, note |
| `payments` | extended | Freemius payments ( `provider: "freemius"`, `subscriptionId`, `kind`) |

Indexes that carry correctness: unique `subscriptions.freemiusLicenseId` (no duplicate subscriptions from redelivery), unique "one pending checkout per user", unique `payments.providerRef` (no duplicate payments), unique `webhook_events._id`.

Amounts are stored in minor units assuming a two-decimal currency (`gross × 100`).

## Freemius dashboard setup

Menu names are from memory of the Freemius Developer Dashboard and may differ slightly; the Freemius docs at https://freemius.com/help/documentation/ are the reference.

1. **Create the product** as a SaaS product in the Developer Dashboard.
2. **Plans:** create one **paid plan**. Under it, add two **pricing** records: one **monthly**, one **yearly**. Note the plan's numeric ID and each pricing record's numeric ID.
3. **Keys:** from the product's settings page, copy the **Product ID**, **Public Key** and **Secret Key**. Get your **API key** (used as the bearer credential) from the Developer Dashboard.
4. **Webhook:** Developer Dashboard → **Webhooks** → **Listeners** → **Add Webhook**.
   - URL: `https://YOUR_DOMAIN/api/webhooks/freemius`
   - Events: the ones in the table above (or all)
   - Activate it.
5. **Sandbox:** keep `FREEMIUS_MODE=sandbox`. The SDK builds sandbox checkout parameters for you; test cards come from Freemius's documentation.
6. Put the values in your environment (see `.env.example`), then:
   - `FREEMIUS_PLAN_ID` = the paid plan ID
   - `FREEMIUS_PRICING_ID_MONTHLY` / `FREEMIUS_PRICING_ID_YEARLY` = the two pricing IDs

### Environment variables

| Variable | Where it comes from | Required |
|---|---|---|
| `FREEMIUS_MODE` | `sandbox` or `production` | Defaults to `sandbox` |
| `FREEMIUS_PRODUCT_ID` | Product ID (number) | Yes |
| `FREEMIUS_API_KEY` | Developer Dashboard API key | Yes |
| `FREEMIUS_SECRET_KEY` | Product secret key (the SDK needs ≥ 32 chars) | Yes |
| `FREEMIUS_PUBLIC_KEY` | Product public key | Yes |
| `FREEMIUS_PLAN_ID` | Paid plan ID | Yes |
| `FREEMIUS_PRICING_ID_MONTHLY` / `_YEARLY` | The two pricing IDs | Yes |
| `BILLING_GRACE_DAYS` | Days kept after a failed renewal (0–60) | Default 3 |
| `BILLING_SUSPENDED_ACCESS` | `none` or `grace` | Default `none` |
| `BILLING_PRICE_LABEL_MONTHLY` / `_YEARLY` | Display text, e.g. `USD 9 / month` (avoid a bare `$` in `.env`: it is expanded like a variable) | Optional |
| `FREEMIUS_SKIP_API_SYNC` | `1` stops all calls to Freemius's API | Tests only |

Missing values are a **clear error naming each variable**, never a silent skip: the webhook answers 503, and checkout says it isn't available. **None of these may ever go in a `NEXT_PUBLIC_` variable** (a test enforces it).

In **production** mode, sandbox purchases are rejected, so a test subscription can never unlock paid access.

## Test results (what was actually executed)

All run in this repository against the real SDK code, a real MongoDB (started by the tests) and a real Chromium. **Freemius itself was not contacted**: it needs your account. Its API is replaced by an in-memory stand-in in the integration tests (shapes follow the SDK's types), and switched off in the browser tests.

| # | Scenario | Where it's tested |
|---|---|---|
| 1 | Successful first purchase (account, pending row adopted, payment recorded) | integration, e2e |
| 2 | Failed payment at checkout (no license, nothing granted, row cleared) | integration |
| 3 | Cancelled checkout (slot freed) | integration |
| 4, 5 | Monthly and yearly | integration |
| 6 | Successful renewal | integration, unit |
| 7 | Failed renewal (past due, grace, then no access) | integration, e2e, unit |
| 8 | Payment recovery | integration, e2e, unit |
| 9 | Cancellation (request ≠ cancelled; access to paid-through) | integration, e2e, unit |
| 10 | Expiration | integration, e2e |
| 11 | Duplicate webhook delivery | integration, e2e |
| 12 | Invalid webhook (bad/missing/tampered/other-key signature) | unit (real SDK), e2e (real route) |
| 13 | Delayed / out-of-order delivery | integration, e2e, unit |
| 14 | Concurrent requests (10 identical → one run; different events on a new license → one row) | integration, e2e |
| 15 | No paid access after expiration (real download route returns 303 to billing) | integration, e2e |

Also covered: configuration errors, production-vs-sandbox rejection, other products/plans ignored, hostile payload shapes, credentials never reaching client code, refund code absent.

## Checked against the real Freemius sandbox (30 Oct 2026)

Run against product "shortlist" with a real tunnel to the app and a throwaway account (since deleted):

| Scenario | Result |
|---|---|
| Credentials, plan and pricing ids | Valid (read-only API calls) |
| Checkout opens, sandbox card, "Pay & Subscribe" | Works; no Content-Security-Policy violation from this app |
| Purchase → webhooks | `subscription.created`, `license.created`, `license.shortened` delivered with a valid signature and processed once each; 5 other event types (`user.created`, `card.updated`, `user.card.created`, `payment.created`, `user.email_status.dropped`) acknowledged and ignored |
| Access after purchase | Paid within ~10 s (the app also reads Freemius's API, so it does not wait for webhooks) |
| Payment record | Recorded once (`freemius:payment:<id>`, `kind: initial`) |
| Duplicate delivery (replayed through the tunnel) | Accepted with 200, no change |
| Renewal failure → final failure → recovery | `past_due` with grace → `suspended` (free plan) → `active`. These used correctly signed events built by hand, because Freemius's API cannot make a sandbox renewal fail |
| Cancel from the app (`api.subscription.cancel`) | Cancelled at once, access kept to the period end; the real `subscription.cancelled` webhook arrived ~1 min later and was processed |
| Expiry (license ended through Freemius's API) | Real `license.updated` webhook → `expired`, free plan, "Subscribe again" |
| Event shape | The real payload matches the SDK types and the test builders |

Things this showed:

- **One pricing record can carry both prices.** Freemius pricing `111095` has a monthly and a yearly price, so `FREEMIUS_PRICING_ID_MONTHLY` and `_YEARLY` can be the same id. The checkout therefore sets the billing cycle itself, and the interval of a subscription is read from its billing cycle, not from the pricing id.
- **Webhooks take 25 to 60 seconds** to arrive. Nothing depends on that speed.
- **`$` in `.env`.** `BILLING_PRICE_LABEL_MONTHLY=$9 / month` loses the `$9` (it is expanded like a variable). Use `USD 9 / month`.

Still not exercised live: a real renewal payment (needs a month, or Freemius support), and the mapping of `license.cancelled` (a *seller* cancelling a license) to `suspended`.

## Production checklist

- [ ] Product created in Freemius; paid plan with monthly and yearly pricing
- [ ] Every `FREEMIUS_*` and `BILLING_*` value set on the server (not `NEXT_PUBLIC_`)
- [ ] `FREEMIUS_MODE=production`, `APP_URL` set to the public URL
- [ ] Webhook listener points to `https://YOUR_DOMAIN/api/webhooks/freemius` and is active
- [ ] `npm run db:setup` run once against the production database
- [ ] Full sandbox run completed first: purchase, cancel, expiry (done in sandbox, see above), then a real renewal
- [ ] One real low-value purchase and cancellation after going live
- [ ] Legal pages reviewed (terms/privacy/refund now name Freemius; the refund *policy* wording is yours and unchanged)
- [ ] Refunds: **not in the app**; they happen in Freemius's dashboard. Decide how support handles them.

## Remaining manual steps for you

1. Create the Freemius product and plans, and fill in the values.
2. Add the webhook listener.
3. Repeat the sandbox run above in production mode with a real card and a refund-free test product.
4. Review the Terms, Privacy and Refund pages for your own wording.
