import "server-only";
import { z } from "zod";

/**
 * Everything Freemius needs, read from the environment. Nothing here is a default for a real credential:
 * a missing value is a clear error naming the variable, never a silent skip, so a half-configured
 * deployment can't quietly stop taking (or stop honouring) payments.
 */
export class BillingConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Billing is not configured. Set: ${missing.join(", ")}. See .env.example for where each value comes from in the Freemius Developer Dashboard.`);
    this.name = "BillingConfigError";
  }
}

/** Any string map: the real environment, or a plain object in tests. */
type Env = Record<string, string | undefined>;

const filled = z.string().trim().min(1);

/**
 * "sandbox" uses Freemius's sandbox checkout (test cards, no real money) and only accepts sandbox purchases.
 * "production" uses live checkout and rejects any sandbox purchase, so a test subscription can never unlock paid access.
 */
export type BillingMode = "sandbox" | "production";

export function billingMode(env: Env = process.env): BillingMode {
  const mode = (env.FREEMIUS_MODE ?? "sandbox").trim().toLowerCase();
  if (mode !== "sandbox" && mode !== "production") throw new BillingConfigError(["FREEMIUS_MODE (must be \"sandbox\" or \"production\")"]);
  return mode;
}

export type FreemiusConfig = {
  productId: number;
  apiKey: string;
  secretKey: string;
  publicKey: string;
};

export type PlanConfig = {
  planId: string;
  pricingIds: { monthly: string; yearly: string };
};

function need(env: Env, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const parsed = filled.safeParse(env[name]);
    if (parsed.success) out[name] = parsed.data;
    else missing.push(name);
  }
  if (missing.length) throw new BillingConfigError(missing);
  return out;
}

/** The four credentials the SDK needs. Backend only: none of these may ever reach the browser. */
export function freemiusConfig(env: Env = process.env): FreemiusConfig {
  const v = need(env, ["FREEMIUS_PRODUCT_ID", "FREEMIUS_API_KEY", "FREEMIUS_SECRET_KEY", "FREEMIUS_PUBLIC_KEY"]);
  const productId = Number(v.FREEMIUS_PRODUCT_ID);
  if (!Number.isInteger(productId) || productId <= 0) throw new BillingConfigError(["FREEMIUS_PRODUCT_ID (must be the numeric product id)"]);
  // The SDK refuses a shorter secret key; say so here, by name, rather than as an unexplained exception at the first request.
  if (v.FREEMIUS_SECRET_KEY.length < 32) throw new BillingConfigError(["FREEMIUS_SECRET_KEY (looks truncated: the SDK requires at least 32 characters)"]);
  return { productId, apiKey: v.FREEMIUS_API_KEY, secretKey: v.FREEMIUS_SECRET_KEY, publicKey: v.FREEMIUS_PUBLIC_KEY };
}

/** The paid plan, and the Freemius pricing record for each billing interval. */
export function planConfig(env: Env = process.env): PlanConfig {
  const v = need(env, ["FREEMIUS_PLAN_ID", "FREEMIUS_PRICING_ID_MONTHLY", "FREEMIUS_PRICING_ID_YEARLY"]);
  return { planId: v.FREEMIUS_PLAN_ID, pricingIds: { monthly: v.FREEMIUS_PRICING_ID_MONTHLY, yearly: v.FREEMIUS_PRICING_ID_YEARLY } };
}

/** True when checkout can be offered. The billing page uses this to say "not set up yet" instead of failing. */
export function billingConfigured(env: Env = process.env): boolean {
  try {
    freemiusConfig(env);
    planConfig(env);
    billingMode(env);
    return true;
  } catch {
    return false;
  }
}

export type BillingPolicy = {
  /** Days of access kept after the paid-through date while a renewal is failing, so a card hiccup doesn't lock someone out. */
  graceDays: number;
  /** What a suspended subscription (final renewal attempt failed, or the license was cancelled by the seller) gets. */
  suspendedAccess: "none" | "grace";
};

export function billingPolicy(env: Env = process.env): BillingPolicy {
  const grace = env.BILLING_GRACE_DAYS === undefined || env.BILLING_GRACE_DAYS === "" ? 3 : Number(env.BILLING_GRACE_DAYS);
  if (!Number.isInteger(grace) || grace < 0 || grace > 60) throw new BillingConfigError(["BILLING_GRACE_DAYS (a whole number from 0 to 60)"]);
  const suspended = (env.BILLING_SUSPENDED_ACCESS ?? "none").trim().toLowerCase();
  if (suspended !== "none" && suspended !== "grace") throw new BillingConfigError(["BILLING_SUSPENDED_ACCESS (\"none\" or \"grace\")"]);
  return { graceDays: grace, suspendedAccess: suspended };
}

/**
 * Display-only price text for the pricing page. Real prices live in Freemius and are shown in its checkout;
 * these are just labels (for example "$9 / month") so the page can say what it costs before the overlay opens.
 */
export function priceLabels(env: Env = process.env): { monthly: string | null; yearly: string | null } {
  const label = (v: string | undefined) => (v && v.trim() ? v.trim().slice(0, 40) : null);
  return { monthly: label(env.BILLING_PRICE_LABEL_MONTHLY), yearly: label(env.BILLING_PRICE_LABEL_YEARLY) };
}
