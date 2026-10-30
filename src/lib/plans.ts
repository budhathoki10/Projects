import type { User } from "@/db/schema";

/** One-time Job-hunt passes. They extend access and never renew on their own. */
export const PASSES = {
  month: { days: 30, usd: 15, npr: Number(process.env.KHALTI_PASS_30_NPR ?? 1500), label: "30 days" },
  quarter: { days: 90, usd: 35, npr: Number(process.env.KHALTI_PASS_90_NPR ?? 3500), label: "90 days" },
} as const;
export type PassId = keyof typeof PASSES;

export function isPassId(v: unknown): v is PassId {
  return v === "month" || v === "quarter";
}

/** AI actions allowed per calendar month. The pass cap is a fair-use ceiling, not a selling point. */
export const LIMITS = {
  free: { tailor: 3, cover: 3, interview: 3, import: 5, docx: false },
  pass: { tailor: 200, cover: 200, interview: 200, import: 50, docx: true },
} as const;
export type UsageKind = "tailor" | "cover" | "interview" | "import";

export function hasPass(user: Pick<User, "passUntil">, now = new Date()): boolean {
  return !!user.passUntil && user.passUntil > now;
}

/** Whole days left on the pass (at least 1 while it's active), or null without one. */
export function passDaysLeft(user: Pick<User, "passUntil">, now = new Date()): number | null {
  if (!user.passUntil || !hasPass(user, now)) return null;
  return Math.max(1, Math.ceil((user.passUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export function limitsFor(user: Pick<User, "passUntil">) {
  return hasPass(user) ? LIMITS.pass : LIMITS.free;
}

/** "2026-10" for usage counting; months are UTC. */
export function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
