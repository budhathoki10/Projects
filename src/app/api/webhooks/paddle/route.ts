import { interpretPaddleEvent, verifyPaddleSignature, type PaddleEvent } from "@/lib/billing/paddle";
import { extendPass, recordPayment } from "@/lib/services/billing";

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  if (!verifyPaddleSignature(raw, request.headers.get("paddle-signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(raw) as PaddleEvent;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const action = interpretPaddleEvent(event);
  if (action.kind === "ignore") return Response.json({ ok: true, ignored: event.event_type });
  try {
    // Recording first makes retried deliveries harmless: only the first one extends the pass.
    const first = await recordPayment({ userId: action.userId, provider: "paddle", ref: action.ref, status: "completed", amountMinor: action.amountMinor, currency: action.currency, days: action.days });
    if (first) await extendPass(action.userId, action.days);
  } catch (err) {
    console.error("Paddle webhook processing failed", err);
    // A 5xx makes Paddle retry the delivery later.
    return new Response("Processing failed", { status: 500 });
  }
  return Response.json({ ok: true });
}
