import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>If Shortlist isn&apos;t helping your job hunt, you can have your money back.</p>

      <h2>14-day money-back guarantee</h2>
      <ul>
        <li>Ask within 14 days of buying a Job-hunt pass and we&apos;ll refund it in full. No questions asked.</li>
        <li>Card payments are refunded by Paddle, our Merchant of Record, to the original payment method, usually within 5 to 10 business days.</li>
        <li>Khalti payments are refunded to the Khalti account that paid.</li>
        <li>The pass ends when the refund is made, and your account returns to the free plan with all your data kept.</li>
      </ul>

      <h2>No renewals to cancel</h2>
      <p>Passes are one-time payments. Nothing renews or charges you again unless you buy another pass yourself.</p>

      <h2>How to ask</h2>
      <p>
        Email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> from the address on your account. Card buyers can also use the link in
        their Paddle receipt.
      </p>
    </LegalPage>
  );
}
