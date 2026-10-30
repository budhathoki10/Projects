import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        A CV is personal. This page explains what {SITE.name} keeps, why, who else sees it, and how to get it back or delete it. The short version: we use
        your data only to help you apply for jobs, we never sell it, and it isn&apos;t used to train AI models.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your name, email and a securely hashed password (we never see or store the password itself).
        </li>
        <li>
          <strong>Your CV:</strong> the file or text you upload and the profile made from it: contact details, work history, education, skills and
          anything else you include. We keep the profile, not the uploaded file.
        </li>
        <li>
          <strong>Your job hunt:</strong> job posts you add, match results, tailored CVs, cover letters, interview questions and your practice answers,
          application statuses and notes.
        </li>
        <li>
          <strong>Payments:</strong> which pass you bought and when. Card details go to Paddle and Khalti; we never receive them.
        </li>
        <li>
          <strong>Security:</strong> a session cookie that keeps you logged in. No advertising or tracking cookies.
        </li>
      </ul>

      <h2>Who processes data for us</h2>
      <ul>
        <li>Our hosting and database providers, to run the service.</li>
        <li>
          Anthropic, which runs the AI models that read CVs and job posts and write suggestions. Your content is sent to them only to produce your
          results; under Anthropic&apos;s commercial terms it isn&apos;t used to train their models.
        </li>
        <li>Job sites you link to, which we fetch once to read the post.</li>
        <li>Resend, to send account emails and follow-up reminders.</li>
        <li>Paddle and Khalti, to take payments.</li>
      </ul>
      <p>We don&apos;t sell or share your data with employers, recruiters or advertisers.</p>

      <h2>How long we keep it</h2>
      <p>
        As long as your account exists. When you delete your account, your profile, jobs, documents and everything else are deleted straight away.
        Payment records may be kept by Paddle or Khalti as their laws require.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Download everything we hold about you from Settings, as a JSON file.</li>
        <li>Correct your profile at any time.</li>
        <li>Delete your account and all its data from Settings.</li>
        <li>
          For anything else, email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        {SITE.operator}, {SITE.country}. <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
      </p>
    </LegalPage>
  );
}
