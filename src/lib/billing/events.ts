import "server-only";
import { parseDateTime, type LicenseEntity, type UserPluginEntity, type WebhookEvent, type WebhookEventType } from "@freemius/sdk";
import type { Subscription } from "@/db/types";
import { recordPayment } from "@/lib/services/billing";
import { applySnapshot, subscriptionByLicense } from "@/lib/services/subscriptions";
import { planConfig } from "./config";
import { billingGateway } from "./freemius";
import { logBilling } from "./log";
import { snapshotOf, type ProviderSnapshot } from "./snapshot";
import { scopeOf, syncPaymentsQuietly } from "./sync";
import { claimEvent, failEvent, finishEvent } from "./webhook-ledger";

/**
 * The events this app acts on, exactly as the SDK types them (`@freemius/sdk` WebhookEventDataMap). Anything else
 * Freemius may send is acknowledged and ignored. Refund-related events are deliberately not handled at all.
 */
export const HANDLED_EVENTS = [
  "license.created",
  "license.extended",
  "license.shortened",
  "license.plan.changed",
  "license.updated",
  "license.expired",
  "license.cancelled",
  "license.deleted",
  "subscription.created",
  "subscription.cancelled",
  "subscription.renewal.failed",
  "subscription.renewal.failed.last",
] as const satisfies readonly WebhookEventType[];

export class EventBusyError extends Error {
  constructor() {
    super("Event is being processed by another delivery");
    this.name = "EventBusyError";
  }
}

type Outcome = { status: "processed"; licenseId: string; row: Subscription } | { status: "ignored"; note: string; licenseId?: string };

type LicenseObjects = { license: LicenseEntity; user?: UserPluginEntity; subscription?: import("@freemius/sdk").SubscriptionEntity };

/** The buyer's email from the event, or (for events a dashboard action triggered, which carry no user) from Freemius's API. */
async function buyerOf(license: LicenseEntity, user: UserPluginEntity | undefined) {
  if (user?.email) return user;
  if (license.user_id === undefined || license.user_id === null) return null;
  try {
    return await billingGateway().retrieveUser(String(license.user_id));
  } catch (err) {
    logBilling("warn", "buyer_lookup_failed", { licenseId: String(license.id) }, err);
    return null;
  }
}

async function dispatch(event: WebhookEvent, now: Date): Promise<Outcome> {
  const at = parseDateTime(event.created);

  if (event.type === "license.deleted") {
    // The license was removed in the Developer Dashboard: whatever access it carried ends now.
    const licenseId = (event as WebhookEvent<"license.deleted">).data.license_id;
    if (typeof licenseId !== "string" || !licenseId) return { status: "ignored", note: "license id is not a string" };
    const row = await subscriptionByLicense(licenseId);
    if (!row) return { status: "ignored", note: "unknown license", licenseId };
    const revoked = await applySnapshot(
      { licenseId, productId: null, planId: null, pricingId: null, environment: row.environment, buyerEmail: null, freemiusUserId: null, subscription: null, signals: { at }, license: { paidThrough: now, isCancelled: true, createdAt: null, updatedAt: at } },
      now,
    );
    return { status: "processed", licenseId, row: revoked };
  }

  const objects = (event as unknown as { objects: LicenseObjects }).objects;
  const license = objects.license;
  if (!license) return { status: "ignored", note: "no license in event" };
  if (typeof license.id !== "string" && typeof license.id !== "number") return { status: "ignored", note: "license id is not a string or number" };
  const licenseId = String(license.id);

  const scope = scopeOf(license);
  if (!scope.ok) return { status: "ignored", note: scope.reason, licenseId };

  const signals: ProviderSnapshot["signals"] = { at };
  if (event.type === "subscription.renewal.failed") signals.renewalFailed = true;
  if (event.type === "subscription.renewal.failed.last") signals.renewalFailedLast = true;
  if (event.type === "subscription.cancelled") signals.cancellationConfirmed = true;

  const buyer = await buyerOf(license, objects.user);
  const snap = snapshotOf({ license, subscription: objects.subscription, buyer, signals, plan: planConfig() });
  const row = await applySnapshot(snap, now);

  // A renewal that failed is a payment attempt worth recording, once per event.
  if (event.type === "subscription.renewal.failed" && row.userId) {
    await recordPayment({
      userId: row.userId,
      provider: "freemius",
      ref: `freemius:failed:${event.id}`,
      status: "failed",
      amountMinor: row.amountMinor ?? 0,
      currency: row.currency ?? "USD",
      subscriptionId: row.id,
      kind: "renewal",
      createdAt: at ?? now,
    });
  }
  // Completed payments (first charge, renewals) come from Freemius's payments API, keyed by payment id.
  await syncPaymentsQuietly(row);
  return { status: "processed", licenseId, row };
}

/**
 * Process one signature-verified webhook event exactly once, however many times or in whatever order it arrives.
 * Throws on failure so the sender is told to retry (the SDK turns a throw into a 500); redeliveries of an
 * already-handled event return normally without doing anything.
 */
export async function handleFreemiusEvent(event: WebhookEvent, now = new Date()): Promise<"processed" | "ignored" | "duplicate"> {
  if (!event.id) throw new Error("webhook event without an id");
  const claim = await claimEvent({ id: String(event.id), type: event.type, createdAt: parseDateTime(event.created) }, now);
  if (claim.outcome === "duplicate") return "duplicate";
  if (claim.outcome === "busy") throw new EventBusyError();
  try {
    const outcome = await dispatch(event, now);
    await finishEvent(String(event.id), outcome.status, { note: outcome.status === "ignored" ? outcome.note : null, licenseId: outcome.licenseId ?? null }, now);
    return outcome.status;
  } catch (err) {
    await failEvent(String(event.id), err instanceof Error ? err.name : "Error", now);
    logBilling("error", "webhook_failed", { eventId: String(event.id), type: event.type }, err);
    throw err;
  }
}
