import "server-only";
import { randomUUID } from "node:crypto";
import { collections, fromDoc, isDuplicateKey } from "@/db/mongo";
import type { BillingInterval, Subscription } from "@/db/types";
import { accessUntil, deriveStatus, effectiveStatus, subscriptionAccessUntil } from "@/lib/billing/access";
import { billingPolicy, type BillingPolicy } from "@/lib/billing/config";
import type { ProviderSnapshot } from "@/lib/billing/snapshot";

/** How long an opened-but-unfinished checkout holds the "one at a time" slot. */
export const CHECKOUT_TTL_MS = 30 * 60_000;

const asSub = (doc: Parameters<typeof fromDoc<Subscription>>[0]) => fromDoc<Subscription>(doc);
const later = (a: Date | null, b: Date | null): Date | null => (a && b ? (a > b ? a : b) : (a ?? b));

/* ---------- Reading ---------- */

export async function subscriptionsForUser(userId: string): Promise<Subscription[]> {
  const docs = await (await collections()).subscriptions.find({ userId: String(userId) }).sort({ createdAt: -1 }).toArray();
  return docs.map(asSub);
}

export async function subscriptionByLicense(licenseId: string): Promise<Subscription | null> {
  const doc = await (await collections()).subscriptions.findOne({ freemiusLicenseId: String(licenseId) });
  return doc ? asSub(doc) : null;
}

/**
 * When this user's subscriptions stop granting paid access, computed from stored, provider-confirmed data and the
 * policy, as of now. This is the only way subscription data turns into access, and it never looks at anything the browser sent.
 */
export async function accessUntilForUser(userId: string, now = new Date(), policy: BillingPolicy = safePolicy()): Promise<Date | null> {
  return subscriptionAccessUntil(await subscriptionsForUser(userId), now, policy);
}

/**
 * The configured policy, or the strictest one if a BILLING_* variable is malformed. A typo in a grace-period setting
 * must not take every page of the app down (and must not quietly hand out extra time); it logs and denies the extras.
 */
export function safePolicy(): BillingPolicy {
  try {
    return billingPolicy();
  } catch (err) {
    console.error(JSON.stringify({ level: "error", scope: "billing", event: "policy_invalid", message: err instanceof Error ? err.message.slice(0, 200) : "invalid" }));
    return { graceDays: 0, suspendedAccess: "none" };
  }
}

/** A subscription that should stop this user from buying another: live (or failing) ones, and a checkout still in progress. */
export async function blockingSubscription(userId: string, now = new Date(), policy: BillingPolicy = billingPolicy()): Promise<Subscription | null> {
  for (const row of await subscriptionsForUser(userId)) {
    const status = effectiveStatus(row, now, policy);
    if (status === "active" || status === "past_due" || status === "suspended") return row;
    if (status === "pending" && !row.freemiusLicenseId && now.getTime() - row.createdAt.getTime() < CHECKOUT_TTL_MS) return row;
  }
  return null;
}

/* ---------- Checkout rows ---------- */

