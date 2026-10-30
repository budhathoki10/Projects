import type { Metadata } from "next";
import Link from "next/link";
import { AddJobForm } from "@/components/add-job-form";
import { Badge, Eyebrow, scoreTone } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { listJobs, STATUS_LABELS, STATUSES, type Status } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  const user = await requireUser();
  const jobs = await listJobs(user.id);
  const by = (s: Status) => jobs.filter((j) => j.status === s);

  return (
    <div className="space-y-10">
      <div>
        <Eyebrow>Your applications</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Jobs</h1>
      </div>

      <section className="max-w-2xl rounded-md border border-border bg-surface p-5">
        <h2 className="mb-3 font-medium">Add a job</h2>
        <AddJobForm />
      </section>

      {jobs.length === 0 ? (
        <p className="rounded-md border border-dashed border-strong-border px-6 py-10 text-center text-muted">
          No jobs yet. Add one you&apos;re thinking of applying for, and we&apos;ll check how well your CV fits it.
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <div className="grid min-w-[56rem] grid-cols-5 gap-3">
            {STATUSES.map((s) => (
              <section key={s} aria-labelledby={`col-${s}`} className="min-w-0">
                <h2 id={`col-${s}`} className="mb-2 flex items-baseline justify-between text-[13px] font-medium">
                  {STATUS_LABELS[s]}
                  <span className="font-mono text-muted">{by(s).length}</span>
                </h2>
                <ul className="space-y-2">
                  {by(s).map((j) => (
                    <li key={j.id}>
                      <Link href={`/app/jobs/${j.id}`} className="block rounded-md border border-border bg-surface p-3 hover:border-strong-border">
                        <p className="truncate text-sm font-medium">{j.post.title || "Untitled job"}</p>
                        <p className="truncate text-[13px] text-muted">{j.post.company || "Company not stated"}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                          {j.match ? <Badge tone={scoreTone(j.match.score)}>{j.match.score}% match</Badge> : <span />}
                          {j.appliedOn && <span>Applied {formatDay(j.appliedOn)}</span>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
