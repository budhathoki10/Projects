import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { limitsFor, monthKey, type UsageKind } from "@/lib/plans";

/**
 * Count one use if the user is under this month's limit. A single conditional upsert, so two
 * requests at once can't both squeeze past the last free use.
 */
export async function spendAllowance(user: Pick<User, "id" | "passUntil">, kind: UsageKind, now = new Date()): Promise<boolean> {
  const limit = limitsFor(user)[kind];
  const month = monthKey(now);
  const rows = await db
    .insert(schema.usage)
    .values({ userId: user.id, month, kind, count: 1 })
    .onConflictDoUpdate({
      target: [schema.usage.userId, schema.usage.month, schema.usage.kind],
      set: { count: sql`${schema.usage.count} + 1` },
      setWhere: sql`${schema.usage.count} < ${limit}`,
    })
    .returning({ count: schema.usage.count });
  return rows.length > 0 && rows[0].count <= limit;
}

/** Give back a use when the work it paid for failed. */
export async function refundAllowance(userId: string, kind: UsageKind, now = new Date()) {
  await db
    .update(schema.usage)
    .set({ count: sql`greatest(${schema.usage.count} - 1, 0)` })
    .where(and(eq(schema.usage.userId, userId), eq(schema.usage.month, monthKey(now)), eq(schema.usage.kind, kind)));
}

export async function usageThisMonth(userId: string, now = new Date()): Promise<Record<UsageKind, number>> {
  const rows = await db
    .select({ kind: schema.usage.kind, count: schema.usage.count })
    .from(schema.usage)
    .where(and(eq(schema.usage.userId, userId), eq(schema.usage.month, monthKey(now))));
  const out: Record<UsageKind, number> = { tailor: 0, cover: 0, interview: 0, import: 0, assist: 0 };
  for (const r of rows) out[r.kind as UsageKind] = r.count;
  return out;
}
