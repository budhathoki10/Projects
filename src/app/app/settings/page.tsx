import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { DeleteAccountForm } from "@/components/auth-forms";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="max-w-3xl space-y-12">
      <PageHeader title="Settings" subtitle={`${user.name} · ${user.email}`} />
      <section className="border-t border-border pt-8">
        <h2 className="text-base font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">
          A copy of everything you&apos;ve given us: your profile, every job, tailored CV, cover letter and interview note, as one JSON file.
        </p>
        <a href="/app/settings/export" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
          Download my data
        </a>
      </section>
      <section className="border-t border-border pt-8">
        <h2 className="text-base font-semibold">Delete account</h2>
        <div className="mt-3">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
