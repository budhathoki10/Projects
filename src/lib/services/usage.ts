import "server-only";
import { collections, isDuplicateKey } from "@/db/mongo";
import type { User } from "@/db/types";
import { limitsFor, monthKey, type UsageKind } from "@/lib/plans";

const usageId = (userId: string, month: string, kind: UsageKind) => `${userId}:${month}:${kind}`;

/**
 * Count one use if the user is under this month's limit. A single conditional upsert, so two
 * requests at once can't both squeeze past the last free use.
 */
export async function spendAllowance(user: Pick<User, "id" | "subscriptionAccessUntil">, kind: UsageKind, now = new Date()): Promise<boolean> {
  const limit = limitsFor(user)[kind];
  const month = monthKey(now);
  const _id = usageId(user.id, month, kind);
  const { usage } = await collections();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const doc = await usage.findOneAndUpdate(
        { _id, count: { $lt: limit } },
        { $inc: { count: 1 }, $setOnInsert: { userId: user.id, month, kind } },
        { upsert: true, returnDocument: "after" },
      );
      return !!doc && doc.count <= limit;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // Either the row is already at the limit, or two first uses raced to create it. Look and decide.
      const current = await usage.findOne({ _id });
      if (current && current.count >= limit) return false;
    }
  }
  return false;
}

/** Give back a use when the work it paid for failed. */
export async function refundAllowance(userId: string, kind: UsageKind, now = new Date()) {
  const { usage } = await collections();
  await usage.updateOne({ _id: usageId(userId, monthKey(now), kind), count: { $gt: 0 } }, { $inc: { count: -1 } });
}

export async function usageThisMonth(userId: string, now = new Date()): Promise<Record<UsageKind, number>> {
  const { usage } = await collections();
  const rows = await usage.find({ userId: String(userId), month: monthKey(now) }).toArray();
  const out: Record<UsageKind, number> = { tailor: 0, cover: 0, interview: 0, import: 0 };
  for (const r of rows) if (r.kind in out) out[r.kind as UsageKind] = r.count;
  return out;
}
