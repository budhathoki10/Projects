import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collections } from "@/db/mongo";
import type { Subscription } from "@/db/types";
import { EventBusyError, handleFreemiusEvent } from "@/lib/billing/events";
import { setBillingGateway } from "@/lib/billing/freemius";
import { syncPaymentsFor, syncUser } from "@/lib/billing/sync";
import { limitsFor } from "@/lib/plans";
import {
  abandonCheckout,
  accessUntilForUser,
  beginCheckout,
  blockingSubscription,
  claimByEmail,
  markCancelRequested,
  subscriptionsForUser,
} from "@/lib/services/subscriptions";
import { DAY, events, FakeFreemius, FREEMIUS_TEST_ENV, IDS, type FsEvent, type LicenseSpec } from "../support/freemius";
import { makeUser, resetDb } from "./helpers";

const fake = new FakeFreemius();
const deliver = (e: FsEvent, now?: Date) => handleFreemiusEvent(e as never, now);
const spec = (email: string, over: Partial<LicenseSpec> = {}): LicenseSpec => ({ email, expiration: new Date(Date.now() + 30 * DAY), ...over });
const only = async (userId: string): Promise<Subscription> => {
  const rows = await subscriptionsForUser(userId);
  expect(rows).toHaveLength(1);
  return rows[0];
};
const ledger = async () => (await collections()).webhookEvents.find({}).toArray();
const payments = async () => (await collections()).payments.find({ provider: "freemius" }).toArray();

beforeEach(async () => {
  await resetDb();
  fake.licenses.clear();
  fake.subscriptions.clear();
  fake.users.clear();
  fake.payments = [];
  fake.cancelled = [];
  setBillingGateway(fake);
  Object.assign(process.env, FREEMIUS_TEST_ENV);
});
afterEach(() => {
  setBillingGateway(null);
  Object.assign(process.env, FREEMIUS_TEST_ENV);
});

describe("1. a successful first purchase", () => {
  it("activates the account that opened checkout, once Freemius confirms, and records the payment", async () => {
    const user = await makeUser({ email: "asha@example.com" });
    await beginCheckout({ userId: user.id, email: user.email, interval: "monthly", environment: "sandbox" });

    // Checkout is open but nothing has been paid: no access, and a second checkout is refused.
    expect((await only(user.id)).status).toBe("pending");
    expect(await accessUntilForUser(user.id)).toBeNull();
    expect(await blockingSubscription(user.id)).not.toBeNull();

    const s = spec(user.email);
    fake.put(s);
    fake.pay(s, 9001, 9);
    expect(await deliver(events.licenseCreated(s))).toBe("processed");
    expect(await deliver(events.subscriptionCreated(s))).toBe("processed");

    const row = await only(user.id); // the pending row was adopted, not duplicated
    expect(row).toMatchObject({ status: "active", userId: user.id, interval: "monthly", freemiusLicenseId: "5001", freemiusSubscriptionId: "6001", freemiusUserId: "3001", freemiusPlanId: IDS.plan, freemiusPricingId: IDS.monthly, currency: "USD", amountMinor: 900, failedPayments: 0, environment: "sandbox" });
    expect(row.paidThrough!.getTime()).toBeGreaterThan(Date.now());

    const until = await accessUntilForUser(user.id);
    expect(until).toEqual(row.paidThrough);
    expect(limitsFor({ subscriptionAccessUntil: until }).docx).toBe(true);

    const paid = await payments();
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ _id: expect.any(String), providerRef: "freemius:payment:9001", status: "completed", amountMinor: 900, currency: "USD", userId: user.id, subscriptionId: row.id, kind: "initial" });
    expect((await ledger()).map((l) => l.status)).toEqual(["processed", "processed"]);
  });

  it("never grants anything for a purchase it can't tie to a verified owner", async () => {
    const stranger = spec("nobody@example.com");
    await deliver(events.licenseCreated(stranger));
    const [row] = await (await collections()).subscriptions.find({}).toArray();
    expect(row.userId).toBeNull(); // kept, waiting for an owner, granting nothing to anyone
    expect(row.status).toBe("active");
  });

  it("an account with an unconfirmed email can't claim a purchase by email, but can once confirmed", async () => {
    const user = await makeUser({ email: "unverified@example.com", emailVerifiedAt: null });
    await deliver(events.licenseCreated(spec(user.email)));
    expect(await subscriptionsForUser(user.id)).toHaveLength(0);
    expect(await accessUntilForUser(user.id)).toBeNull();
    expect(await claimByEmail({ id: user.id, email: user.email, emailVerifiedAt: null })).toBe(0);

    expect(await claimByEmail({ id: user.id, email: user.email, emailVerifiedAt: new Date() })).toBe(1);
    expect((await only(user.id)).status).toBe("active");
    expect(await accessUntilForUser(user.id)).not.toBeNull();
  });

  it("links a purchase to a confirmed account by email even with no checkout row", async () => {
    const user = await makeUser({ email: "confirmed@example.com", emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCreated(spec(user.email)));
    expect((await only(user.id)).userId).toBe(user.id);
  });
});

