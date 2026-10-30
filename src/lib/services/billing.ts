import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Extend the Job-hunt pass by `days`, from now or from the current end date, whichever is later. */
export async function extendPass(userId: string, days: number) {
  await db
    .update(schema.users)
    .set({ passUntil: sql`greatest(coalesce(${schema.users.passUntil}, now()), now()) + make_interval(days => ${days})` })
    .where(eq(schema.users.id, userId));
}

/** Record a payment once; returns false if this provider reference was already processed. */
export async function recordPayment(p: {
  userId: string;
  provider: "paddle" | "khalti";
  ref: string;
  status: string;
  amountMinor: number;
  currency: string;
  days: number;
}): Promise<boolean> {
  const inserted = await db
    .insert(schema.payments)
    .values({
      userId: p.userId,
      provider: p.provider,
      providerRef: p.ref,
      status: p.status,
      amountMinor: p.amountMinor,
      currency: p.currency,
      days: p.days,
    })
    .onConflictDoNothing()
    .returning({ id: schema.payments.id });
  return inserted.length > 0;
}

/** Atomically move a pending payment to completed. Returns the row if this call won the race. */
export async function completePendingPayment(provider: "khalti", ref: string) {
  const [row] = await db
    .update(schema.payments)
    .set({ status: "completed" })
    .where(and(eq(schema.payments.provider, provider), eq(schema.payments.providerRef, ref), eq(schema.payments.status, "pending")))
    .returning();
  return row ?? null;
}

export async function getPayment(provider: "khalti" | "paddle", ref: string) {
  const [row] = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.provider, provider), eq(schema.payments.providerRef, ref)))
    .limit(1);
  return row ?? null;
}
