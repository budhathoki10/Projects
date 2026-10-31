import type { Metadata } from "next";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { progress } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const s = await progress(user.id);
  const rows = [
    { label: "Jobs saved", value: s.saved, note: "Everything you’ve added." },
    { label: "Applications sent", value: s.applied, note: `${s.appliedThisWeek} in the last 7 days.` },
    { label: "Waiting to hear", value: s.waiting, note: "We’ll nudge you to follow up a week after each one." },
    { label: "Interviews", value: s.interviews, note: "Including those that became offers." },
    { label: "Offers", value: s.offers, note: "" },
  ];
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader eyebrow="Your application history" title="Progress" description="See where your applications stand and what deserves your attention next." actions={<ButtonLink href="/app/strategy" variant="secondary">Learning & interview progress</ButtonLink>} />
      {s.saved === 0 ? (
        <EmptyState title="Nothing to count yet" action={<ButtonLink href="/app/jobs">Add a job</ButtonLink>}>
          Add the jobs you’re considering and mark the ones you apply for. This page shows how it’s going.
        </EmptyState>
      ) : (
        <>
          <dl className="divide-y divide-border rounded-xl border border-border bg-surface px-5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 py-4">
                <dt>
                  <p className="font-medium">{r.label}</p>
                  {r.note && <p className="text-[13px] text-muted">{r.note}</p>}
                </dt>
                <dd className="text-3xl font-semibold tabular-nums">{r.value}</dd>
              </div>
            ))}
          </dl>
          <section className="rounded-md border border-border bg-surface p-5">
            <h2 className="text-base font-semibold">Response rate: {s.responseRate === null ? "not yet" : `${s.responseRate}%`}</h2>
            <p className="mt-1 text-sm text-muted">
              {s.responseRate === null ? "Once you mark an application as sent, this shows how many received an answer." : `Based on ${s.applied} tracked application${s.applied === 1 ? "" : "s"}. Interviews, offers and rejections all count as an answer. Update each job’s status to keep this accurate.`}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
