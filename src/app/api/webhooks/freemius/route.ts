import { BillingConfigError } from "@/lib/billing/config";
import { getFreemius } from "@/lib/billing/freemius";
import { HANDLED_EVENTS, handleFreemiusEvent } from "@/lib/billing/events";
import { logBilling } from "@/lib/billing/log";

/**
 * Freemius calls this with every event you subscribe to (Developer Dashboard → Webhooks). The SDK verifies the
 * `x-signature` header (HMAC-SHA256 of the raw body with your product's secret key, compared in constant time)
 * before anything else runs, and answers 401 to a request that doesn't carry a valid one. Each verified event is then
 * processed once (see handleFreemiusEvent); a failure answers 500 so Freemius retries it.
 */
export async function POST(request: Request) {
  let freemius;
  try {
    freemius = getFreemius();
  } catch (err) {
    // A deployment without credentials says so, loudly and clearly, instead of silently dropping payments.
    if (err instanceof BillingConfigError) {
      logBilling("error", "webhook_unconfigured", { missing: err.missing.join(",") });
      return Response.json({ error: "Billing is not configured on this server" }, { status: 503 });
    }
    throw err;
  }
  const listener = freemius.webhook.createListener({
    onError: async (err) => logBilling("error", "webhook_handler_error", {}, err),
  });
  listener.on([...HANDLED_EVENTS], async (event) => {
    await handleFreemiusEvent(event);
  });
  return freemius.webhook.processFetch(listener, request);
}
