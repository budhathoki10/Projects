import { Freemius } from "@freemius/sdk";
import { describe, expect, it } from "vitest";
import type { Subscription } from "@/db/types";
import { accessUntil, deriveStatus, effectiveStatus, subscriptionAccessUntil } from "@/lib/billing/access";
import { BillingConfigError, billingConfigured, billingMode, billingPolicy, freemiusConfig, planConfig, priceLabels, type BillingPolicy } from "@/lib/billing/config";
import { BILLING_CYCLE } from "@freemius/sdk";
import { intervalOf, snapshotOf, type ProviderSnapshot } from "@/lib/billing/snapshot";
import { mergeSnapshot } from "@/lib/services/subscriptions";
import { DAY, events, FREEMIUS_TEST_ENV, IDS, SECRET, sign, type LicenseSpec } from "./support/freemius";

const policy: BillingPolicy = { graceDays: 3, suspendedAccess: "none" };
const NOW = new Date("2026-11-10T12:00:00Z");
const plan = planConfig(FREEMIUS_TEST_ENV);

const blank = (over: Partial<Subscription> = {}): Subscription => ({
  id: "row-1",
  userId: "user-1",
  buyerEmail: "buyer@example.com",
  status: "pending",
  interval: null,
  freemiusLicenseId: null,
  freemiusSubscriptionId: null,
  freemiusUserId: null,
  freemiusProductId: null,
  freemiusPlanId: null,
  freemiusPricingId: null,
  environment: "sandbox",
  currency: null,
  amountMinor: null,
  startedAt: null,
  currentPeriodStart: null,
  paidThrough: null,
  nextPaymentAt: null,
  failedPayments: 0,
  suspended: false,
  cancelRequestedAt: null,
  cancelledAt: null,
  licenseUpdatedAt: null,
  subscriptionUpdatedAt: null,
  version: 0,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

/** A snapshot built the way production builds one: from the event's own license/subscription objects. */
function snapshot(event: ReturnType<(typeof events)[keyof typeof events]>, signals: Partial<ProviderSnapshot["signals"]> = {}) {
  const o = event.objects as { license: never; subscription?: never; user?: never };
  const at = new Date(event.created.replace(" ", "T") + "Z");
  return snapshotOf({ license: o.license, subscription: o.subscription ?? null, buyer: o.user ?? null, signals: { at, ...signals }, plan });
}
const apply = (row: Subscription, event: ReturnType<(typeof events)[keyof typeof events]>, now = NOW, signals: Partial<ProviderSnapshot["signals"]> = {}) => mergeSnapshot(row, snapshot(event, signals), now, policy);

describe("billing configuration", () => {
  it("names every missing variable instead of failing quietly", () => {
    expect(() => freemiusConfig({})).toThrow(BillingConfigError);
    try {
      freemiusConfig({ FREEMIUS_PRODUCT_ID: "1" });
    } catch (e) {
      expect((e as BillingConfigError).missing).toEqual(["FREEMIUS_API_KEY", "FREEMIUS_SECRET_KEY", "FREEMIUS_PUBLIC_KEY"]);
      expect((e as Error).message).toContain(".env.example");
    }
    expect(() => planConfig({})).toThrow(/FREEMIUS_PLAN_ID, FREEMIUS_PRICING_ID_MONTHLY, FREEMIUS_PRICING_ID_YEARLY/);
    expect(() => freemiusConfig({ ...FREEMIUS_TEST_ENV, FREEMIUS_PRODUCT_ID: "abc" })).toThrow(/FREEMIUS_PRODUCT_ID/);
  });

  it("treats blank values as missing and trims real ones", () => {
    expect(() => freemiusConfig({ ...FREEMIUS_TEST_ENV, FREEMIUS_API_KEY: "   " })).toThrow(/FREEMIUS_API_KEY/);
    expect(freemiusConfig({ ...FREEMIUS_TEST_ENV, FREEMIUS_API_KEY: "  key  " }).apiKey).toBe("key");
    expect(() => freemiusConfig({ ...FREEMIUS_TEST_ENV, FREEMIUS_SECRET_KEY: "too-short" })).toThrow(/at least 32 characters/);
  });

  it("only accepts sandbox or production, and defaults to the safe one", () => {
    expect(billingMode({})).toBe("sandbox");
    expect(billingMode({ FREEMIUS_MODE: "Production" })).toBe("production");
    expect(() => billingMode({ FREEMIUS_MODE: "live" })).toThrow(/FREEMIUS_MODE/);
  });

  it("reports whether checkout can be offered, never throwing", () => {
    expect(billingConfigured({})).toBe(false);
    expect(billingConfigured(FREEMIUS_TEST_ENV)).toBe(true);
    expect(billingConfigured({ ...FREEMIUS_TEST_ENV, FREEMIUS_MODE: "nonsense" })).toBe(false);
  });

  it("validates the policy", () => {
    expect(billingPolicy({})).toEqual({ graceDays: 3, suspendedAccess: "none" });
    expect(billingPolicy({ BILLING_GRACE_DAYS: "0", BILLING_SUSPENDED_ACCESS: "grace" })).toEqual({ graceDays: 0, suspendedAccess: "grace" });
    for (const bad of ["-1", "61", "2.5", "abc"]) expect(() => billingPolicy({ BILLING_GRACE_DAYS: bad }), bad).toThrow(/BILLING_GRACE_DAYS/);
    expect(() => billingPolicy({ BILLING_SUSPENDED_ACCESS: "yes" })).toThrow(/BILLING_SUSPENDED_ACCESS/);
  });

  it("shows price labels only when set, and never more than a short line", () => {
    expect(priceLabels({})).toEqual({ monthly: null, yearly: null });
    expect(priceLabels({ BILLING_PRICE_LABEL_MONTHLY: " $9 / month ", BILLING_PRICE_LABEL_YEARLY: "x".repeat(200) }).yearly).toHaveLength(40);
  });
});

describe("what each state is worth", () => {
  const paid = (over: Partial<Subscription>) => blank({ freemiusLicenseId: "5001", paidThrough: new Date(NOW.getTime() + 10 * DAY), ...over });

  it("derives the status from facts, not from a claim", () => {
    expect(deriveStatus(blank(), NOW, policy)).toBe("pending");
    expect(deriveStatus(blank({ freemiusLicenseId: "5001" }), NOW, policy)).toBe("pending"); // a license with no verified paid-through date
    expect(deriveStatus(paid({}), NOW, policy)).toBe("active");
    expect(deriveStatus(paid({ failedPayments: 1 }), NOW, policy)).toBe("past_due");
    expect(deriveStatus(paid({ cancelledAt: NOW }), NOW, policy)).toBe("cancelled");
    expect(deriveStatus(paid({ suspended: true }), NOW, policy)).toBe("suspended");
    expect(deriveStatus(paid({ paidThrough: new Date(NOW.getTime() - DAY) }), NOW, policy)).toBe("expired");
  });

  it("grants access exactly as the policy says", () => {
    const end = new Date(NOW.getTime() + 10 * DAY);
    expect(accessUntil(blank(), NOW, policy)).toBeNull(); // pending: nothing
    expect(accessUntil(paid({ status: "active" }), NOW, policy)).toEqual(end);
    expect(accessUntil(paid({ status: "cancelled", cancelledAt: NOW }), NOW, policy)).toEqual(end); // cancelled keeps what was paid for
    expect(accessUntil(paid({ status: "suspended", suspended: true }), NOW, policy)).toBeNull(); // default: none
    expect(accessUntil(paid({ status: "suspended", suspended: true }), NOW, { ...policy, suspendedAccess: "grace" })).toEqual(new Date(end.getTime() + 3 * DAY));
    expect(accessUntil(paid({ status: "expired", paidThrough: new Date(NOW.getTime() - DAY) }), NOW, policy)).toBeNull();
  });

  it("keeps a failing-renewal customer in for the grace period, then stops", () => {
    const ended = new Date(NOW.getTime() - 2 * DAY); // the paid period ended two days ago and the renewal failed
    const row = paid({ status: "past_due", failedPayments: 1, paidThrough: ended });
    expect(effectiveStatus(row, NOW, policy)).toBe("past_due");
    expect(accessUntil(row, NOW, policy)).toEqual(new Date(ended.getTime() + 3 * DAY));
    const later = new Date(NOW.getTime() + 2 * DAY); // grace (3 days from the end) has now run out
    expect(effectiveStatus(row, later, policy)).toBe("expired");
    expect(accessUntil(row, later, policy)).toBeNull();
    expect(effectiveStatus(row, NOW, { ...policy, graceDays: 0 })).toBe("expired");
  });

  it("never trusts a stored status once the date has passed (a missed webhook can't leave someone paid up forever)", () => {
    const stale = paid({ status: "active", paidThrough: new Date(NOW.getTime() - DAY) });
    expect(effectiveStatus(stale, NOW, policy)).toBe("expired");
    expect(subscriptionAccessUntil([stale], NOW, policy)).toBeNull();
    const cancelledStale = paid({ status: "cancelled", cancelledAt: NOW, paidThrough: new Date(NOW.getTime() - 1) });
    expect(effectiveStatus(cancelledStale, NOW, policy)).toBe("expired");
  });

  it("takes the latest end across several subscriptions", () => {
    const a = paid({ status: "active", paidThrough: new Date(NOW.getTime() + 5 * DAY) });
    const b = paid({ status: "cancelled", cancelledAt: NOW, paidThrough: new Date(NOW.getTime() + 20 * DAY) });
    const c = paid({ status: "expired", paidThrough: new Date(NOW.getTime() - 5 * DAY) });
    expect(subscriptionAccessUntil([a, b, c], NOW, policy)).toEqual(b.paidThrough);
    expect(subscriptionAccessUntil([c], NOW, policy)).toBeNull();
    expect(subscriptionAccessUntil([], NOW, policy)).toBeNull();
  });
});

describe("turning Freemius events into subscription state", () => {
  const month = (over: Partial<LicenseSpec> = {}): LicenseSpec => ({ expiration: new Date(NOW.getTime() + 30 * DAY), updated: NOW, ...over });

  it("a first purchase becomes active, with the plan, interval, dates and ids saved", () => {
    const row = apply(blank({ freemiusLicenseId: "5001" }), events.subscriptionCreated(month(), NOW));
    expect(row).toMatchObject({ status: "active", interval: "monthly", freemiusLicenseId: "5001", freemiusSubscriptionId: "6001", freemiusUserId: "3001", freemiusPlanId: IDS.plan, freemiusPricingId: IDS.monthly, currency: "USD", amountMinor: 900, environment: "sandbox", failedPayments: 0 });
    expect(row.paidThrough).toEqual(new Date(NOW.getTime() + 30 * DAY));
    expect(row.startedAt).toBeInstanceOf(Date);
    expect(row.buyerEmail).toBe("buyer@example.com");
  });

  it("tells monthly from yearly by the pricing record", () => {
    expect(apply(blank({ freemiusLicenseId: "5001" }), events.subscriptionCreated(month({ pricingId: IDS.yearly }), NOW)).interval).toBe("yearly");
    expect(apply(blank({ freemiusLicenseId: "5001" }), events.licenseCreated(month({ pricingId: IDS.yearly }), NOW)).interval).toBeNull(); // a license alone doesn't say
  });

  it("applying the same event twice changes nothing", () => {
    const e = events.subscriptionCreated(month(), NOW);
    const once = apply(blank({ freemiusLicenseId: "5001" }), e);
    expect(apply(once, e)).toEqual(once);
  });

  it("a renewal moves the paid-through date forward, keeps access, and starts a new period", () => {
    const active = apply(blank({ freemiusLicenseId: "5001" }), events.subscriptionCreated(month(), NOW));
    const renewedAt = new Date(NOW.getTime() + 30 * DAY);
    const renewed = apply(active, events.licenseExtended(month({ expiration: new Date(renewedAt.getTime() + 30 * DAY), updated: renewedAt }), renewedAt), renewedAt);
    expect(renewed.status).toBe("active");
    expect(renewed.paidThrough).toEqual(new Date(renewedAt.getTime() + 30 * DAY));
    expect(renewed.currentPeriodStart).toEqual(active.paidThrough);
  });

  it("a failed renewal is past due but still has access; recovery clears it", () => {
    const active = apply(blank({ freemiusLicenseId: "5001" }), events.subscriptionCreated(month(), NOW));
    const failAt = new Date(NOW.getTime() + 30 * DAY + 3600_000);
    const failed = apply(active, events.renewalFailed(month({ updated: failAt }), failAt), failAt, { renewalFailed: true });
    expect(failed.status).toBe("past_due");
    expect(failed.failedPayments).toBe(1);
    expect(accessUntil(failed, failAt, policy)!.getTime()).toBeGreaterThan(failAt.getTime());

    const recoverAt = new Date(failAt.getTime() + DAY);
    const recovered = apply(failed, events.licenseExtended(month({ expiration: new Date(recoverAt.getTime() + 30 * DAY), updated: recoverAt }), recoverAt), recoverAt);
    expect(recovered).toMatchObject({ status: "active", failedPayments: 0, suspended: false });
  });

  it("the last failed attempt suspends; recovery or a new period lifts it", () => {
    const active = apply(blank({ freemiusLicenseId: "5001" }), events.subscriptionCreated(month(), NOW));
    const at = new Date(NOW.getTime() + 31 * DAY);
    const last = apply(active, events.renewalFailedLast(month({ updated: at }), at), at, { renewalFailedLast: true });
    expect(last).toMatchObject({ status: "suspended", suspended: true });
    expect(accessUntil(last, at, policy)).toBeNull();
    const back = new Date(at.getTime() + DAY);
    expect(apply(last, events.licenseExtended(month({ expiration: new Date(back.getTime() + 30 * DAY), updated: back }), back), back)).toMatchObject({ status: "active", suspended: false });
  });

  it("a cancellation keeps access to the paid-through date, then expires", () => {
    const active = apply(blank({ freemiusLicenseId: "5001" }), events.subscriptionCreated(month(), NOW));
    const cancelAt = new Date(NOW.getTime() + 5 * DAY);
    const cancelled = apply(active, events.subscriptionCancelled(month({ updated: cancelAt }), cancelAt), cancelAt, { cancellationConfirmed: true });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toEqual(cancelAt);
    expect(accessUntil(cancelled, cancelAt, policy)).toEqual(active.paidThrough);
    const after = new Date(active.paidThrough!.getTime() + 1000);
    expect(effectiveStatus(cancelled, after, policy)).toBe("expired");
    expect(accessUntil(cancelled, after, policy)).toBeNull();
  });

  it("a request to cancel is not a cancellation: the status only changes when Freemius confirms", () => {
    const active = apply(blank({ freemiusLicenseId: "5001" }), events.subscriptionCreated(month(), NOW));
    const requested = { ...active, cancelRequestedAt: NOW };
    expect(deriveStatus(requested, NOW, policy)).toBe("active");
    expect(requested.cancelledAt).toBeNull();
  });

  it("a seller-cancelled license suspends access", () => {
    const row = apply(blank({ freemiusLicenseId: "5001" }), events.licenseCancelled(month(), NOW));
    expect(row).toMatchObject({ suspended: true, status: "suspended" });
    expect(accessUntil(row, NOW, policy)).toBeNull();
  });

  it("a delayed older event cannot undo newer data", () => {
    const newer = new Date(NOW.getTime() + 2 * DAY);
    const renewed = apply(blank({ freemiusLicenseId: "5001" }), events.licenseExtended(month({ expiration: new Date(NOW.getTime() + 60 * DAY), updated: newer }), newer), newer);
    // An older license.updated (from before the renewal) arrives late, with the earlier expiration.
    const stale = apply(renewed, events.licenseUpdated(month({ expiration: new Date(NOW.getTime() + 30 * DAY), updated: NOW }), NOW), newer);
    expect(stale.paidThrough).toEqual(new Date(NOW.getTime() + 60 * DAY));
  });

  it("a failure notice that arrives after the payment was already recovered is ignored", () => {
    const failAt = new Date(NOW.getTime() + 1 * DAY);
    const recoverAt = new Date(NOW.getTime() + 2 * DAY);
    const recovered = apply(blank({ freemiusLicenseId: "5001" }), events.licenseExtended(month({ expiration: new Date(NOW.getTime() + 60 * DAY), updated: recoverAt }), recoverAt), recoverAt);
    const late = apply(recovered, events.renewalFailed(month({ updated: failAt }), failAt), recoverAt, { renewalFailed: true });
    expect(late.failedPayments).toBe(0);
    expect(late.status).toBe("active");
  });

  it("an event with no time information is still applied (a late one can't be told apart, so it can't be dropped)", () => {
    const e = events.licenseExtended(month(), NOW);
    const snap = snapshot(e);
    snap.license!.updatedAt = null;
    expect(mergeSnapshot(blank({ freemiusLicenseId: "5001" }), snap, NOW, policy).status).toBe("active");
  });

  it("keeps the buyer's email from checkout, and reads the sandbox flag from the license", () => {
    const row = apply(blank({ freemiusLicenseId: "5001", buyerEmail: "locked@example.com" }), events.subscriptionCreated(month({ email: "other@example.com" }), NOW));
    expect(row.buyerEmail).toBe("locked@example.com");
    expect(apply(blank({ freemiusLicenseId: "5001" }), events.licenseCreated(month({ sandbox: false }), NOW)).environment).toBe("production");
  });
});

describe("monthly or yearly", () => {
  const separate = { planId: "1", pricingIds: { monthly: "10", yearly: "20" } };
  const shared = { planId: "1", pricingIds: { monthly: "10", yearly: "10" } };

  it("a pricing record that carries both prices still tells yearly from monthly, by the billing cycle", () => {
    expect(intervalOf("10", BILLING_CYCLE.YEARLY, shared)).toBe("yearly");
    expect(intervalOf("10", BILLING_CYCLE.MONTHLY, shared)).toBe("monthly");
    expect(intervalOf("10", null, shared)).toBeNull(); // not guessed
  });

  it("separate pricing records work as before, and the billing cycle wins if they ever disagree", () => {
    expect(intervalOf("10", null, separate)).toBe("monthly");
    expect(intervalOf("20", null, separate)).toBe("yearly");
    expect(intervalOf("20", BILLING_CYCLE.MONTHLY, separate)).toBe("monthly");
    expect(intervalOf("99", null, separate)).toBeNull();
  });
});

describe("webhook authenticity (the real SDK's verification)", () => {
  const freemius = new Freemius({ productId: IDS.product, apiKey: "k", secretKey: SECRET, publicKey: "p" });
  const body = JSON.stringify(events.licenseCreated({ expiration: new Date(NOW.getTime() + DAY) }, NOW, "evt_auth"));
  const run = async (rawBody: string, headers: Record<string, string>) => {
    const seen: string[] = [];
    const listener = freemius.webhook.createListener({ onError: async () => {} });
    listener.on("license.created", async (e) => {
      seen.push(e.id);
    });
    const res = await listener.process({ headers: new Headers(headers), rawBody });
    return { res, seen };
  };

  it("accepts a correctly signed event and hands it to the handler", async () => {
    const { res, seen } = await run(body, { "x-signature": sign(body) });
    expect(res).toMatchObject({ status: 200, success: true });
    expect(seen).toEqual(["evt_auth"]);
  });

  it("rejects a bad, missing, tampered or wrong-key signature with 401, and runs no handler", async () => {
    for (const [label, rawBody, headers] of [
      ["wrong signature", body, { "x-signature": "0".repeat(64) }],
      ["no signature", body, {}],
      ["empty signature", body, { "x-signature": "" }],
      ["not hex", body, { "x-signature": "zzzz" }],
      ["tampered body", body.replace("evt_auth", "evt_evil"), { "x-signature": sign(body) }],
      ["signed with another key", body, { "x-signature": sign(body, "some-other-secret") }],
    ] as const) {
      const { res, seen } = await run(rawBody, { ...headers });
      expect(res.status, label).toBe(401);
      expect(seen, label).toEqual([]);
    }
  });

  it("rejects an unreadable payload even when it is properly signed", async () => {
    const junk = "{not json";
    const { res, seen } = await run(junk, { "x-signature": sign(junk) });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(seen).toEqual([]);
  });

  it("acknowledges an event type nobody handles, without error", async () => {
    const other = JSON.stringify({ id: "evt_x", type: "user.created", created: "2026-11-10 12:00:00", objects: {}, data: {} });
    const { res } = await run(other, { "x-signature": sign(other) });
    expect(res.status).toBe(200);
  });

  it("answers 500 when a handler fails, so Freemius retries", async () => {
    const listener = freemius.webhook.createListener({ onError: async () => {} });
    listener.on("license.created", async () => {
      throw new Error("boom");
    });
    const res = await listener.process({ headers: new Headers({ "x-signature": sign(body) }), rawBody: body });
    expect(res.status).toBe(500);
  });
});
