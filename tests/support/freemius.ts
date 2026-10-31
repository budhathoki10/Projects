import { createHmac } from "node:crypto";
import type { BillingGateway } from "@/lib/billing/freemius";

/**
 * Test doubles for Freemius. The event shapes follow the SDK's own types (@freemius/sdk WebhookEventDataMap):
 * an envelope of { id, type, created, updated, state, objects, data }, where `objects` carries the license,
 * the subscription and the buyer. Dates use Freemius's "YYYY-MM-DD HH:MM:SS" (UTC) format.
 */

export const IDS = { product: 12345, plan: "777", monthly: "881", yearly: "882", other: "999" } as const;
/** The SDK requires at least 32 characters. */
export const SECRET = "test-freemius-secret-key-0123456789abcdef";

/** The environment these helpers (and the tests' app config) agree on. */
export const FREEMIUS_TEST_ENV = {
  FREEMIUS_MODE: "sandbox",
  FREEMIUS_PRODUCT_ID: String(IDS.product),
  FREEMIUS_API_KEY: "test-api-key",
  FREEMIUS_SECRET_KEY: SECRET,
  FREEMIUS_PUBLIC_KEY: "test-public-key",
  FREEMIUS_PLAN_ID: IDS.plan,
  FREEMIUS_PRICING_ID_MONTHLY: IDS.monthly,
  FREEMIUS_PRICING_ID_YEARLY: IDS.yearly,
  BILLING_GRACE_DAYS: "3",
  BILLING_SUSPENDED_ACCESS: "none",
} as const;

export const fsDate = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
export const DAY = 86_400_000;

export type LicenseSpec = {
  licenseId?: number;
  freemiusUserId?: number;
  email?: string;
  pricingId?: string;
  planId?: string;
  productId?: number;
  expiration: Date;
  cancelled?: boolean;
  sandbox?: boolean;
  updated?: Date;
  created?: Date;
  subscriptionId?: number;
  failedPayments?: number;
  canceledAt?: Date | null;
  nextPayment?: Date | null;
  amount?: number;
};

const license = (s: LicenseSpec) => ({
  id: s.licenseId ?? 5001,
  plugin_id: s.productId ?? IDS.product,
  user_id: s.freemiusUserId ?? 3001,
  plan_id: Number(s.planId ?? IDS.plan),
  pricing_id: Number(s.pricingId ?? IDS.monthly),
  expiration: fsDate(s.expiration),
  is_cancelled: s.cancelled ?? false,
  is_free_localhost: true,
  is_block_features: true,
  environment: s.sandbox === false ? 0 : 1,
  created: fsDate(s.created ?? new Date(Date.now() - 2 * DAY)),
  updated: fsDate(s.updated ?? new Date()),
});

const subscription = (s: LicenseSpec) => ({
  id: s.subscriptionId ?? 6001,
  license_id: s.licenseId ?? 5001,
  user_id: s.freemiusUserId ?? 3001,
  plan_id: Number(s.planId ?? IDS.plan),
  pricing_id: Number(s.pricingId ?? IDS.monthly),
  billing_cycle: (s.pricingId ?? IDS.monthly) === IDS.yearly ? 12 : 1,
  currency: "usd",
  renewal_amount: s.amount ?? 9,
  failed_payments: s.failedPayments ?? 0,
  next_payment: s.nextPayment === null ? null : fsDate(s.nextPayment ?? new Date(s.expiration.getTime())),
  canceled_at: s.canceledAt ? fsDate(s.canceledAt) : null,
  environment: s.sandbox === false ? 0 : 1,
  created: fsDate(s.created ?? new Date(Date.now() - 2 * DAY)),
  updated: fsDate(s.updated ?? new Date()),
});

const buyer = (s: LicenseSpec) => ({ id: s.freemiusUserId ?? 3001, email: s.email ?? "buyer@example.com", first: "Asha", last: "Gurung", is_verified: true });

let counter = 0;
const envelope = (type: string, at: Date, objects: Record<string, unknown>, data: Record<string, unknown>, id?: string) => ({
  id: id ?? `evt_${Date.now()}_${++counter}`,
  type,
  created: fsDate(at),
  updated: null,
  state: "pending",
  objects,
  data,
});

export type FsEvent = ReturnType<typeof envelope>;

