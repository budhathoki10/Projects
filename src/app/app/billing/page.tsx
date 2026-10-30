import type { Metadata } from "next";
import { KhaltiButton, PaddleCheckout } from "@/components/billing-buttons";
import { FormMessage } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { hasPass, LIMITS, PASSES } from "@/lib/plans";
import { appUrl } from "@/lib/util";

export const metadata: Metadata = { title: "Job-hunt pass" };

const MESSAGES: Record<string, { error?: string; success?: string }> = {
  success: { success: "Payment received. Your pass is active." },
  pending: { success: "Waiting for the payment to confirm. Your pass switches on as soon as it does, usually within a minute or two." },
  failed: { error: "The payment didn't go through, and you haven't been charged." },
};

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const user = await requireUser();
  const { status, for: reason } = await searchParams;
  const message = typeof status === "string" ? MESSAGES[status] : undefined;
  const active = hasPass(user);
  const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const paddlePrices = [
    { label: `$${PASSES.month.usd} for 30 days`, priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_30 },
    { label: `$${PASSES.quarter.usd} for 90 days`, priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_90 },
  ].filter((p): p is { label: string; priceId: string } => !!p.priceId);

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Job-hunt pass</h1>
      <p className="mt-1.5 text-sm text-muted">
        One payment, no subscription. It never renews on its own: when the time runs out, you&apos;re back on the free plan with everything kept.
      </p>
      <div className="mt-6 space-y-3">
        {reason === "docx" && !active && <FormMessage error="Word downloads come with a pass. PDF downloads are free." />}
        <FormMessage error={message?.error} success={message?.success} />
      </div>

      <dl className="mt-6 grid grid-cols-2 border-y border-border py-5">
        <div>
          <dt className="text-[13px] text-muted">Plan</dt>
          <dd className="mt-1 text-lg font-medium" data-testid="current-plan">
            {active ? "Job-hunt pass" : "Free"}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">{active ? "Pass ends" : "Each month"}</dt>
          <dd className="mt-1 text-lg">
            {active && user.passUntil
              ? user.passUntil.toLocaleDateString("en-GB", { dateStyle: "long" })
              : `${LIMITS.free.tailor} tailored CVs, ${LIMITS.free.cover} cover letters`}
          </dd>
        </div>
      </dl>

      <section className="mt-12">
        <h2 className="font-serif text-2xl font-medium">{active ? "Add more time" : "What the pass adds"}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>Tailor your CV for as many jobs as you apply to</li>
          <li>Cover letters and interview practice for every one of them</li>
          <li>Word (.docx) downloads, as well as PDF</li>
        </ul>
        <p className="mt-3 text-[13px] text-muted">
          Buying again adds time to the end of your current pass. Full refund if you ask within 14 days.
        </p>

        <div className="mt-8 divide-y divide-border border-y border-border">
          <div className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-medium">Card, Apple Pay or Google Pay</p>
              <p className="text-sm text-muted">Charged once in USD by Paddle.</p>
            </div>
            {paddleToken && paddlePrices.length > 0 ? (
              <PaddleCheckout
                clientToken={paddleToken}
                environment={process.env.PADDLE_ENV ?? "sandbox"}
                prices={paddlePrices}
                userId={user.id}
                email={user.email}
                successUrl={appUrl("/app/billing?status=pending")}
              />
            ) : (
              <p className="text-sm text-faint">Not set up yet</p>
            )}
          </div>
          <div className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-medium">Khalti</p>
              <p className="text-sm text-muted">For Nepal, in rupees.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <KhaltiButton pass="month" label={`NPR ${PASSES.month.npr.toLocaleString("en-US")} for 30 days`} />
              <KhaltiButton pass="quarter" label={`NPR ${PASSES.quarter.npr.toLocaleString("en-US")} for 90 days`} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
