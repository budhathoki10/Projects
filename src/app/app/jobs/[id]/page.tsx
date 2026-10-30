import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followUpAction, removeJob, saveNotes } from "@/app/actions/jobs";
import { Button, ButtonLink, Eyebrow, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { highlight } from "@/lib/match/highlight";
import { scoreLabel, scoreMatch } from "@/lib/match/score";
import { today } from "@/lib/plans";
import { ownedJob } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { followUpMessage } from "@/lib/tailor/follow-up";

export const metadata: Metadata = { title: "Match" };

const STATUS_COPY = {
  shown: { label: "You show this", cls: "text-money" },
  listed: { label: "Only in your skills list", cls: "text-foreground" },
  missing: { label: "Not in your CV", cls: "text-pen" },
} as const;

export default async function MatchTab({ params }: PageProps<"/app/jobs/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile] = await Promise.all([ownedJob(user.id, id), getProfile(user.id)]);
  if (!job) notFound();
  const ready = profileReady(profile);
  // Scored live, so edits to the profile show up straight away. It's plain code and fast.
  const match = ready ? scoreMatch(profile, job.post) : null;
  const due = job.status === "applied" && job.followUpOn && job.followUpOn <= today();
  const nudge = followUpMessage({ name: profile?.name || user.name, title: job.post.title, company: job.post.company, appliedOn: job.appliedOn });
  const listed = match?.requirements.filter((r) => r.status === "listed").length ?? 0;
  const missing = match?.requirements.filter((r) => r.status === "missing" && r.kind === "must").length ?? 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-10">
        {!match ? (
          <div className="rounded-xl border border-dashed border-strong-border px-6 py-8">
            <p className="mb-4 text-muted">Add your CV to see how well you match this job.</p>
            <ButtonLink href="/app/profile">Add your CV</ButtonLink>
          </div>
        ) : (
          <>
            <section className="flex flex-wrap items-end gap-x-10 gap-y-4 border-b border-border pb-8">
              <div>
                <p className="font-mono text-5xl font-medium tabular-nums tracking-tight" data-testid="match-score">
                  {match.score}
                  <span className="text-lg text-muted">%</span>
                </p>
                <div className="mt-2 flex w-40 gap-[3px]" aria-hidden="true">
                  {Array.from({ length: 20 }, (_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-[1px] ${i < Math.round(match.score / 5) ? "bg-ink" : "bg-border"}`} />
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-2xl font-medium leading-tight">{scoreLabel(match.score)}</p>
                <p className="mt-1 text-sm text-muted">
                  {missing > 0 ? `${missing} must-have${missing === 1 ? "" : "s"} not in your CV. ` : "Nothing essential is missing. "}
                  {listed > 0 ? `${listed} only appear${listed === 1 ? "s" : ""} in your skills list, which is weaker than showing where you used ${listed === 1 ? "it" : "them"}.` : ""}
                </p>
              </div>
              <ButtonLink href={`/app/jobs/${job.id}/cv`}>Tailor my CV</ButtonLink>
            </section>

            <section>
              <h2 className="mb-3 font-serif text-2xl font-medium">What they ask for</h2>
              {match.requirements.length === 0 ? (
                <p className="text-sm text-muted">We couldn&apos;t find a clear list of requirements in this post. The keywords below are what we matched on.</p>
              ) : (
                <ol className="divide-y divide-border border-y border-border">
                  {match.requirements.map((r, i) => (
                    <li key={i} className="grid gap-1 py-3 sm:grid-cols-[1fr_11rem] sm:gap-4">
                      <div className="min-w-0">
                        <p className="text-sm">
                          {r.text}
                          {r.kind === "nice" && <span className="ml-2 text-xs text-muted">nice to have</span>}
                        </p>
                        {r.evidence && <p className="mt-1 truncate text-[13px] text-muted">From your CV: {r.evidence}</p>}
                      </div>
                      <p className={`text-[13px] font-medium sm:text-right ${STATUS_COPY[r.status].cls}`}>{STATUS_COPY[r.status].label}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h2 className="mb-1 font-serif text-2xl font-medium">The post</h2>
              <p className="mb-4 text-[13px] text-muted">
                <span className="marker">Highlighted</span>: you show it. <span className="underline decoration-dotted underline-offset-4">Dotted</span>: only in your skills
                list. <span className="pen-mark">Red</span>: not in your CV.
              </p>
              <div className="max-h-[36rem] overflow-y-auto whitespace-pre-line rounded-xl border border-border bg-surface shadow-1 p-5 text-sm leading-relaxed">
                {highlight(job.postText, match.keywords).map((s, i) =>
                  s.mark === "shown" ? (
                    <mark key={i} className="marker bg-transparent text-inherit">
                      {s.text}
                    </mark>
                  ) : s.mark === "listed" ? (
                    <span key={i} className="underline decoration-dotted underline-offset-4">
                      {s.text}
                    </span>
                  ) : s.mark === "missing" ? (
                    <span key={i} className="pen-mark">
                      {s.text}
                    </span>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
        {due && (
          <section className="border-l-2 border-ink pl-3">
            <Eyebrow>Follow up</Eyebrow>
            <p className="mt-1.5 text-sm">
              It&apos;s been a week since you applied{job.appliedOn ? ` on ${formatDay(job.appliedOn)}` : ""}. A short note often gets things moving.
            </p>
            <textarea readOnly rows={8} aria-label="Follow-up message" value={`${nudge.subject}\n\n${nudge.body}`} className={`${inputClass} mt-2 text-[13px]`} />
            <form action={followUpAction} className="mt-2 flex flex-wrap gap-2">
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit" name="op" value="done" variant="secondary" className="py-1">
                I followed up
              </Button>
              <Button type="submit" name="op" value="later" variant="ghost" className="py-1">
                Remind me later
              </Button>
            </form>
          </section>
        )}

        <section className="space-y-2 text-sm">
          <Eyebrow>About this job</Eyebrow>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate underline underline-offset-4">
              Original post
            </a>
          )}
          {job.post.summary && <p className="text-muted">{job.post.summary}</p>}
          <p className="text-[13px] text-muted">
            Added {formatDay(job.createdAt)}
            {job.appliedOn && ` · applied ${formatDay(job.appliedOn)}`}
          </p>
        </section>

        <form action={saveNotes} className="space-y-2">
          <label htmlFor="notes" className="block">
            <Eyebrow>Notes</Eyebrow>
          </label>
          <input type="hidden" name="jobId" value={job.id} />
          <textarea id="notes" name="notes" rows={4} defaultValue={job.notes ?? ""} placeholder="Recruiter's name, salary talk, interview dates…" className={inputClass} />
          <Button type="submit" variant="secondary" className="py-1">
            Save notes
          </Button>
        </form>

        <form action={removeJob} className="border-t border-border pt-6">
          <input type="hidden" name="jobId" value={job.id} />
          <button type="submit" className="text-[13px] text-muted hover:text-pen">
            Delete this job
          </button>
          <p className="mt-1 text-xs text-muted">Removes its tailored CV, cover letter and interview notes too.</p>
        </form>
        <p className="text-xs text-muted">
          <Link href="/app/profile" className="underline underline-offset-4">
            Edit your CV
          </Link>{" "}
          to change what counts as shown.
        </p>
      </aside>
    </div>
  );
}
