import "server-only";
import { collections, isDuplicateKey } from "@/db/mongo";
import type { WebhookEventStatus } from "@/db/types";

/**
 * A record of every webhook event, keyed by Freemius's event id. Inserting that record is how an event is
 * "claimed", so the unique `_id` decides, atomically, which of several simultaneous deliveries does the work.
 *
 *   claimed    This delivery should process the event.
 *   duplicate  Already processed (or deliberately ignored). Acknowledge it and do nothing.
 *   busy       Another delivery holds a fresh claim. Fail this one so the sender tries again later.
 *
 * A claim lapses after LOCK_MS, so a worker that crashed mid-event can't block it forever, and a "failed" event
 * can be claimed again by its retry.
 */
export const LOCK_MS = 60_000;

export type Claim = { outcome: "claimed"; attempts: number } | { outcome: "duplicate"; status: WebhookEventStatus } | { outcome: "busy" };

export const ledgerId = (eventId: string) => `freemius:${eventId}`;

export async function claimEvent(event: { id: string; type: string; createdAt: Date | null }, now = new Date()): Promise<Claim> {
  const { webhookEvents } = await collections();
  const _id = ledgerId(event.id);
  try {
    await webhookEvents.insertOne({
      _id,
      provider: "freemius",
      eventId: event.id,
      type: event.type,
      status: "processing",
      attempts: 1,
      lockedUntil: new Date(now.getTime() + LOCK_MS),
      licenseId: null,
      note: null,
      eventCreatedAt: event.createdAt,
      receivedAt: now,
      processedAt: null,
    });
    return { outcome: "claimed", attempts: 1 };
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  // Seen before. A failed event, or one whose worker vanished, may be taken again; the atomic update picks one taker.
  const retaken = await webhookEvents.findOneAndUpdate(
    { _id, $or: [{ status: "failed" }, { status: "processing", lockedUntil: { $lt: now } }] },
    { $set: { status: "processing", lockedUntil: new Date(now.getTime() + LOCK_MS) }, $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (retaken) return { outcome: "claimed", attempts: retaken.attempts };
  const current = await webhookEvents.findOne({ _id });
  if (current && (current.status === "processed" || current.status === "ignored")) return { outcome: "duplicate", status: current.status };
  return { outcome: "busy" };
}

export async function finishEvent(eventId: string, status: "processed" | "ignored", detail: { note?: string | null; licenseId?: string | null } = {}, now = new Date()) {
  await (await collections()).webhookEvents.updateOne(
    { _id: ledgerId(eventId) },
    { $set: { status, note: detail.note ?? null, licenseId: detail.licenseId ?? null, processedAt: now, lockedUntil: null } },
  );
}

/** Record that processing failed, so the retry can take it. The note names the kind of error only: never a payload, never a secret. */
export async function failEvent(eventId: string, errorName: string, now = new Date()) {
  await (await collections()).webhookEvents.updateOne(
    { _id: ledgerId(eventId) },
    { $set: { status: "failed", note: errorName.slice(0, 80), processedAt: now, lockedUntil: null } },
  );
}
