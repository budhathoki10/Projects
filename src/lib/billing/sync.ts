import "server-only";
import { idToString, parseDateTime, type LicenseEntity } from "@freemius/sdk";
import type { Subscription, User } from "@/db/types";
import { recordPayment } from "@/lib/services/billing";
import { applySnapshot } from "@/lib/services/subscriptions";
import { billingMode, freemiusConfig, planConfig } from "./config";
import { billingGateway } from "./freemius";
import { logBilling } from "./log";
import { snapshotOf } from "./snapshot";

/**
 * Is this license one of ours: our product, our paid plan, and the right environment? Anything else is ignored,
 * never an error. In production a sandbox purchase is refused, so test data can't unlock paid access.
 */
export function scopeOf(license: Pick<LicenseEntity, "plugin_id" | "plan_id" | "environment">): { ok: true } | { ok: false; reason: string } {
  const cfg = freemiusConfig();
  const plan = planConfig();
  if (license.plugin_id === undefined || Number(license.plugin_id) !== cfg.productId) return { ok: false, reason: "another product" };
  if (license.plan_id === undefined || idToString(license.plan_id as string | number) !== plan.planId) return { ok: false, reason: "another plan" };
  const sandbox = license.environment === 1;
  if (sandbox && billingMode() === "production") return { ok: false, reason: "sandbox purchase in production" };
  if (!sandbox && billingMode() === "sandbox") return { ok: false, reason: "live purchase in sandbox mode" };
  return { ok: true };
}

/**
 * Record the completed payments Freemius holds for this subscription's license. Each is keyed by Freemius's payment id,
 * so running this any number of times, from any number of places, records each payment once. Refund records are not
 * payments here and are skipped (this app has no refund handling).
 */
export async function syncPaymentsFor(row: Subscription): Promise<number> {
  if (!row.userId || !row.freemiusUserId || !row.freemiusLicenseId) return 0;
  let added = 0;
  for (const p of await billingGateway().listPayments(row.freemiusUserId)) {
    if (p.id === undefined || p.license_id === undefined || idToString(p.license_id as string | number) !== row.freemiusLicenseId) continue;
    if (p.type !== undefined && p.type !== "payment") continue;
    if (typeof p.gross !== "number" || !(p.gross > 0)) continue;
    const isNew = await recordPayment({
      userId: row.userId,
      provider: "freemius",
      ref: `freemius:payment:${idToString(p.id as string | number)}`,
      status: "completed",
      amountMinor: Math.round(p.gross * 100),
      currency: String(p.currency ?? row.currency ?? "usd").toUpperCase(),
      subscriptionId: row.id,
      kind: p.is_renewal ? "renewal" : "initial",
      createdAt: parseDateTime(p.created) ?? new Date(),
    });
    if (isNew) added++;
  }
  return added;
}

/** Payments are bookkeeping, not entitlement: a Freemius outage must never block or fail the entitlement update itself. */
async function syncPaymentsQuietly(row: Subscription) {
  try {
    await syncPaymentsFor(row);
  } catch (err) {
    logBilling("warn", "payments_sync_failed", { licenseId: row.freemiusLicenseId }, err);
  }
}

export { syncPaymentsQuietly };

/**
 * Pull one license's truth straight from Freemius (license, subscription, buyer) and apply it. This is how a
 * missed or delayed webhook is made good, and how the buyer's return from checkout is confirmed without trusting the browser.
 */
export async function syncLicense(licenseId: string, now = new Date()): Promise<Subscription | null> {
  const gateway = billingGateway();
  const license = await gateway.retrieveLicense(licenseId);
  if (!license) return null;
  const scope = scopeOf(license);
  if (!scope.ok) return null;
  const [subscription, buyer] = await Promise.all([gateway.retrieveSubscriptionByLicense(licenseId), license.user_id !== undefined && license.user_id !== null ? gateway.retrieveUser(String(license.user_id)) : Promise.resolve(null)]);
  const row = await applySnapshot(snapshotOf({ license, subscription, buyer, plan: planConfig() }), now);
  await syncPaymentsQuietly(row);
  return row;
}

/**
 * Check this signed-in user's purchases with Freemius (by their account email) and apply what it says.
 * The browser can ask for this to happen but supplies no data to it: everything applied comes from Freemius's API.
 */
export async function syncUser(user: Pick<User, "id" | "email">, now = new Date()): Promise<Subscription[]> {
  const found: Subscription[] = [];
  for (const licenseId of await billingGateway().listLicenseIdsByEmail(user.email)) {
    const row = await syncLicense(licenseId, now);
    if (row && row.userId === user.id) found.push(row);
  }
  return found;
}