describe("2 and 3. failed payment and cancelled checkout", () => {
  it("a payment that fails at checkout produces no license, so nothing is ever granted, and the waiting row is cleared", async () => {
    const user = await makeUser();
    await beginCheckout({ userId: user.id, email: user.email, interval: "monthly", environment: "sandbox" });
    // The card is declined: Freemius creates no license and sends no event. Time passes.
    const later = new Date(Date.now() + 31 * 60_000);
    expect(await blockingSubscription(user.id, later)).toBeNull(); // the slot frees itself
    expect(await accessUntilForUser(user.id, later)).toBeNull();
    // Trying again replaces the stale row rather than being blocked by it.
    const again = await beginCheckout({ userId: user.id, email: user.email, interval: "yearly", environment: "sandbox" }, later);
    expect(again.interval).toBe("yearly");
    expect(await subscriptionsForUser(user.id)).toHaveLength(1);
  });

  it("closing checkout frees the slot at once, and only the person's own unfinished row is dropped", async () => {
    const asha = await makeUser();
    const ram = await makeUser();
    await beginCheckout({ userId: asha.id, email: asha.email, interval: "yearly", environment: "sandbox" });
    await beginCheckout({ userId: ram.id, email: ram.email, interval: "monthly", environment: "sandbox" });
    await abandonCheckout(asha.id);
    expect(await subscriptionsForUser(asha.id)).toHaveLength(0);
    expect(await subscriptionsForUser(ram.id)).toHaveLength(1);
  });

  it("two checkouts opened at the same instant make one row, never two", async () => {
    const user = await makeUser();
    const open = () => beginCheckout({ userId: user.id, email: user.email, interval: "monthly", environment: "sandbox" });
    await Promise.all(Array.from({ length: 8 }, open));
    expect(await subscriptionsForUser(user.id)).toHaveLength(1);
  });
});

describe("4 and 5. monthly and yearly", () => {
  it.each([
    ["monthly", IDS.monthly],
    ["yearly", IDS.yearly],
  ] as const)("a %s subscription is stored with its interval", async (interval, pricingId) => {
    const user = await makeUser();
    await beginCheckout({ userId: user.id, email: user.email, interval, environment: "sandbox" });
    await deliver(events.subscriptionCreated(spec(user.email, { pricingId, expiration: new Date(Date.now() + (interval === "yearly" ? 365 : 30) * DAY) })));
    const row = await only(user.id);
    expect(row.interval).toBe(interval);
    expect(row.status).toBe("active");
    expect(row.paidThrough!.getTime() - Date.now()).toBeGreaterThan((interval === "yearly" ? 360 : 28) * DAY);
  });
});

