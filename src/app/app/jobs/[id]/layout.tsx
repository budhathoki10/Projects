import Link from "next/link";
import { notFound } from "next/navigation";
import { JobTabs } from "@/components/job-tabs";
import { StatusControl } from "@/components/status-control";
import { requireUser } from "@/lib/auth/session";
import { isStatus, ownedJob } from "@/lib/services/jobs";

export default async function JobLayout({ children, params }: LayoutProps<"/app/jobs/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const job = await ownedJob(user.id, id);
  if (!job) notFound();
  const facts = [job.post.company, job.post.location, job.post.salary].filter(Boolean);
  return (
    <div className="space-y-8">
      <div className="print:hidden">
        <Link href="/app/jobs" className="text-[13px] text-muted hover:text-foreground">
          Jobs
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{job.post.title || "Untitled job"}</h1>
            {facts.length > 0 && <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p>}
          </div>
          <StatusControl key={`${job.status}-${job.interviewOn}`} jobId={job.id} status={isStatus(job.status) ? job.status : "saved"} interviewOn={job.interviewOn} />
        </div>
      </div>
      <JobTabs jobId={job.id} />
      {children}
    </div>
  );
}
