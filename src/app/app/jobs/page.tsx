import type { Metadata } from "next";
import { AddJobForm } from "@/components/add-job-form";
import { JobsBoard } from "@/components/jobs-board";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { preparedJobIds } from "@/lib/services/documents";
import { isStatus, listJobs } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/app/jobs">) {
  const user = await requireUser();
  const [{ add }, jobs, prepared] = await Promise.all([searchParams, listJobs(user.id), preparedJobIds(user.id)]);

  return (
    <div className="space-y-8">
      <header>
        <Eyebrow>Your applications</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Jobs</h1>
      </header>

      <section id="add" className="max-w-2xl scroll-mt-24 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-medium">Add a job</h2>
        <AddJobForm autoFocus={add === "1"} />
      </section>

      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-strong-border px-6 py-10 text-center text-muted">
          No jobs yet. Add one you&apos;re thinking of applying for, and we&apos;ll check how well your CV fits it.
        </p>
      ) : (
        <JobsBoard
          jobs={jobs.map((j) => ({
            id: j.id,
            title: j.post.title,
            company: j.post.company,
            status: isStatus(j.status) ? j.status : "saved",
            score: j.match?.score ?? null,
            appliedOn: j.appliedOn,
            createdAt: j.createdAt.toISOString(),
            tailored: prepared.tailored.has(j.id),
          }))}
        />
      )}
    </div>
  );
}
