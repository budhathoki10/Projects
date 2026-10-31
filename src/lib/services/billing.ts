import "server-only";
import { randomUUID } from "node:crypto";
import { collections, fromDoc, isDuplicateKey } from "@/db/mongo";
import type { Payment } from "@/db/types";

/**
 * Record a payment once; returns false if this provider reference was already recorded. Freemius payments are keyed
 * by Freemius's payment id, so recording the same one any number of times (from any number of places) writes it once.
 */
export async function recordPayment(p: {
  userId: string;
  provider: Payment["provider"];
  ref: string;
  status: string;
  amountMinor: number;
  currency: string;
  subscriptionId?: string | null;
  kind?: "initial" | "renewal" | null;
  createdAt?: Date;
}): Promise<boolean> {
  const { payments } = await collections();
  try {
    await payments.insertOne({
      _id: randomUUID(),
      userId: String(p.userId),
      provider: p.provider,
      providerRef: String(p.ref),
      status: p.status,
      amountMinor: p.amountMinor,
      currency: p.currency,
      createdAt: p.createdAt ?? new Date(),
      ...(p.subscriptionId !== undefined ? { subscriptionId: p.subscriptionId, kind: p.kind ?? null } : {}),
    });
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

/** A person's payment history, newest first. */
export async function paymentsForUser(userId: string, limit = 25): Promise<Payment[]> {
  const { payments } = await collections();
  const docs = await payments.find({ userId: String(userId) }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map((d) => fromDoc<Payment>(d));
}
