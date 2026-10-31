import type { User } from "@/db/types";

/** AI actions allowed per calendar month. The paid cap is a fair-use ceiling, not a selling point. */
export const LIMITS = {
  free: { tailor: 3, cover: 3, interview: 3, import: 5, docx: false },
  paid: { tailor: 200, cover: 200, interview: 200, import: 50, docx: true },
} as const;
export type UsageKind = "tailor" | "cover" | "interview" | "import";

type Entitlement = Pick<User, "subscriptionAccessUntil">;

/**
 * Paid access comes only from a Freemius subscription. The end date is worked out from stored,
 * provider-confirmed data on every request (see src/lib/billing/access.ts), never from the browser.
 */
export function isPaid(user: Entitlement, now = new Date()): boolean {
  const until = user.subscriptionAccessUntil ?? null;
  return !!until && until > now;
}

export function limitsFor(user: Entitlement) {
  return isPaid(user) ? LIMITS.paid : LIMITS.free;
}

/** "2026-10" for usage counting; months are UTC. */
export function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