const blank = (over: Partial<Subscription>): Subscription => ({
  id: randomUUID(),
  userId: null,
  buyerEmail: null,
  status: "pending",
  interval: null,
  freemiusLicenseId: null,
  freemiusSubscriptionId: null,
  freemiusUserId: null,
  freemiusProductId: null,
  freemiusPlanId: null,
  freemiusPricingId: null,
  environment: "production",
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
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const store = ({ id, ...rest }: Subscription) => ({ _id: id, ...rest });

/**
 * Record that this user opened checkout. The row is "pending" and grants nothing: it only lets the purchase that
 * follows be tied back to the right account. At most one per user (a unique index), and a stale one is replaced.
 */
export async function beginCheckout(input: { userId: string; email: string; interval: BillingInterval; environment: "sandbox" | "production" }, now = new Date()): Promise<Subscription> {
  const { subscriptions } = await collections();
  await subscriptions.deleteMany({ userId: input.userId, status: "pending", freemiusLicenseId: null, createdAt: { $lt: new Date(now.getTime() - CHECKOUT_TTL_MS) } });
  try {
    // Fields the filter already pins (user, status, no license) come from it on insert; the rest are set only when the row is new.
    const doc = await subscriptions.findOneAndUpdate(
      { userId: input.userId, status: "pending", freemiusLicenseId: null },
      {
        $set: { interval: input.interval, environment: input.environment, updatedAt: now },
        $setOnInsert: { _id: randomUUID(), buyerEmail: input.email.trim().toLowerCase(), freemiusSubscriptionId: null, freemiusUserId: null, freemiusProductId: null, freemiusPlanId: null, freemiusPricingId: null, currency: null, amountMinor: null, startedAt: null, currentPeriodStart: null, paidThrough: null, nextPaymentAt: null, failedPayments: 0, suspended: false, cancelRequestedAt: null, cancelledAt: null, licenseUpdatedAt: null, subscriptionUpdatedAt: null, version: 0, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    return asSub(doc!);
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const existing = await subscriptions.findOne({ userId: input.userId, status: "pending", freemiusLicenseId: null });
    if (!existing) throw err;
    return asSub(existing);
  }
}

/** The person closed checkout without paying. Only an unfinished, license-less row of theirs can be dropped. */
export async function abandonCheckout(userId: string) {
  await (await collections()).subscriptions.deleteMany({ userId: String(userId), status: "pending", freemiusLicenseId: null });
}

/* ---------- Applying verified provider data ---------- */

/**
 * Fold one verified snapshot into a row. Pure, so every ordering and recovery rule is testable without a database.
 *
 *  - Data older than what's already recorded is ignored (a delayed event can't undo a newer one), but equal is
 *    applied again harmlessly: applying the same snapshot twice gives the same row.
 *  - A later expiration than before means a renewal (or a recovered payment) went through: failures clear.
 *  - Event signals ("renewal failed", "last attempt failed") only count if nothing newer has been recorded.
 */
export function mergeSnapshot(row: Subscription, snap: ProviderSnapshot, now: Date, policy: BillingPolicy): Subscription {
  const next: Subscription = { ...row };
  const notOlder = (incoming: Date | null, stored: Date | null) => !incoming || !stored || incoming >= stored;

  next.freemiusLicenseId = snap.licenseId;
  next.freemiusProductId = snap.productId ?? next.freemiusProductId;
  next.freemiusPlanId = snap.planId ?? next.freemiusPlanId;
  next.freemiusPricingId = snap.pricingId ?? next.freemiusPricingId;
  next.environment = snap.environment;
  next.buyerEmail = next.buyerEmail ?? snap.buyerEmail;
  next.freemiusUserId = snap.freemiusUserId ?? next.freemiusUserId;

  if (snap.license && notOlder(snap.license.updatedAt, row.licenseUpdatedAt)) {
    const L = snap.license;
    if (L.paidThrough) {
      if (row.paidThrough && L.paidThrough > row.paidThrough) {
        next.currentPeriodStart = row.paidThrough;
        next.failedPayments = 0;
        next.suspended = false;
      }
      next.paidThrough = L.paidThrough;
    }
    next.startedAt = next.startedAt ?? L.createdAt ?? now;
    next.currentPeriodStart = next.currentPeriodStart ?? next.startedAt;
    if (L.isCancelled) next.suspended = true;
    next.licenseUpdatedAt = later(row.licenseUpdatedAt, L.updatedAt);
  }

  if (snap.subscription && notOlder(snap.subscription.updatedAt, row.subscriptionUpdatedAt)) {
    const S = snap.subscription;
    next.freemiusSubscriptionId = S.id;
    next.interval = S.interval ?? next.interval;
    next.amountMinor = S.amountMinor ?? next.amountMinor;
    next.currency = S.currency ?? next.currency;
    next.nextPaymentAt = S.nextPaymentAt;
    // How many payments have failed is only trusted if this subscription data is at least as new as the license state already
    // recorded: a renewal (or recovery) that was applied after this was written means those failures were already resolved.
    if (notOlder(S.updatedAt, row.licenseUpdatedAt)) next.failedPayments = S.failedPayments;
    if (S.canceledAt) {
      next.cancelledAt = next.cancelledAt ?? S.canceledAt;
      next.cancelRequestedAt = next.cancelRequestedAt ?? S.canceledAt;
    }
    next.subscriptionUpdatedAt = later(row.subscriptionUpdatedAt, S.updatedAt);
  }

  // Signals are judged against what was recorded BEFORE this snapshot, so an event can't be ruled stale by its own data.
  const recorded = later(row.licenseUpdatedAt, row.subscriptionUpdatedAt);
  const at = snap.signals.at;
  const current = !at || !recorded || at >= recorded;
  if (current) {
    if (snap.signals.renewalFailed || snap.signals.renewalFailedLast) next.failedPayments = Math.max(next.failedPayments, 1);
    if (snap.signals.renewalFailedLast) next.suspended = true;
    if (snap.signals.cancellationConfirmed) {
      next.cancelledAt = next.cancelledAt ?? at ?? now;
      next.cancelRequestedAt = next.cancelRequestedAt ?? next.cancelledAt;
    }
  }

  next.status = deriveStatus(next, now, policy);
  return next;
}

const WRITTEN = (r: Subscription) => JSON.stringify({ ...r, version: 0, updatedAt: 0 });

/** Find the row for this license, creating (or adopting a waiting checkout row) if it's the first we've heard of it. */
async function rowForLicense(snap: ProviderSnapshot, now: Date): Promise<Subscription> {
  const { subscriptions, users } = await collections();
  const existing = await subscriptions.findOne({ freemiusLicenseId: snap.licenseId });
  if (existing) return asSub(existing);

  try {
    // A checkout this person opened while signed in: the buyer's email was locked to theirs, so this is that purchase.
    if (snap.buyerEmail) {
      const adopted = await subscriptions.findOneAndUpdate(
        { buyerEmail: snap.buyerEmail, status: "pending", freemiusLicenseId: null, userId: { $type: "string" } },
        { $set: { freemiusLicenseId: snap.licenseId, updatedAt: now } },
        { sort: { createdAt: -1 }, returnDocument: "after" },
      );
      if (adopted) return asSub(adopted);
    }
    // Otherwise only a confirmed address may claim a purchase by email; anyone else stays unlinked until they confirm.
    const owner = snap.buyerEmail ? await users.findOne({ email: snap.buyerEmail, emailVerifiedAt: { $ne: null } }, { projection: { _id: 1 } }) : null;
    const row = blank({ userId: owner?._id ?? null, buyerEmail: snap.buyerEmail, freemiusLicenseId: snap.licenseId, environment: snap.environment, createdAt: now, updatedAt: now });
    await subscriptions.insertOne(store(row));
    return row;
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    // Another delivery created it first: use theirs.
    const winner = await subscriptions.findOne({ freemiusLicenseId: snap.licenseId });
    if (!winner) throw err;
    return asSub(winner);
  }
}

/**
 * Apply one verified snapshot. Safe to call twice, from two requests at once, or out of order: the row is found
 * (or created) by its unique license id, and each write only lands if nobody else has written since it was read.
 */
export async function applySnapshot(snap: ProviderSnapshot, now = new Date(), policy: BillingPolicy = billingPolicy()): Promise<Subscription> {
  const { subscriptions } = await collections();
  let row = await rowForLicense(snap, now);
  for (let attempt = 0; attempt < 8; attempt++) {
    const next = mergeSnapshot(row, snap, now, policy);
    if (WRITTEN(next) === WRITTEN(row) && row.version > 0) return row;
    const { id, ...fields } = next;
    const result = await subscriptions.updateOne({ _id: id, version: row.version }, { $set: { ...fields, version: row.version + 1, updatedAt: now } });
    if (result.matchedCount === 1) return { ...next, version: row.version + 1, updatedAt: now };
    const fresh = await subscriptions.findOne({ _id: id });
    if (!fresh) throw new Error("subscription disappeared while updating");
    row = asSub(fresh);
  }
  throw new Error("subscription update kept colliding with other writers");
}

/* ---------- Cancellation requests ---------- */

/** Note that we asked Freemius to cancel. This is a request, not the cancellation: status changes when Freemius confirms. */
export async function markCancelRequested(subscriptionRowId: string, now = new Date()) {
  await (await collections()).subscriptions.updateOne({ _id: String(subscriptionRowId), cancelRequestedAt: null }, { $set: { cancelRequestedAt: now, updatedAt: now }, $inc: { version: 1 } });
}

/* ---------- Linking ---------- */

/** Attach purchases made with this account's email to it, once the email is confirmed. */
export async function claimByEmail(user: { id: string; email: string; emailVerifiedAt: Date | null }): Promise<number> {
  if (!user.emailVerifiedAt) return 0;
  const result = await (await collections()).subscriptions.updateMany({ buyerEmail: user.email.toLowerCase(), userId: null }, { $set: { userId: user.id, updatedAt: new Date() }, $inc: { version: 1 } });
  return result.modifiedCount;
}

export { accessUntil };