describe("6 and 8. renewal and payment recovery", () => {
  it("a renewal extends the period, keeps access unbroken, and records the new payment", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const first = spec(user.email, { expiration: new Date(Date.now() + 2 * DAY) });
    fake.put(first);
    fake.pay(first, 9001, 9);
    await deliver(events.subscriptionCreated(first));
    const before = await only(user.id);

    const renewedAt = new Date();
    const renewed = spec(user.email, { expiration: new Date(Date.now() + 32 * DAY), updated: new Date(renewedAt.getTime() + 1000) });
    fake.put(renewed);
    fake.pay(renewed, 9002, 9, { renewal: true });
    await deliver(events.licenseExtended(renewed, new Date(renewedAt.getTime() + 1000)));

    const after = await only(user.id);
    expect(after.status).toBe("active");
    expect(after.paidThrough!.getTime()).toBeGreaterThan(before.paidThrough!.getTime());
    expect(after.currentPeriodStart).toEqual(before.paidThrough);
    expect(await accessUntilForUser(user.id)).toEqual(after.paidThrough);
    const paid = (await payments()).sort((a, b) => a.providerRef.localeCompare(b.providerRef));
    expect(paid.map((p) => [p.providerRef, p.kind])).toEqual([["freemius:payment:9001", "initial"], ["freemius:payment:9002", "renewal"]]);
  });

  it("recovers from a failed renewal: past due with grace, then active again once paid", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const ended = spec(user.email, { expiration: new Date(Date.now() - 3600_000), updated: new Date(Date.now() - 2 * DAY) });
    await deliver(events.subscriptionCreated(ended, new Date(Date.now() - 2 * DAY)));
    // 7. The renewal fails right after the paid period ended.
    const failAt = new Date();
    await deliver(events.renewalFailed({ ...ended, updated: failAt }, failAt, "evt_fail_1"));
    const failed = await only(user.id);
    expect(failed).toMatchObject({ status: "past_due", failedPayments: 1 });
    expect(await accessUntilForUser(user.id)).not.toBeNull(); // grace: still in
    expect(await accessUntilForUser(user.id, new Date(Date.now() + 4 * DAY))).toBeNull(); // grace (3 days) has run out
    const attempt = (await (await collections()).payments.find({ providerRef: "freemius:failed:evt_fail_1" }).toArray())[0];
    expect(attempt).toMatchObject({ status: "failed", provider: "freemius", userId: user.id, kind: "renewal" });

    // 8. The customer fixes their card and Freemius takes the payment.
    const recoverAt = new Date(failAt.getTime() + 60_000);
    await deliver(events.licenseExtended(spec(user.email, { expiration: new Date(Date.now() + 30 * DAY), updated: recoverAt }), recoverAt));
    expect(await only(user.id)).toMatchObject({ status: "active", failedPayments: 0, suspended: false });
  });

  it("a final failed attempt suspends access (no grace by default), and recovery restores it", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const ended = spec(user.email, { expiration: new Date(Date.now() - 3600_000), updated: new Date(Date.now() - 2 * DAY) });
    await deliver(events.subscriptionCreated(ended, new Date(Date.now() - 2 * DAY)));
    const at = new Date();
    await deliver(events.renewalFailedLast({ ...ended, updated: at }, at));
    expect(await only(user.id)).toMatchObject({ status: "suspended", suspended: true });
    expect(await accessUntilForUser(user.id)).toBeNull();
    process.env.BILLING_SUSPENDED_ACCESS = "grace";
    const { billingPolicy } = await import("@/lib/billing/config");
    expect(await accessUntilForUser(user.id, new Date(), billingPolicy())).not.toBeNull();

    const back = new Date(at.getTime() + 1000);
    await deliver(events.licenseExtended(spec(user.email, { expiration: new Date(Date.now() + 30 * DAY), updated: back }), back));
    expect(await only(user.id)).toMatchObject({ status: "active", suspended: false });
  });
});

describe("9. cancellation", () => {
  it("separates asking to cancel from being cancelled, and keeps access to the paid-through date", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCreated(spec(user.email)));
    const row = await only(user.id);

    await markCancelRequested(row.id); // we asked Freemius to cancel; it hasn't said so yet
    const requested = await only(user.id);
    expect(requested.cancelRequestedAt).toBeInstanceOf(Date);
    expect(requested.cancelledAt).toBeNull();
    expect(requested.status).toBe("active");

    const at = new Date();
    await deliver(events.subscriptionCancelled(spec(user.email, { updated: at }), at));
    const cancelled = await only(user.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(await accessUntilForUser(user.id)).toEqual(cancelled.paidThrough);
    expect(await accessUntilForUser(user.id, new Date(cancelled.paidThrough!.getTime() + 1000))).toBeNull();
  });

  it("allows buying again after cancelling, and access is the later of the two periods", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCancelled(spec(user.email, { licenseId: 5001, expiration: new Date(Date.now() + 5 * DAY) })));
    expect(await blockingSubscription(user.id)).toBeNull(); // cancelled doesn't block a new purchase
    const second = spec(user.email, { licenseId: 5002, subscriptionId: 6002, expiration: new Date(Date.now() + 40 * DAY) });
    await deliver(events.subscriptionCreated(second));
    expect(await subscriptionsForUser(user.id)).toHaveLength(2);
    expect((await accessUntilForUser(user.id))!.getTime()).toBeGreaterThan(Date.now() + 39 * DAY);
    expect(await blockingSubscription(user.id)).not.toBeNull(); // and now a live one does
  });
});

