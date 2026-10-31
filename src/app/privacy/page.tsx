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
          anything else you include. We keep the original file so you can download it with its formatting unchanged. Files awaiting import confirmation expire after one hour.
        </li>
        <li>
          <strong>Your job hunt:</strong> job posts you add, match results, tailored CVs, cover letters, interview questions and your practice answers,
          application statuses and notes.
          This includes application plans, learning progress and work sample links, mock interview conversations, and coaching reports.
        </li>
        <li>
          <strong>Payments:</strong> your subscription, when you paid and how much. Card details go to Freemius; we never receive them.
        </li>
        <li>
          <strong>Security:</strong> a session cookie that keeps you logged in. No advertising or tracking cookies.
        </li>
      </ul>

      <h2>Who processes data for us</h2>
      <ul>
        <li>Our hosting and database providers, to run the service.</li>
        <li>
          OpenRouter, which passes your request to the AI model that reads CVs and job posts and writes suggestions. Your content is sent only to
          produce your results, and we ask OpenRouter to use only model providers that don&apos;t store prompts or train on them.
        </li>
        <li>Job sites you link to, which we fetch once to read the post.</li>
        <li>Resend, to send account emails and follow-up reminders.</li>
        <li>Freemius, to take payments.</li>
      </ul>
      <p>We don&apos;t sell or share your data with employers, recruiters or advertisers.</p>

      <h2>How long we keep it</h2>
      <p>
        As long as your account exists. When you delete your account, your profile, jobs, documents and everything else are deleted straight away.
        Payment records may be kept by Freemius as its laws require.
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
