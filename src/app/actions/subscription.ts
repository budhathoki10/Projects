"use server";

import { revalidatePath } from "next/cache";
import type { CheckoutSerialized } from "@freemius/sdk";
import { requireUser } from "@/lib/auth/session";
import { effectiveStatus } from "@/lib/billing/access";
import { BillingConfigError, billingMode, billingPolicy, planConfig } from "@/lib/billing/config";
import { billingGateway, getFreemius } from "@/lib/billing/freemius";
import { logBilling } from "@/lib/billing/log";
import { syncLicense, syncUser } from "@/lib/billing/sync";
import { overLimit } from "@/lib/services/rate-limit";
import { abandonCheckout, accessUntilForUser, beginCheckout, blockingSubscription, markCancelRequested, subscriptionsForUser } from "@/lib/services/subscriptions";

export type CheckoutState = { error?: string; options?: CheckoutSerialized["options"] } | undefined;
export type SubscriptionState = { error?: string; success?: string } | undefined;
/** `active` is decided on the server from confirmed data; the browser only reads it to know when to stop waiting. */
export type ConfirmState = { error?: string; active?: boolean } | undefined;

const HOUR = 60 * 60_000;
const BUSY = "Please wait a few minutes before trying again.";
const UNAVAILABLE = "Subscriptions are temporarily unavailable. Please try again later.";

/**
 * Open checkout for the signed-in user. Everything the checkout needs is decided here, on the server: the plan,
 * the price, the sandbox flag, and the buyer's email (locked, so the purchase can only ever be for this account).
 * Nothing the browser sends other than "monthly" or "yearly" is used.
 */
export async function startCheckout(_: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await requireUser();
  const interval = formData.get("interval");
  if (interval !== "monthly" && interval !== "yearly") return { error: "Choose monthly or yearly." };
  if (await overLimit(`checkout:${user.id}`, 10, HOUR)) return { error: BUSY };

  try {
    const plan = planConfig();
    const mode = billingMode();
    const policy = billingPolicy();

    // One subscription at a time: refuse if one is live or failing, or a checkout is already open.
    const existing = await blockingSubscription(user.id, new Date(), policy);
    if (existing) {
      const status = effectiveStatus(existing, new Date(), policy);
      if (status === "pending") return { error: "A checkout is already open for your account. Finish it, or wait a few minutes and try again." };
      return { error: "Your account already has a subscription. Use the subscription controls below to manage it." };
    }

    await beginCheckout({ userId: user.id, email: user.email, interval, environment: mode });
    const checkout = await getFreemius().checkout.create({ user: { email: user.email, name: user.name }, isSandbox: mode === "sandbox", planId: plan.planId });
    // The pricing record may carry both prices, so the billing cycle is what makes this monthly or yearly.
    checkout.setPricing(plan.pricingIds[interval]).setBillingCycle(interval === "yearly" ? "annual" : "monthly");
    return { options: checkout.getOptions() };
  } catch (err) {
    if (err instanceof BillingConfigError) {
      logBilling("error", "checkout_unconfigured", { missing: err.missing.join(",") });
      return { error: UNAVAILABLE };
    }
    logBilling("error", "checkout_failed", { userId: user.id }, err);
    return { error: "We couldn't open checkout. Try again in a moment." };
  }
}

/**
 * The browser says "I think I finished paying": all this does is go and ask Freemius. The result comes from
 * Freemius's API about the purchases made with this account's email; nothing the browser claims is used, so a
 * forged call can't grant access, it can only trigger a lookup.
 */
export async function confirmCheckout(): Promise<ConfirmState> {
  const user = await requireUser();
  if (await overLimit(`checkout-confirm:${user.id}`, 60, HOUR)) return { error: BUSY };
  try {
    await syncUser(user);
  } catch (err) {
    if (err instanceof BillingConfigError) return { error: UNAVAILABLE };
    logBilling("warn", "checkout_confirm_failed", { userId: user.id }, err);
    return { error: "Unable to confirm your payment yet. Check your subscription status again in a few minutes before starting another payment." };
  }
  revalidatePath("/app", "layout");
  const until = await accessUntilForUser(user.id);
  return { active: !!until && until > new Date() };
}

/** Checkout was closed without paying: drop the waiting row so a new checkout can start straight away. */
export async function abandonCheckoutAction(): Promise<void> {
  const user = await requireUser();
  await abandonCheckout(user.id);
  revalidatePath("/app/billing");
}

/**
 * Ask Freemius to cancel. This is a REQUEST: it stops future renewals, the subscription's status only changes when
 * Freemius confirms (webhook or the sync below), and what was already paid for stays usable until its end date.
 */
export async function cancelSubscriptionAction(formData: FormData): Promise<SubscriptionState> {
  const user = await requireUser();
  if (await overLimit(`cancel-sub:${user.id}`, 10, HOUR)) return { error: BUSY };
  const rowId = String(formData.get("subscriptionId") ?? "");
  // Only the caller's own row: the id from the form is never trusted to name someone else's.
  const row = (await subscriptionsForUser(user.id)).find((r) => r.id === rowId);
  if (!row || !row.freemiusSubscriptionId) return { error: "We couldn't find that subscription." };
  if (row.cancelledAt || row.cancelRequestedAt) return { success: "Cancellation is already requested." };
  try {
    await billingGateway().cancelSubscription(row.freemiusSubscriptionId);
  } catch (err) {
    logBilling("error", "cancel_failed", { subscriptionId: row.id }, err);
    return { error: "We couldn't cancel just now. Try again in a moment." };
  }
  await markCancelRequested(row.id);
  try {
    if (row.freemiusLicenseId) await syncLicense(row.freemiusLicenseId);
  } catch (err) {
    // The request went through; confirmation will arrive by webhook or the scheduled check.
    logBilling("warn", "cancel_sync_failed", { subscriptionId: row.id }, err);
  }
  revalidatePath("/app", "layout");
  return { success: "Cancellation requested. You keep access until the end of the period you've paid for." };
}
