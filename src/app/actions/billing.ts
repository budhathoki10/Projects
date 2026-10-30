"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { initiateKhaltiPayment } from "@/lib/billing/khalti";
import { isPassId, PASSES } from "@/lib/plans";
import { recordPayment } from "@/lib/services/billing";
import { appUrl, shortId } from "@/lib/util";

export type BillingState = { error?: string } | undefined;

export async function startKhaltiPayment(_: BillingState, formData: FormData): Promise<BillingState> {
  const user = await requireUser();
  if (!process.env.KHALTI_SECRET_KEY) return { error: "Khalti payments are not configured yet." };
  const passId = formData.get("pass");
  if (!isPassId(passId)) return { error: "Choose a pass." };
  const pass = PASSES[passId];
  const amountPaisa = pass.npr * 100;
  let paymentUrl: string;
  try {
    const res = await initiateKhaltiPayment({
      amountPaisa,
      orderId: `sl-${shortId(12)}`,
      orderName: `Shortlist Job-hunt pass (${pass.label})`,
      returnUrl: appUrl("/api/billing/khalti/callback"),
      websiteUrl: appUrl(),
      customer: { name: user.name, email: user.email },
    });
    await recordPayment({ userId: user.id, provider: "khalti", ref: res.pidx, status: "pending", amountMinor: amountPaisa, currency: "NPR", days: pass.days });
    paymentUrl = res.payment_url;
  } catch (err) {
    console.error("Khalti initiate failed", err);
    return { error: "Couldn't start the Khalti payment. Try again." };
  }
  redirect(paymentUrl);
}
