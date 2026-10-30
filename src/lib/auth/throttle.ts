import "server-only";
import { and, count, eq, gt, lt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashForLimit } from "@/lib/util";

/** Wrong passwords allowed per email, and per IP address, in the window before logins pause. */
export const MAX_FAILURES_PER_EMAIL = 8;
export const MAX_FAILURES_PER_IP = 30;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const keys = (email: string, ip: string) => ({ email: hashForLimit("email", email), ip: hashForLimit("ip", ip) });

/** True when this email or this IP has had too many wrong passwords recently. */
export async function loginThrottled(email: string, ip: string, now = new Date()): Promise<boolean> {
  const k = keys(email, ip);
  const since = new Date(now.getTime() - FAILURE_WINDOW_MS);
  const rows = await db
    .select({ key: schema.loginFailures.key, n: count() })
    .from(schema.loginFailures)
    .where(and(or(eq(schema.loginFailures.key, k.email), eq(schema.loginFailures.key, k.ip)), gt(schema.loginFailures.createdAt, since)))
    .groupBy(schema.loginFailures.key);
  const n = (key: string) => rows.find((r) => r.key === key)?.n ?? 0;
  return n(k.email) >= MAX_FAILURES_PER_EMAIL || n(k.ip) >= MAX_FAILURES_PER_IP;
}

export async function recordLoginFailure(email: string, ip: string, now = new Date()) {
  const k = keys(email, ip);
  await db.insert(schema.loginFailures).values([
    { key: k.email, createdAt: now },
    { key: k.ip, createdAt: now },
  ]);
  // Keep the table small: nothing older than a day matters.
  await db.delete(schema.loginFailures).where(lt(schema.loginFailures.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
}

/** A successful login clears that email's failures (not the IP's, which may be shared). */
export async function clearLoginFailures(email: string) {
  await db.delete(schema.loginFailures).where(eq(schema.loginFailures.key, hashForLimit("email", email)));
}
