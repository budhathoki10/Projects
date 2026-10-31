import type { Metadata } from "next";
import Link from "next/link";
import { AddJobForm } from "@/components/add-job-form";
import { JobsSearch } from "@/components/jobs-search";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { JobMatchBadge } from "@/components/job-match-badge";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { isStatus, listJobs, STATUS_LABELS, STATUSES, type Status } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Jobs" };

const chip = (active: boolean) =>
  `inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-[13px] transition-colors duration-150 max-sm:h-10 ${
    active ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-hover hover:text-foreground"
  }`;

export default async function JobsPage({ searchParams }: PageProps<"/app/jobs">) {
  const user = await requireUser();
  const { q: rawQuery, status: rawStatus, view } = await searchParams;
  const board = view === "board";
  const q = (typeof rawQuery === "string" ? rawQuery : "").trim().slice(0, 100);
  const only: Status | null = typeof rawStatus === "string" && isStatus(rawStatus) ? rawStatus : null;

  const all = await listJobs(user.id);
  const needle = q.toLowerCase();
  const matches = all.filter((j) => !needle || `${j.post.title} ${j.post.company}`.toLowerCase().includes(needle));
  const shown = only ? matches.filter((j) => j.status === only) : matches;
  const countOf = (s: Status) => matches.filter((j) => j.status === s).length;
  const href = (status: Status | null) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (board) p.set("view", "board");
    return p.size ? `/app/jobs?${p}` : "/app/jobs";
  };

  const card = (j: (typeof all)[number]) => (
    <li key={j.id}>
      <Link
        href={`/app/jobs/${j.id}`}
        className="block rounded-md border border-border bg-surface p-3 transition-colors duration-150 hover:border-strong-border hover:bg-surface-hover"
      >
        <p className="text-sm font-semibold leading-relaxed" title={j.post.title}>
          {j.post.title || "Untitled job"}
        </p>
        <p className="truncate text-[13px] text-muted" title={j.post.company}>
          {j.post.company || "Company not stated"}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
          <JobMatchBadge post={j.post} match={j.match} />
          {j.appliedOn && <span className="tabular-nums">Applied {formatDay(j.appliedOn)}</span>}
        </div>
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Your application workspace" title="Jobs" description={all.length ? `${all.length} opportunit${all.length === 1 ? "y" : "ies"}, from the first look to the final answer.` : "Save a role you care about. Build a considered application around it."} />

      <section aria-labelledby="add-job" className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 id="add-job" className="mb-3 text-base font-semibold">
          Add a job
        </h2>
        <AddJobForm />
      </section>

      {all.length === 0 ? (
        <EmptyState title="No jobs yet">Add one you’re thinking of applying for, and we’ll check how well your CV fits it. It takes a link or a pasted description.</EmptyState>
      ) : (
        <section aria-label="Your jobs" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <JobsSearch />
            <nav aria-label="Filter by status" className="flex max-w-full flex-wrap gap-1">
              <Link href={href(null)} className={chip(!only)} aria-current={!only ? "true" : undefined}>
                All <span className="tabular-nums opacity-70">{matches.length}</span>
              </Link>
              {STATUSES.map((s) => (
                <Link key={s} href={href(s)} className={chip(only === s)} aria-current={only === s ? "true" : undefined}>
                  {STATUS_LABELS[s]} <span className="tabular-nums opacity-70">{countOf(s)}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="text-xs text-muted">{shown.length} {shown.length === 1 ? "opportunity" : "opportunities"}{only ? ` · ${STATUS_LABELS[only]}` : " · All stages"}</p>
            <nav aria-label="Job view" className="inline-flex rounded-md border border-border bg-surface p-0.5">
              {[false, true].map((showBoard) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (only) params.set("status", only);
                if (showBoard) params.set("view", "board");
                return <Link key={String(showBoard)} href={params.size ? `/app/jobs?${params}` : "/app/jobs"} aria-current={board === showBoard ? "true" : undefined} className={`rounded px-3 py-1.5 text-xs font-medium ${board === showBoard ? "bg-sunken text-foreground" : "text-muted hover:text-foreground"}`}>{showBoard ? "Board" : "List"}</Link>;
              })}
            </nav>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              title={q ? `No jobs match “${q}”` : `Nothing under ${only ? STATUS_LABELS[only] : "this filter"}`}
              action={
                <Link href="/app/jobs" className="text-sm font-medium text-accent hover:underline">
                  Clear filters
                </Link>
              }
            >
              Try a different word, or look at every status.
            </EmptyState>
          ) : !board ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {shown.map((j) => <li key={j.id}>
                <Link href={`/app/jobs/${j.id}`} className="group flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5 transition-colors hover:bg-surface-hover sm:flex-nowrap">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-background text-sm font-semibold text-muted" aria-hidden="true">{(j.post.company || j.post.title || "J").slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 basis-[60%] sm:basis-auto"><span className="block text-sm font-semibold leading-relaxed group-hover:text-accent">{j.post.title || "Untitled job"}</span><span className="mt-1 block text-xs text-muted">{[j.post.company || "Company not stated", j.post.location].filter(Boolean).join(" · ")}</span></span>
                  <span className="flex flex-wrap items-center gap-3"><JobMatchBadge post={j.post} match={j.match} /><Badge>{isStatus(j.status) ? STATUS_LABELS[j.status] : j.status}</Badge></span>
                  <span className="hidden text-faint sm:block" aria-hidden="true">↗</span>
                </Link>
              </li>)}
            </ul>
          ) : only ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{shown.map(card)}</ul>
          ) : (
            <div className="grid gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-5">
              {STATUSES.map((s) => {
                const col = shown.filter((j) => j.status === s);
                return (
                  <section key={s} aria-labelledby={`col-${s}`} className="min-w-0">
                    <h2 id={`col-${s}`} className="mb-2 flex items-baseline justify-between text-[13px] font-medium">
                      {STATUS_LABELS[s]}
                      <span className="font-mono text-muted tabular-nums">{col.length}</span>
                    </h2>
                    {col.length ? <ul className="space-y-2">{col.map(card)}</ul> : <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-faint">None</p>}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