describe("10 and 16. expiration and access afterwards", () => {
  it("an expired subscription grants nothing, even though no event said it ended", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCreated(spec(user.email, { expiration: new Date(Date.now() + 2 * DAY) })));
    expect(limitsFor({ subscriptionAccessUntil: await accessUntilForUser(user.id) }).docx).toBe(true);

    // Nothing tells us it ended (a missed webhook): access still stops, judged from the date.
    const later = new Date(Date.now() + 3 * DAY);
    const until = await accessUntilForUser(user.id, later);
    expect(until).toBeNull();
    expect(limitsFor({ subscriptionAccessUntil: until }).docx).toBe(false);
    expect(limitsFor({ subscriptionAccessUntil: until }).tailor).toBe(3); // free limits again

    // Judged from the dates, so nothing has to "sweep" it: the user can buy again straight away.
    expect(await blockingSubscription(user.id, later)).toBeNull();
  });

  it("an explicit expiry event ends access, and so does deleting the license", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCreated(spec(user.email)));
    const gone = new Date(Date.now() - 1000);
    await deliver(events.licenseExpired(spec(user.email, { expiration: gone })));
    expect(await accessUntilForUser(user.id)).toBeNull();
    expect((await only(user.id)).status).toBe("expired");

    const other = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCreated(spec(other.email, { licenseId: 5002, subscriptionId: 6002 })));
    expect(await accessUntilForUser(other.id)).not.toBeNull();
    await deliver(events.licenseDeleted(5002));
    expect(await accessUntilForUser(other.id)).toBeNull();
  });
});

describe("11. duplicate delivery", () => {
  it("processing the same event again changes and records nothing", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const s = spec(user.email);
    fake.put(s);
    fake.pay(s, 9001, 9);
    const e = events.subscriptionCreated(s, new Date(), "evt_once");
    expect(await deliver(e)).toBe("processed");
    const snapshot = JSON.stringify(await only(user.id));
    for (let i = 0; i < 4; i++) expect(await deliver(e)).toBe("duplicate");
    expect(JSON.stringify(await only(user.id))).toBe(snapshot);
    expect(await payments()).toHaveLength(1);
    const log = await ledger();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ _id: "freemius:evt_once", status: "processed", attempts: 1 });
  });

  it("a failed event is retried by its redelivery, and the second try succeeds", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const e = events.subscriptionCreated(spec(user.email), new Date(), "evt_retry");
    delete process.env.FREEMIUS_PLAN_ID; // a deployment mistake makes processing fail
    await expect(deliver(e)).rejects.toThrow();
    expect((await ledger())[0]).toMatchObject({ status: "failed", attempts: 1, note: "BillingConfigError" });
    expect(await subscriptionsForUser(user.id)).toHaveLength(0);

    Object.assign(process.env, FREEMIUS_TEST_ENV); // fixed
    expect(await deliver(e)).toBe("processed");
    expect((await ledger())[0]).toMatchObject({ status: "processed", attempts: 2 });
    expect((await only(user.id)).status).toBe("active");
  });

  it("a crashed worker's claim lapses, so the event isn't stuck forever", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const e = events.subscriptionCreated(spec(user.email), new Date(), "evt_stuck");
    const c = await collections();
    await c.webhookEvents.insertOne({ _id: "freemius:evt_stuck", provider: "freemius", eventId: "evt_stuck", type: "subscription.created", status: "processing", attempts: 1, lockedUntil: new Date(Date.now() + 60_000), licenseId: null, note: null, eventCreatedAt: null, receivedAt: new Date(), processedAt: null });
    await expect(deliver(e)).rejects.toBeInstanceOf(EventBusyError); // someone is on it right now
    await c.webhookEvents.updateOne({ _id: "freemius:evt_stuck" }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
    expect(await deliver(e)).toBe("processed"); // the lock ran out
  });
});

