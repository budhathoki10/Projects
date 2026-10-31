import "server-only";
import { Freemius, type LicenseEntity, type PaymentEntity, type SubscriptionEntity, type UserEntity } from "@freemius/sdk";
import { freemiusConfig } from "./config";

let client: Freemius | null = null;

/**
 * The one Freemius client. It holds the API key and secret key, so it must only ever be created and used
 * on the server. Throws BillingConfigError (naming the missing variables) if the credentials aren't set.
 */
export function getFreemius(): Freemius {
  client ??= new Freemius(freemiusConfig());
  return client;
}

/**
 * Everything this app asks of Freemius's API, in one small interface. The real implementation below is a
 * direct call to each documented SDK method; tests swap in an in-memory one so the whole billing lifecycle
 * can be exercised without network access. Nothing here is a Freemius feature the SDK doesn't have.
 */
export interface BillingGateway {
  retrieveLicense(licenseId: string): Promise<LicenseEntity | null>;
  retrieveSubscriptionByLicense(licenseId: string): Promise<SubscriptionEntity | null>;
  retrieveUser(userId: string): Promise<UserEntity | null>;
  /** License ids of every purchase made with this email, from Freemius's own records. */
  listLicenseIdsByEmail(email: string): Promise<string[]>;
  /** Payments made by one Freemius user (refund records excluded by the API's own filter). */
  listPayments(freemiusUserId: string): Promise<PaymentEntity[]>;
  /** Ask Freemius to cancel a subscription. Renewals stop; the license keeps running to its expiration. */
  cancelSubscription(subscriptionId: string): Promise<void>;
}

const realGateway: BillingGateway = {
  retrieveLicense: (id) => getFreemius().api.license.retrieve(id),
  retrieveSubscriptionByLicense: (id) => getFreemius().api.license.retrieveSubscription(id),
  retrieveUser: (id) => getFreemius().api.user.retrieve(id),
  async listLicenseIdsByEmail(email) {
    const purchases = await getFreemius().purchase.retrievePurchasesByEmail(email);
    return purchases.map((p) => p.licenseId);
  },
  async listPayments(freemiusUserId) {
    const out: PaymentEntity[] = [];
    for await (const payment of getFreemius().api.payment.iterateAll({ search_user_id: freemiusUserId, filter: "not_refunded" })) out.push(payment);
    return out;
  },
  async cancelSubscription(subscriptionId) {
    const result = await getFreemius().api.subscription.cancel(subscriptionId);
    if (!result) throw new Error("Freemius did not confirm the cancellation");
  },
};

/** For local runs and browser tests that have no Freemius API access: every lookup finds nothing, and cancelling is refused. */
const offlineGateway: BillingGateway = {
  retrieveLicense: async () => null,
  retrieveSubscriptionByLicense: async () => null,
  retrieveUser: async () => null,
  listLicenseIdsByEmail: async () => [],
  listPayments: async () => [],
  cancelSubscription: async () => {
    throw new Error("Freemius API access is switched off (FREEMIUS_SKIP_API_SYNC)");
  },
};

let override: BillingGateway | null = null;

/** Tests only: replace the gateway. Pass null to go back to the real one. */
export function setBillingGateway(gateway: BillingGateway | null) {
  override = gateway;
}

export function billingGateway(): BillingGateway {
  if (override) return override;
  return process.env.FREEMIUS_SKIP_API_SYNC === "1" ? offlineGateway : realGateway;
}
