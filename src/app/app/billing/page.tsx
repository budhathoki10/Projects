import type { Metadata } from "next";
import { CancelSubscription, CheckAgain, SubscribePlans, type PlanChoice } from "@/components/subscribe-plans";
import { Badge, Notice, PageHeader } from "@/components/ui";
import type { Subscription, SubscriptionStatus } from "@/db/types";
import { requireUser } from "@/lib/auth/session";
import { accessUntil, effectiveStatus } from "@/lib/billing/access";
import { billingConfigured, billingMode, priceLabels } from "@/lib/billing/config";
import { formatMoney } from "@/lib/money";
import { StudioIcon } from "@/components/icons";
import { isPaid, LIMITS } from "@/lib/plans";
import { paymentsForUser } from "@/lib/services/billing";
import { claimByEmail, safePolicy, subscriptionsForUser } from "@/lib/services/subscriptions";

export const metadata: Metadata = { title: "Plan and billing" };

const date = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB", { dateStyle: "long" }) : null);

const TONE: Record<SubscriptionStatus, "good" | "warn" | "bad" | "neutral"> = { active: "good", pending: "neutral", past_due: "warn", cancelled: "warn", expired: "neutral", suspended: "bad" };
const LABEL: Record<SubscriptionStatus, string> = { active: "Active", pending: "Waiting for payment", past_due: "Payment failed", cancelled: "Cancelled", expired: "Expired", suspended: "Suspended" };

/** The row that best describes the account's billing: live ones first, then ones still paid up, then waiting, then ended. */
function primary(rows: Subscription[], now: Date) {
  const policy = safePolicy();
  const rank: Record<SubscriptionStatus, number> = { active: 0, past_due: 1, suspended: 2, cancelled: 3, pending: 4, expired: 5 };
  return rows.map((row) => ({ row, status: effectiveStatus(row, now, policy), until: accessUntil(row, now, policy) })).sort((a, b) => rank[a.status] - rank[b.status])[0] ?? null;
}

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const user = await requireUser();
  const { for: reason } = await searchParams;
  const now = new Date();

  // A purchase made before the account's email was confirmed attaches itself now that it can be trusted.
  await claimByEmail(user);
  const [rows, payments] = await Promise.all([subscriptionsForUser(user.id), paymentsForUser(user.id)]);
  const current = primary(rows, now);
  const paid = isPaid(user, now);
  const configured = billingConfigured();
  const labels = priceLabels();

  const blocked = current && ["active", "past_due", "suspended"].includes(current.status);
  const waiting = current?.status === "pending";
  const disabledReason = !configured
    ? "Subscriptions aren't available yet."
    : blocked
      ? "You already have a subscription. Manage it above instead of buying another."
      : waiting
        ? "A checkout is already open for your account. Finish it, or wait a few minutes."
        : null;

  const plans: PlanChoice[] = [
    { interval: "monthly", title: "Monthly", price: labels.monthly, note: "Renews every month. Cancel any time." },
    { interval: "yearly", title: "Yearly", price: labels.yearly, note: "Renews every year. Cancel any time." },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Plan and billing" description="Subscribe monthly or yearly. Cancel whenever you like and keep what you’ve paid for until it runs out." />
      {reason === "docx" && !paid && <Notice title="Word downloads require a paid plan">You can download your CV as a PDF on your current plan, or choose a paid plan for Word downloads.</Notice>}
      {configured && billingMode() === "sandbox" && <Notice title="Test checkout">Checkout is in sandbox mode. No real payment will be taken.</Notice>}

      <section aria-labelledby="your-plan" className="space-y-3 rounded-md border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="your-plan" className="text-base font-semibold">
            Your plan
          </h2>
          {current && <Badge tone={TONE[current.status]}>{LABEL[current.status]}</Badge>}
        </div>
        <p className="text-lg font-medium" data-testid="current-plan">
          {paid ? "Paid" : "Free"}
        </p>

        {current?.status === "active" && (
          <p className="text-sm text-muted">
            {current.row.interval === "yearly" ? "Yearly" : "Monthly"} subscription. Next payment {date(current.row.nextPaymentAt ?? current.row.paidThrough)}.
          </p>
        )}
        {current?.status === "past_due" && (
          <p className="text-sm text-muted">
            We couldn’t take your last payment. Paid features stay on until {date(current.until)} while it’s retried. Update your card using the link in the email Freemius sent you.
          </p>
        )}
        {current?.status === "cancelled" && <p className="text-sm text-muted">Cancelled, so it won’t renew. You keep paid features until {date(current.row.paidThrough)}.</p>}
        {current?.status === "suspended" && <p className="text-sm text-muted">This subscription has been suspended because a payment couldn’t be completed. Contact support if this looks wrong.</p>}
        {current?.status === "expired" && <p className="text-sm text-muted">Your last subscription ended {date(current.row.paidThrough)}. Subscribe again below.</p>}
        {waiting && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">Waiting for a payment to be confirmed. If you’ve paid, this appears within a minute or two.</p>
            <CheckAgain />
          </div>
        )}
        {current?.row.cancelRequestedAt && !current.row.cancelledAt && current.status !== "expired" && (
          <p className="text-sm text-muted">Cancellation requested. We’re waiting for the payment provider to confirm it.</p>
        )}
        {!paid && !waiting && <p className="text-sm text-muted">The free plan includes {LIMITS.free.tailor} tailored CVs and {LIMITS.free.cover} cover letters a month.</p>}

        {current && current.row.freemiusSubscriptionId && ["active", "past_due"].includes(current.status) && !current.row.cancelRequestedAt && (
          <div className="border-t border-border pt-3">
            <CancelSubscription subscriptionId={current.row.id} paidThrough={date(current.row.paidThrough)} />
          </div>
        )}
      </section>

      <section aria-labelledby="plans" className="space-y-3">
        <h2 id="plans" className="text-base font-semibold">
          {paid ? "Change or add a plan" : "Choose a plan"}
        </h2>
        <ul className="space-y-2 text-sm">
          {["Tailor your CV for as many jobs as you apply to", "Cover letters and interview practice for every one of them", "Word (.docx) downloads, as well as PDF"].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <StudioIcon name="check" size={16} className="mt-0.5 shrink-0 text-success" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <SubscribePlans plans={plans} disabledReason={disabledReason} />
      </section>

      {payments.length > 0 && (
        <section aria-labelledby="history" className="space-y-3">
          <h2 id="history" className="text-base font-semibold">
            Payment history
          </h2>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="border-b border-border text-left text-[13px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 tabular-nums">{date(p.createdAt)}</td>
                    <td className="px-4 py-2">Freemius</td>
                    <td className="px-4 py-2 tabular-nums">{formatMoney(p.amountMinor, p.currency)}</td>
                    <td className="px-4 py-2 capitalize">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
