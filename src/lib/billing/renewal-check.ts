import "server-only";
import type { Subscription } from "@/db/types";
import { syncLicense } from "@/lib/billing/sync";
import { overLimit } from "@/lib/services/rate-limit";
import { subscriptionsForUser } from "@/lib/services/subscriptions";

const DAY = 86_400_000;
const HOUR = 3_600_000;

type Renewable = Pick<Subscription, "freemiusLicenseId" | "paidThrough" | "cancelledAt" | "suspended">;

/**
 * Licenses whose renewal is due about now: still meant to renew (not cancelled or suspended), paid through
 * a date between 7 days ago and 2 days from now. If the renewal webhook was lost, this is exactly when a
 * paying customer would wrongly drop to the free plan.
 */
export function renewalsToCheck(rows: Renewable[], now = new Date()): string[] {
  return rows
    .filter((r) => r.freemiusLicenseId && r.paidThrough && !r.cancelledAt && !r.suspended)
    .filter((r) => r.paidThrough!.getTime() - now.getTime() < 2 * DAY && now.getTime() - r.paidThrough!.getTime() < 7 * DAY)
    .map((r) => r.freemiusLicenseId!);
}

type Deps = {
  rows: (userId: string) => Promise<Renewable[]>;
  sync: (licenseId: string, now: Date) => Promise<unknown>;
  limited: (key: string, limit: number, windowMs: number, now: number) => Promise<boolean>;
};

const live: Deps = { rows: subscriptionsForUser, sync: syncLicense, limited: overLimit };

/**
 * The safety net for a missed renewal webhook: re-read those licenses from Freemius, at most once an hour
 * per account. Returns how many were re-read. Failures are logged, never thrown: this runs after the response.
 */
export async function recheckRenewals(userId: string, now = new Date(), deps: Deps = live): Promise<number> {
  const due = renewalsToCheck(await deps.rows(userId), now);
  if (due.length === 0) return 0;
  if (await deps.limited(`renewal-check:${userId}`, 1, HOUR, now.getTime())) return 0;
  let checked = 0;
  for (const licenseId of due) {
    try {
      await deps.sync(licenseId, now);
      checked++;
    } catch (err) {
      console.warn(JSON.stringify({ level: "warn", scope: "billing", event: "renewal_recheck_failed", message: err instanceof Error ? err.message.slice(0, 200) : "failed" }));
    }
  }
  return checked;
}
