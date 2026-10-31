import type { BillingPolicy } from "./config";
import type { Subscription, SubscriptionStatus } from "@/db/types";

/**
 * What a subscription is worth, decided in one place and only from data this server stored after
 * Freemius confirmed it. Nothing here reads anything the browser sent.
 *
 *   pending     No verified payment yet (checkout opened, or a purchase not yet confirmed). No paid access.
 *   active      Paid through `paidThrough`. Access until then.
 *   past_due    A renewal failed. Access continues for the grace period after `paidThrough`, giving the
 *               payment-recovery process time to work. A recovered payment moves `paidThrough` forward and
 *               the row returns to active.
 *   cancelled   Freemius confirmed the cancellation. Renewals stop, but what was paid for is still honoured:
 *               access until `paidThrough`. A cancellation REQUEST is not this state (see cancelRequestedAt).
 *   expired     `paidThrough` has passed (plus grace when past due). No paid access.
 *   suspended   Withheld by the provider: the last renewal attempt failed, or the seller cancelled the license.
 *               Access follows BILLING_SUSPENDED_ACCESS: none (default) or the grace period.
 */
export type AccessFields = Pick<Subscription, "status" | "paidThrough" | "suspended" | "failedPayments" | "cancelledAt" | "freemiusLicenseId">;

const DAY = 86_400_000;
const plusDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

/** The status a row should carry, from the facts we hold. Run on every write. */
export function deriveStatus(row: AccessFields, now = new Date(), policy: BillingPolicy): SubscriptionStatus {
  if (!row.freemiusLicenseId || !row.paidThrough) return "pending";
  if (row.suspended) return plusDays(row.paidThrough, policy.graceDays) > now ? "suspended" : "expired";
  if (row.cancelledAt) return row.paidThrough > now ? "cancelled" : "expired";
  if (row.failedPayments > 0) return plusDays(row.paidThrough, policy.graceDays) > now ? "past_due" : "expired";
  return row.paidThrough > now ? "active" : "expired";
}

/**
 * The status as of `now`. Stored statuses go stale the moment a date passes without a webhook, so access is
 * always judged from this, not from the stored value: a missed "expired" event can never leave someone paid-up forever.
 */
export function effectiveStatus(row: AccessFields, now = new Date(), policy: BillingPolicy): SubscriptionStatus {
  if (row.status === "pending" || !row.paidThrough) return "pending";
  switch (row.status) {
    case "active":
    case "cancelled":
      return row.paidThrough > now ? row.status : "expired";
    case "past_due":
      return plusDays(row.paidThrough, policy.graceDays) > now ? "past_due" : "expired";
    case "suspended":
      return plusDays(row.paidThrough, policy.graceDays) > now ? "suspended" : "expired";
    default:
      return row.status;
  }
}

/** The moment paid access ends for this row, or null if it grants none. Compare against `now` before using it. */
export function accessUntil(row: AccessFields, now = new Date(), policy: BillingPolicy): Date | null {
  const status = effectiveStatus(row, now, policy);
  if (!row.paidThrough) return null;
  switch (status) {
    case "active":
    case "cancelled":
      return row.paidThrough;
    case "past_due":
      return plusDays(row.paidThrough, policy.graceDays);
    case "suspended":
      return policy.suspendedAccess === "grace" ? plusDays(row.paidThrough, policy.graceDays) : null;
    default:
      return null;
  }
}

/** The latest moment any of a user's subscriptions still grants access, or null. */
export function subscriptionAccessUntil(rows: AccessFields[], now = new Date(), policy: BillingPolicy): Date | null {
  let best: Date | null = null;
  for (const row of rows) {
    const until = accessUntil(row, now, policy);
    if (until && until > now && (!best || until > best)) best = until;
  }
  return best;
}