describe("13. delayed and out-of-order events", () => {
  it("an older update arriving late does not shorten a newer period", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const t0 = new Date(Date.now() - 2 * DAY);
    const t2 = new Date(Date.now() - 1 * DAY);
    await deliver(events.licenseExtended(spec(user.email, { expiration: new Date(Date.now() + 60 * DAY), updated: t2 }), t2));
    await deliver(events.licenseUpdated(spec(user.email, { expiration: new Date(Date.now() + 30 * DAY), updated: t0 }), t0)); // delivered late
    expect((await only(user.id)).paidThrough!.getTime()).toBeGreaterThan(Date.now() + 59 * DAY);
  });

  it("a failure notice delivered after the recovery doesn't put the account back in trouble", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const fail = new Date(Date.now() - 2 * DAY);
    const recover = new Date(Date.now() - 1 * DAY);
    await deliver(events.licenseExtended(spec(user.email, { expiration: new Date(Date.now() + 30 * DAY), updated: recover }), recover));
    await deliver(events.renewalFailed(spec(user.email, { updated: fail }), fail));
    expect(await only(user.id)).toMatchObject({ status: "active", failedPayments: 0 });
  });

  it("events for a license we haven't seen (the first one was lost) still build the right state", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.licenseExtended(spec(user.email))); // no license.created ever arrived
    expect((await only(user.id)).status).toBe("active");
  });
});

describe("14. concurrent webhook requests", () => {
  it("one event delivered many times at once is processed exactly once", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const s = spec(user.email);
    fake.put(s);
    fake.pay(s, 9001, 9);
    const e = events.subscriptionCreated(s, new Date(), "evt_race");
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => deliver(e)));
    const processed = results.filter((r) => r.status === "fulfilled" && r.value === "processed");
    expect(processed).toHaveLength(1);
    // Everyone else was told "already done" or "busy, retry": never a second run.
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(EventBusyError);
    expect(await subscriptionsForUser(user.id)).toHaveLength(1);
    expect(await payments()).toHaveLength(1);
    expect(await ledger()).toHaveLength(1);
  });

  it("different events for a brand-new license at once make one subscription with every fact", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const s = spec(user.email);
    fake.put(s);
    fake.pay(s, 9001, 9);
    const batch = [events.licenseCreated(s), events.subscriptionCreated(s), events.licenseUpdated(s), events.licenseExtended(s), events.licenseUpdated(s), events.subscriptionCreated(s)];
    const results = await Promise.allSettled(batch.map((e) => deliver(e)));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const rows = await subscriptionsForUser(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "active", interval: "monthly", freemiusSubscriptionId: "6001", freemiusLicenseId: "5001" });
    expect(await payments()).toHaveLength(1);
  });

  it("simultaneous renewals converge on the latest period", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCreated(spec(user.email)));
    const stamps = [10, 20, 30, 40, 50].map((d) => ({ d, at: new Date(Date.now() + d * 1000) }));
    await Promise.all(stamps.map(({ d, at }) => deliver(events.licenseExtended(spec(user.email, { expiration: new Date(Date.now() + (30 + d) * DAY), updated: at }), at))));
    expect((await only(user.id)).paidThrough!.getTime()).toBeGreaterThan(Date.now() + 79 * DAY);
  });
});

