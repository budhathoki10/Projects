import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { progress } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const s = await progress(user.id);
  const rows = [
    { label: "Jobs saved", value: s.saved, note: "Everything you've added." },
    { label: "Applications sent", value: s.applied, note: `${s.appliedThisWeek} in the last 7 days.` },
    { label: "Waiting to hear", value: s.waiting, note: "We'll nudge you to follow up a week after each one." },
    { label: "Interviews", value: s.interviews, note: "Including those that became offers." },
    { label: "Offers", value: s.offers, note: "" },
  ];
  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <Eyebrow>Your job hunt</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Progress</h1>
        <p className="mt-1.5 text-sm text-muted">Job hunting is mostly waiting. This is the part you control.</p>
      </div>
      <dl className="divide-y divide-border border-y border-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-4">
            <dt>
              <p className="font-medium">{r.label}</p>
              {r.note && <p className="text-[13px] text-muted">{r.note}</p>}
            </dt>
            <dd className="font-mono text-3xl tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="font-medium">Response rate: {s.responseRate === null ? "not yet" : `${s.responseRate}%`}</h2>
        <p className="mt-1 text-sm text-muted">
          {s.responseRate === null
            ? "Once you've applied for a few jobs, this shows how many answered at all, yes or no."
            : s.responseRate < 10 && s.applied >= 10
              ? "Under 1 in 10 is common for applications sent through job boards. Tailoring each CV and following up after a week both help, and so does applying earlier in a post's life."
              : "That's the share of applications that got any answer. Most people hear back from fewer than 1 in 5, so this is worth keeping an eye on rather than worrying about."}
        </p>
      </section>
    </div>
  );
}
