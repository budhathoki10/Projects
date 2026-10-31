import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followUpAction, removeJob } from "@/app/actions/jobs";
import { ConfirmAction } from "@/components/confirm-action";
import { CopyButton } from "@/components/copy-button";
import { JobDescriptionEditor } from "@/components/job-description-editor";
import { jobHasCriteria } from "@/lib/jobs/quality";
import { NotesField } from "@/components/notes-field";
import { SubmitButton } from "@/components/submit-button";
import { ButtonLink, EmptyState, Eyebrow, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { highlight } from "@/lib/match/highlight";
import { scoreLabel, scoreMatch } from "@/lib/match/score";
import { today } from "@/lib/plans";
import { ownedJob } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { followUpMessage } from "@/lib/tailor/follow-up";

export const metadata: Metadata = { title: "Match" };

/** Status is spelled out in words as well as colour, so it doesn't depend on seeing the colour. */
const STATUS_COPY = {
  shown: { label: "You show this", cls: "text-success", mark: "✓" },
  listed: { label: "Only in your skills list", cls: "text-warning", mark: "–" },
  missing: { label: "Not in your CV", cls: "text-danger", mark: "✕" },
} as const;

export default async function MatchTab({ params }: PageProps<"/app/jobs/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile] = await Promise.all([ownedJob(user.id, id), getProfile(user.id)]);
  if (!job) notFound();
  const ready = profileReady(profile);
  // Scored live, so edits to the profile show up straight away. It's plain code and fast.
  const match = ready && jobHasCriteria(job.post) ? scoreMatch(profile, job.post) : null;
  const due = job.status === "applied" && job.followUpOn && job.followUpOn <= today();
  const nudge = followUpMessage({ name: profile?.name || user.name, title: job.post.title, company: job.post.company, appliedOn: job.appliedOn });
  const nudgeText = `${nudge.subject}\n\n${nudge.body}`;
  const listed = match?.requirements.filter((r) => r.status === "listed").length ?? 0;
  const missing = match?.requirements.filter((r) => r.status === "missing" && r.kind === "must").length ?? 0;
  const bar = match ? (match.score >= 70 ? "bg-success" : match.score >= 40 ? "bg-warning" : "bg-danger") : "";

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-10">
        {ready && jobHasCriteria(job.post) && <section className="space-y-3 rounded-lg border border-border bg-surface p-5"><h2 className="text-base font-semibold">Go beyond the keyword check</h2><p className="text-sm text-muted">Map required and preferred skills, qualifications, experience and responsibilities to CV evidence. Review company sources and prepare the most important gaps.</p><ButtonLink href={`/app/jobs/${job.id}/plan`} size="sm">Build your application plan</ButtonLink></section>}
        {!jobHasCriteria(job.post) ? <JobDescriptionEditor jobId={job.id} /> : !match ? (
          <EmptyState title="Add your CV to see how well you match" action={<ButtonLink href="/app/profile">Add your CV</ButtonLink>}>
            The match check compares this post with what’s in your CV, so it needs one to start from.
          </EmptyState>
        ) : (
          <>
            <section className="flex flex-wrap items-end gap-x-10 gap-y-4 border-b border-border pb-8">
              <div>
                <p className="font-mono text-5xl font-medium leading-none tabular-nums tracking-tight" data-testid="match-score">
                  {match.score}
                  <span className="text-lg text-faint">%</span>
                </p>
                <div className="mt-3 flex w-40 gap-[3px]" role="img" aria-label={`${match.score} out of 100`}>
                  {Array.from({ length: 20 }, (_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-[1px] ${i < Math.round(match.score / 5) ? bar : "bg-border"}`} />
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-xs text-muted">Initial keyword guide · not a hiring probability</p><p className="t-title">{scoreLabel(match.score)}</p>
                <p className="mt-1 text-sm text-muted">
                  {missing > 0 ? `${missing} mapped must-have${missing === 1 ? "" : "s"} not in your CV. ` : "No missing keywords found in this initial check. Verify qualifications, duration and eligibility in the application plan. "}
                  {listed > 0 ? `${listed} only appear${listed === 1 ? "s" : ""} in your skills list, which is weaker than showing where you used ${listed === 1 ? "it" : "them"}.` : ""}
                </p>
              </div>
              <ButtonLink href={`/app/jobs/${job.id}/cv`}>Tailor my CV</ButtonLink>
            </section>

            <section>
              <h2 className="mb-3 text-base font-semibold">What they ask for</h2>
              {match.requirements.length === 0 ? (
                <p className="text-sm text-muted">We couldn’t find a clear list of requirements in this post. The highlighted words below are what we matched on.</p>
              ) : (
                <ol className="divide-y divide-border border-y border-border">
                  {match.requirements.map((r, i) => (
                    <li key={i} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-4">
                      <div className="min-w-0">
                        <p className="text-sm">
                          {r.text}
                          {r.kind === "nice" && <span className="ml-2 text-xs text-muted">nice to have</span>}
                        </p>
                        {r.evidence && (
                          <p className="mt-1 truncate text-[13px] text-muted" title={r.evidence}>
                            From your CV: {r.evidence}
                          </p>
                        )}
                      </div>
                      <p className={`flex items-start gap-1.5 text-[13px] font-medium sm:justify-end ${STATUS_COPY[r.status].cls}`}>
                        <span aria-hidden="true" className="w-3 text-center">
                          {STATUS_COPY[r.status].mark}
                        </span>
                        {STATUS_COPY[r.status].label}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h2 className="mb-1 text-base font-semibold">The post</h2>
              <p className="mb-3 text-[13px] text-muted">
                <span className="hl-shown">Highlighted</span>: you show it. <span className="hl-listed">Dotted</span>: only in your skills list. <span className="hl-missing">Red wave</span>: not
                in your CV.
              </p>
              <div className="max-h-[36rem] overflow-y-auto whitespace-pre-line rounded-md border border-border bg-surface p-4 text-sm leading-relaxed sm:p-5">
                {highlight(job.postText, match.keywords).map((s, i) =>
                  s.mark === "shown" ? (
                    <mark key={i} className="hl-shown">
                      {s.text}
                    </mark>
                  ) : s.mark === "listed" ? (
                    <span key={i} className="hl-listed">
                      {s.text}
                    </span>
                  ) : s.mark === "missing" ? (
                    <span key={i} className="hl-missing">
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
          <section className="space-y-2 rounded-md border border-accent/30 bg-accent-soft p-4">
            <Eyebrow>Follow up</Eyebrow>
            <p className="text-sm">It’s been a week since you applied{job.appliedOn ? ` on ${formatDay(job.appliedOn)}` : ""}. A short note often gets things moving.</p>
            <textarea readOnly rows={8} aria-label="Follow-up message" value={nudgeText} className={`${inputClass} text-[13px]`} />
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={nudgeText} label="Copy message" what="Message copied" />
              <form action={followUpAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="jobId" value={job.id} />
                <SubmitButton name="op" value="done" variant="secondary" size="sm">
                  I followed up
                </SubmitButton>
                <SubmitButton name="op" value="later" variant="ghost" size="sm">
                  Remind me later
                </SubmitButton>
              </form>
            </div>
          </section>
        )}

        <section className="space-y-2 text-sm">
          <Eyebrow>About this job</Eyebrow>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-accent hover:underline" title={job.url}>
              Original post
            </a>
          )}
          {job.post.summary && <p className="text-muted">{job.post.summary}</p>}
          <p className="text-[13px] text-muted">
            Added {formatDay(job.createdAt)}
            {job.appliedOn && ` · applied ${formatDay(job.appliedOn)}`}
          </p>
        </section>

        <NotesField jobId={job.id} initial={job.notes ?? ""} />

        <div className="space-y-2 border-t border-border pt-6">
          <ConfirmAction
            trigger="Delete this job"
            title={`Delete “${job.post.title || "Untitled job"}”?`}
            confirmLabel="Delete job"
            pendingLabel="Deleting…"
            action={removeJob}
            fields={{ jobId: job.id }}
          >
            This also removes its tailored CV, cover letter and interview notes. It can’t be undone.
          </ConfirmAction>
        </div>
        <p className="text-xs text-muted">
          <Link href="/app/profile" className="text-accent hover:underline">
            Edit your CV
          </Link>{" "}
          to change what counts as shown.
        </p>
      </aside>
    </div>
  );
}
