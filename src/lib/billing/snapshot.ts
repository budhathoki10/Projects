import { idToString, parseBillingCycle, parseDateTime, BILLING_CYCLE, type LicenseEntity, type SubscriptionEntity } from "@freemius/sdk";
import type { BillingInterval } from "@/db/types";
import type { PlanConfig } from "./config";

/**
 * What one verified piece of Freemius data says about a purchase, in this app's own terms. Built either
 * from a signature-checked webhook payload or from a direct API response; the rest of the code can't tell which.
 */
export type ProviderSnapshot = {
  licenseId: string;
  productId: string | null;
  planId: string | null;
  pricingId: string | null;
  environment: "sandbox" | "production";
  buyerEmail: string | null;
  freemiusUserId: string | null;
  license: {
    paidThrough: Date | null;
    /** The seller cancelled the license (Freemius `is_cancelled`). Different from a customer cancelling their subscription. */
    isCancelled: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
  } | null;
  subscription: {
    id: string;
    interval: BillingInterval | null;
    amountMinor: number | null;
    currency: string | null;
    failedPayments: number;
    nextPaymentAt: Date | null;
    canceledAt: Date | null;
    updatedAt: Date | null;
  } | null;
  /** Facts an event states about itself, applied only if no newer data has already been recorded. */
  signals: {
    at: Date | null;
    renewalFailed?: boolean;
    renewalFailedLast?: boolean;
    cancellationConfirmed?: boolean;
  };
};

/** Ids are only ever strings or numbers. Anything else (an object, an array) is refused here, before it can near a database query. */
const id = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : typeof v === "number" || typeof v === "bigint" ? idToString(v) : null);
const minor = (major: unknown): number | null => (typeof major === "number" && Number.isFinite(major) ? Math.round(major * 100) : null);

/** Freemius marks every entity: 0 is production, 1 is sandbox. */
export const environmentOf = (e: { environment?: 0 | 1 } | null | undefined): "sandbox" | "production" => (e?.environment === 1 ? "sandbox" : "production");

/**
 * Monthly or yearly. The subscription's own billing cycle is the authority. Freemius lets one pricing record carry
 * both a monthly and a yearly price, so the pricing id only decides when the two intervals use different records.
 */
export function intervalOf(pricingId: string | null, billingCycle: BILLING_CYCLE | null, plan: PlanConfig): BillingInterval | null {
  if (billingCycle === BILLING_CYCLE.MONTHLY) return "monthly";
  if (billingCycle === BILLING_CYCLE.YEARLY) return "yearly";
  if (plan.pricingIds.monthly === plan.pricingIds.yearly) return null;
  if (pricingId === plan.pricingIds.monthly) return "monthly";
  if (pricingId === plan.pricingIds.yearly) return "yearly";
  return null;
}

export function subscriptionPart(sub: SubscriptionEntity | null | undefined, pricingId: string | null, plan: PlanConfig): ProviderSnapshot["subscription"] {
  if (!sub || !id(sub.id)) return null;
  const cycle = sub.billing_cycle === undefined ? null : parseBillingCycle(sub.billing_cycle);
  return {
    id: id(sub.id) ?? "",
    interval: intervalOf(pricingId ?? id(sub.pricing_id), cycle, plan),
    amountMinor: minor(sub.renewal_amount ?? sub.amount_per_cycle ?? sub.total_gross),
    currency: sub.currency ? String(sub.currency).toUpperCase() : null,
    failedPayments: typeof sub.failed_payments === "number" ? sub.failed_payments : 0,
    nextPaymentAt: parseDateTime(sub.next_payment),
    canceledAt: parseDateTime(sub.canceled_at),
    updatedAt: parseDateTime(sub.updated),
  };
}

export function licensePart(license: LicenseEntity): NonNullable<ProviderSnapshot["license"]> {
  return {
    paidThrough: parseDateTime(license.expiration),
    isCancelled: license.is_cancelled === true,
    createdAt: parseDateTime(license.created),
    updatedAt: parseDateTime(license.updated),
  };
}

/** Pull the facts out of a license (and, when there is one, its subscription and buyer). */
export function snapshotOf(input: {
  license: LicenseEntity;
  subscription?: SubscriptionEntity | null;
  buyer?: { id?: unknown; email?: string | null } | null;
  signals?: Partial<ProviderSnapshot["signals"]>;
  plan: PlanConfig;
}): ProviderSnapshot {
  const { license, plan } = input;
  const pricingId = id(license.pricing_id);
  const licenseId = id(license.id);
  if (!licenseId) throw new Error("license without a usable id");
  return {
    licenseId,
    productId: id(license.plugin_id),
    planId: id(license.plan_id),
    pricingId,
    environment: environmentOf(license),
    buyerEmail: typeof input.buyer?.email === "string" && input.buyer.email.trim() ? input.buyer.email.trim().toLowerCase().slice(0, 254) : null,
    freemiusUserId: id(input.buyer?.id) ?? id(license.user_id),
    license: licensePart(license),
    subscription: subscriptionPart(input.subscription, pricingId, plan),
    signals: { at: null, ...input.signals },
  };
}
