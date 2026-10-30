import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300;

/**
 * Verify a Paddle Billing webhook. Header format: "ts=1671552777;h1=<hex>";
 * the signed payload is `${ts}:${rawBody}` (HMAC-SHA256 with the endpoint secret).
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(";").map((p) => p.split("=") as [string, string]);
  const ts = parts.find(([k]) => k === "ts")?.[1];
  const signatures = parts.filter(([k]) => k === "h1").map(([, v]) => v);
  if (!ts || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(ts)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type PaddleEvent = {
  event_id: string;
  event_type: string;
  data: {
    id: string;
    status?: string;
    currency_code?: string;
    custom_data?: { userId?: string } | null;
    items?: { price?: { id?: string } | null }[];
    details?: { totals?: { grand_total?: string } };
  };
};

/** Paddle price id -> days of access. Configured per environment. */
export function passDaysForPrice(priceId: string | undefined): number | null {
  if (!priceId) return null;
  if (priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_30) return 30;
  if (priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_90) return 90;
  return null;
}

/**
 * What a Paddle event means for our database. Passes are one-time purchases, so only a
 * completed transaction matters. The days come from the price actually paid, never from
 * custom_data, which the buyer's browser could change.
 */
export function interpretPaddleEvent(
  event: PaddleEvent,
): { kind: "pass"; userId: string; ref: string; amountMinor: number; currency: string; days: number } | { kind: "ignore" } {
  const userId = event.data.custom_data?.userId;
  if (!userId || event.event_type !== "transaction.completed") return { kind: "ignore" };
  const days = (event.data.items ?? []).reduce((sum, item) => sum + (passDaysForPrice(item.price?.id ?? undefined) ?? 0), 0);
  if (days === 0) return { kind: "ignore" };
  return {
    kind: "pass",
    userId,
    ref: event.data.id,
    amountMinor: Number(event.data.details?.totals?.grand_total ?? 0),
    currency: event.data.currency_code ?? "USD",
    days,
  };
}