/** Build one event. `at` is when it happened (the envelope's `created`); `id` fixes the event id for redelivery tests. */
export const events = {
  licenseCreated: (s: LicenseSpec, at = new Date(), id?: string) => envelope("license.created", at, { license: license(s), user: buyer(s) }, { license_id: String(s.licenseId ?? 5001) }, id),
  subscriptionCreated: (s: LicenseSpec, at = new Date(), id?: string) =>
    envelope("subscription.created", at, { user: buyer(s), subscription: subscription(s), license: license(s) }, { subscription_id: String(s.subscriptionId ?? 6001), license_id: String(s.licenseId ?? 5001) }, id),
  licenseExtended: (s: LicenseSpec, at = new Date(), id?: string) => envelope("license.extended", at, { license: license(s), user: buyer(s) }, { license_id: String(s.licenseId ?? 5001) }, id),
  licenseExpired: (s: LicenseSpec, at = new Date(), id?: string) => envelope("license.expired", at, { license: license(s) }, { license_id: String(s.licenseId ?? 5001) }, id),
  licenseCancelled: (s: LicenseSpec, at = new Date(), id?: string) => envelope("license.cancelled", at, { license: license({ ...s, cancelled: true }) }, { license_id: String(s.licenseId ?? 5001) }, id),
  licenseUpdated: (s: LicenseSpec, at = new Date(), id?: string) => envelope("license.updated", at, { license: license(s) }, { license_id: String(s.licenseId ?? 5001) }, id),
  licenseDeleted: (licenseId = 5001, at = new Date(), id?: string) => envelope("license.deleted", at, { license: false }, { license_id: String(licenseId) }, id),
  subscriptionCancelled: (s: LicenseSpec, at = new Date(), id?: string) =>
    envelope("subscription.cancelled", at, { user: buyer(s), subscription: subscription({ ...s, canceledAt: at }), license: license(s) }, { subscription_id: String(s.subscriptionId ?? 6001), license_id: String(s.licenseId ?? 5001), reason_ids: [], reason: "" }, id),
  renewalFailed: (s: LicenseSpec, at = new Date(), id?: string) => envelope("subscription.renewal.failed", at, { user: buyer(s), subscription: subscription({ ...s, failedPayments: s.failedPayments ?? 1 }), license: license(s) }, {}, id),
  renewalFailedLast: (s: LicenseSpec, at = new Date(), id?: string) => envelope("subscription.renewal.failed.last", at, { user: buyer(s), subscription: subscription({ ...s, failedPayments: s.failedPayments ?? 3 }), license: license(s) }, {}, id),
};

/** The signature Freemius sends: hex HMAC-SHA256 of the raw body with the product's secret key. */
export const sign = (rawBody: string, secret = SECRET) => createHmac("sha256", secret).update(rawBody).digest("hex");

/** An in-memory Freemius API, so the lifecycle (including payment bookkeeping and the on-request check) runs without a network. */
export class FakeFreemius implements BillingGateway {
  licenses = new Map<string, Record<string, unknown>>();
  subscriptions = new Map<string, Record<string, unknown>>();
  users = new Map<string, Record<string, unknown>>();
  payments: Record<string, unknown>[] = [];
  cancelled: string[] = [];
  failNext = false;

  put(s: LicenseSpec) {
    this.licenses.set(String(s.licenseId ?? 5001), license(s));
    this.subscriptions.set(String(s.licenseId ?? 5001), subscription(s));
    this.users.set(String(s.freemiusUserId ?? 3001), buyer(s));
  }
  pay(s: LicenseSpec, paymentId: number, gross: number, opts: { renewal?: boolean; type?: string } = {}) {
    this.payments.push({ id: paymentId, license_id: s.licenseId ?? 5001, user_id: s.freemiusUserId ?? 3001, subscription_id: s.subscriptionId ?? 6001, gross, currency: "usd", is_renewal: opts.renewal ?? false, type: opts.type ?? "payment", created: fsDate(new Date()) });
  }
  private maybeFail() {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Freemius is unavailable");
    }
  }
  async retrieveLicense(id: string) {
    this.maybeFail();
    return (this.licenses.get(id) ?? null) as never;
  }
  async retrieveSubscriptionByLicense(id: string) {
    return (this.subscriptions.get(id) ?? null) as never;
  }
  async retrieveUser(id: string) {
    return (this.users.get(id) ?? null) as never;
  }
  async listLicenseIdsByEmail(email: string) {
    return [...this.users.values()].filter((u) => u.email === email).flatMap((u) => [...this.licenses.values()].filter((l) => l.user_id === u.id).map((l) => String(l.id)));
  }
  async listPayments(freemiusUserId: string) {
    return this.payments.filter((p) => String(p.user_id) === freemiusUserId && p.type !== "refund") as never;
  }
  async cancelSubscription(id: string) {
    this.cancelled.push(id);
  }
}
