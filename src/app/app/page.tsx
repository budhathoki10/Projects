import type { Metadata } from "next";
import Link from "next/link";
import { followUpAction } from "@/app/actions/jobs";
import { Badge, Button, ButtonLink, Eyebrow, FormMessage, scoreTone } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { limitsFor } from "@/lib/plans";
import { dueFollowUps, listJobs, progress, STATUS_LABELS, isStatus } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { usageThisMonth } from "@/lib/services/usage";

export const metadata: Metadata = { title: "Today" };

export default async function Today({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const [{ verified, reset }, profile, jobs, due, stats, usage] = await Promise.all([
    searchParams,
    getProfile(user.id),
    listJobs(user.id),
    dueFollowUps(user.id),
    progress(user.id),
    usageThisMonth(user.id),
  ]);
  const ready = profileReady(profile);
  const limits = limitsFor(user);
  const recent = jobs.filter((j) => j.status === "saved" || j.status === "interview").slice(0, 6);
  const firstName = (profile?.name || user.name).split(" ")[0];

  return (
    <div className="space-y-10">
      <FormMessage
        success={verified === "1" ? "Email confirmed." : reset === "1" ? "Password changed. You're logged in." : null}
        error={verified === "0" ? "That confirmation link has expired or was already used. Use “Send it again” above for a fresh one." : null}
      />
      <div>
        <Eyebrow>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Hi {firstName}</h1>
      </div>

      {!ready ? (
        <section className="rounded-md border border-border bg-surface p-6">
          <h2 className="font-serif text-2xl font-medium">First, your CV</h2>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Upload it once. Every tailored CV, cover letter and interview question is built from it, and nothing else.
          </p>
          <div className="mt-4">
            <ButtonLink href="/app/profile">Add your CV</ButtonLink>
          </div>
        </section>
      ) : jobs.length === 0 ? (
        <section className="rounded-md border border-border bg-surface p-6">
          <h2 className="font-serif text-2xl font-medium">Now, a job you want</h2>
          <p className="mt-1.5 max-w-xl text-sm text-muted">Paste a link or the description of any job, and see how well your CV fits it before you apply.</p>
          <div className="mt-4">
            <ButtonLink href="/app/jobs">Add a job</ButtonLink>
          </div>
        </section>
      ) : null}

      {due.length > 0 && (
        <section aria-labelledby="follow-ups">
          <h2 id="follow-ups" className="mb-3 font-serif text-2xl font-medium">
            Worth a follow-up
          </h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {due.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/app/jobs/${j.id}`} className="font-medium underline-offset-4 hover:underline">
                    {j.post.title || "Untitled job"}
                  </Link>
                  <p className="text-[13px] text-muted">
                    {j.post.company && `${j.post.company} · `}applied {j.appliedOn ? formatDay(j.appliedOn) : ""}, no answer yet
                  </p>
                </div>
                <form action={followUpAction} className="flex items-center gap-1">
                  <input type="hidden" name="jobId" value={j.id} />
                  <ButtonLink href={`/app/jobs/${j.id}`} className="py-1">
                    See the message
                  </ButtonLink>
                  <Button type="submit" name="op" value="done" variant="secondary" className="py-1">
                    Done
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready && jobs.length > 0 && (
        <dl aria-label="This week" className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-surface md:grid-cols-4">
          {[
            { id: "applied-week", label: "Applied this week", value: String(stats.appliedThisWeek) },
            { id: "waiting", label: "Waiting to hear", value: String(stats.waiting) },
            { id: "interviews", label: "Interviews", value: String(stats.interviews) },
            { id: "response", label: "Response rate", value: stats.responseRate === null ? "–" : `${stats.responseRate}%` },
          ].map((s, i) => (
            <div key={s.id} className={`px-5 py-4 ${i % 2 ? "border-l border-border" : ""} ${i > 1 ? "border-t border-border md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
              <dt className="text-[13px] text-muted">{s.label}</dt>
              <dd data-testid={`stat-${s.id}`} className="mt-1 font-mono text-2xl tabular-nums">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-medium">In progress</h2>
            <Link href="/app/jobs" className="text-sm underline underline-offset-4">
              All jobs
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((j) => (
              <li key={j.id}>
                <Link href={`/app/jobs/${j.id}`} className="block h-full rounded-md border border-border bg-surface p-4 hover:border-strong-border">
                  <p className="truncate font-medium">{j.post.title || "Untitled job"}</p>
                  <p className="truncate text-[13px] text-muted">{j.post.company || "Company not stated"}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    {j.match && <Badge tone={scoreTone(j.match.score)}>{j.match.score}% match</Badge>}
                    <span className="text-muted">{isStatus(j.status) ? STATUS_LABELS[j.status] : j.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready && (
        <p className="text-[13px] text-muted">
          This month: {usage.tailor} of {limits.tailor} tailored CVs, {usage.cover} of {limits.cover} cover letters, {usage.interview} of {limits.interview} interview
          sessions.{" "}
          {limits.tailor < 100 && (
            <Link href="/app/billing" className="text-foreground underline underline-offset-4">
              Get a Job-hunt pass
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