describe("hostile payload shapes", () => {
  it("never let a value from a payload become a database operator", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const good = events.subscriptionCreated(spec(user.email), new Date(), "evt_good");
    const hostile = (mutate: (e: FsEvent) => void, id: string) => {
      const e = JSON.parse(JSON.stringify(good)) as FsEvent;
      (e as { id: string }).id = id;
      mutate(e);
      return e;
    };
    const attacks = [
      hostile((e) => ((e.objects as { license: { id: unknown } }).license.id = { $ne: null }), "evt_a1"),
      hostile((e) => ((e.objects as { user: { email: unknown } }).user.email = { $gt: "" }), "evt_a2"),
      hostile((e) => ((e.objects as { license: { id: unknown } }).license.id = ["5001"]), "evt_a3"),
      hostile((e) => ((e.objects as { subscription: { id: unknown } }).subscription.id = { $exists: true }), "evt_a4"),
      hostile((e) => ((e.data as { license_id: unknown }).license_id = { $ne: "" }), "evt_a5"),
    ];
    for (const e of attacks) await deliver(e).catch(() => "failed"); // each is refused or ignored: never matched against other people's rows
    const other = await makeUser({ emailVerifiedAt: new Date() });
    await deliver(events.subscriptionCreated(spec(other.email, { licenseId: 5002, subscriptionId: 6002 })));
    const all = await (await collections()).subscriptions.find({}).toArray();
    expect(all.filter((r) => r.userId === user.id)).toHaveLength(0); // the attacks granted the first user nothing
    // A payload with a valid license but a hostile email may leave an unlinked row, which grants nobody anything; it never links to an account.
    expect(all.filter((r) => r.freemiusLicenseId !== "5002").every((r) => r.userId === null)).toBe(true);
    expect(all.find((r) => r.freemiusLicenseId === "5002")).toMatchObject({ userId: other.id, status: "active" }); // and the real purchase is untouched
    expect(await deliver(events.licenseDeleted({ $ne: "" } as never))).toBe("ignored");
    expect(await accessUntilForUser(other.id)).not.toBeNull();
  });
});

describe("what is ignored, not an error", () => {
  it("other products and plans, and test purchases in production", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    expect(await deliver(events.subscriptionCreated(spec(user.email, { productId: 4242 })))).toBe("ignored");
    expect(await deliver(events.subscriptionCreated(spec(user.email, { planId: IDS.other })))).toBe("ignored");
    expect(await subscriptionsForUser(user.id)).toHaveLength(0);

    process.env.FREEMIUS_MODE = "production";
    expect(await deliver(events.subscriptionCreated(spec(user.email, { sandbox: true })))).toBe("ignored");
    expect(await subscriptionsForUser(user.id)).toHaveLength(0);
    expect(await accessUntilForUser(user.id)).toBeNull();
    expect(await deliver(events.subscriptionCreated(spec(user.email, { sandbox: false, licenseId: 5002 })))).toBe("processed"); // a real one is fine
    expect((await ledger()).filter((l) => l.status === "ignored").map((l) => l.note).sort()).toEqual(["another plan", "another product", "sandbox purchase in production"]);
  });

  it("a live purchase while in sandbox mode, and a deletion of a license we never had", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    expect(await deliver(events.subscriptionCreated(spec(user.email, { sandbox: false })))).toBe("ignored");
    expect(await deliver(events.licenseDeleted(31337))).toBe("ignored");
  });
});

describe("checking with Freemius when the customer asks", () => {
  it("the buyer's return from checkout is confirmed by asking Freemius, not by trusting the browser", async () => {
    const user = await makeUser({ email: "returning@example.com" });
    await beginCheckout({ userId: user.id, email: user.email, interval: "monthly", environment: "sandbox" });
    const s = spec(user.email);
    fake.put(s);
    fake.pay(s, 9001, 9);
    // No webhook ever arrived. The server asks Freemius about this account's email.
    const rows = await syncUser(user);
    expect(rows).toHaveLength(1);
    expect(await only(user.id)).toMatchObject({ status: "active", userId: user.id });
    expect(await payments()).toHaveLength(1);
  });

  it("someone with nothing bought gets nothing, whatever they claim", async () => {
    const user = await makeUser({ email: "empty@example.com" });
    expect(await syncUser(user)).toEqual([]);
    expect(await accessUntilForUser(user.id)).toBeNull();
  });

  it("records each payment once however often it runs, and ignores refunds and other licenses' payments", async () => {
    const user = await makeUser({ emailVerifiedAt: new Date() });
    const s = spec(user.email);
    await deliver(events.subscriptionCreated(s));
    const row = await only(user.id);
    fake.pay(s, 9001, 9);
    fake.pay(s, 9002, 9, { renewal: true });
    fake.pay(s, 9003, 9, { type: "refund" }); // this app has no refund handling: never recorded as revenue
    fake.pay({ ...s, licenseId: 7777 }, 9004, 49);
    expect(await syncPaymentsFor(row)).toBe(2);
    expect(await syncPaymentsFor(row)).toBe(0);
    expect((await payments()).map((p) => p.providerRef).sort()).toEqual(["freemius:payment:9001", "freemius:payment:9002"]);
  });
});
