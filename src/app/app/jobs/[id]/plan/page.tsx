import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PlanBuilder, LearningTaskForm } from "@/components/career/plan-controls";
import { CopyButton } from "@/components/copy-button";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { careerFingerprint } from "@/lib/career/evidence";
import { jobHasCriteria } from "@/lib/jobs/quality";
import { getCareerPlan } from "@/lib/services/career";
import { ownedJob } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Application plan" };

const STATUS = {
  shown: { label: "Shown", dot: "bg-success" },
  listed: { label: "Listed only", dot: "bg-warning" },
  missing: { label: "Missing", dot: "bg-danger" },
  unclear: { label: "Verify", dot: "bg-faint" },
} as const;

const summaryRow = "flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-hover [&::-webkit-details-marker]:hidden";
const chevron = (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-faint transition-transform duration-150 group-open:rotate-90">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** A titled, closed-by-default panel row: the detail is one click away instead of on the page. */
function More({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <details className="group">
      <summary className={summaryRow}>
        <span className="flex-1 font-medium">{title}</span>
        {count !== undefined && <span className="text-xs tabular-nums text-muted">{count}</span>}
        {chevron}
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );
}

export default async function ApplicationPlanPage({ params }: PageProps<"/app/jobs/[id]/plan">) {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile, row] = await Promise.all([ownedJob(user.id, id), getProfile(user.id), getCareerPlan(user.id, id)]);
  if (!job) notFound();
  if (!profileReady(profile)) return <EmptyState title="Add your CV first" action={<ButtonLink href="/app/profile">Add CV</ButtonLink>}>The plan needs your actual experience and projects.</EmptyState>;
  if (!jobHasCriteria(job.post)) return <EmptyState title="Add the complete description" action={<ButtonLink href={`/app/jobs/${id}#job-description`}>Add job description</ButtonLink>}>A title or search-results page cannot establish the employer’s requirements.</EmptyState>;
  const stale = !!row && row.plan.fingerprint !== careerFingerprint({ profile, post: job.post, postText: job.postText });
  const plan = row?.plan;
  const complete = plan?.roadmap.filter((task) => row?.progress[task.id]?.completed).length ?? 0;
  // Required first, then by how much work each needs: missing, needs verifying, listed only, shown.
  const order = { missing: 0, unclear: 1, listed: 2, shown: 3 } as const;
  const requirements = plan ? [...plan.requirements].sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "must" ? -1 : 1) || order[a.status] - order[b.status]) : [];

  return (
    <div className="space-y-5 [overflow-wrap:anywhere]">
      {stale && <p role="alert" className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning">Your CV or the job changed since this plan. Refresh it below.</p>}
      {!plan || stale ? <PlanBuilder jobId={id} exists={!!plan} companyUrl={plan?.company.sources[0]?.url} /> : null}
      {plan && (
        <>
          {/* The answer first: how well you fit, and the three next steps. */}
          <section aria-label="Fit" className="rounded-lg border border-border bg-surface px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <p className="flex cursor-help items-baseline gap-1" title={plan.fit.explanation}>
                <span className="text-3xl font-semibold tabular-nums tracking-tight">{plan.fit.score}</span>
                <span className="text-sm text-muted">/100</span>
              </p>
              <Badge tone={plan.fit.priority === "apply" ? "good" : "warn"}>{plan.fit.priority === "apply" ? "Apply" : plan.fit.priority === "prepare" ? "Prepare first" : "Stretch"}</Badge>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                {(
                  [
                    ["Shown", plan.fit.shown],
                    ["Listed", plan.fit.listed],
                    ["Missing", plan.fit.missing],
                    ["Verify", plan.fit.unclear],
                  ] as const
                ).map(([label, count]) => (
                  <div key={label} className="flex gap-1">
                    <dt>{label}</dt>
                    <dd className="font-medium tabular-nums text-foreground">{count}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <ButtonLink href={`/app/jobs/${id}/cv`} size="sm">
                  Tailor CV
                </ButtonLink>
                <ButtonLink href={`/app/jobs/${id}/cover-letter`} variant="secondary" size="sm">
                  Cover letter
                </ButtonLink>
                <ButtonLink href={`/app/jobs/${id}/interview`} variant="secondary" size="sm">
                  Interview
                </ButtonLink>
              </div>
            </div>
          </section>

          {/* Every requirement on one line; its evidence is one click away. */}
          <section aria-labelledby="requirement-map" className="space-y-2">
            <h2 id="requirement-map" className="text-sm font-semibold">
              Requirements <span className="font-normal text-muted">· {requirements.length}</span>
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {requirements.map((r) => (
                <li key={r.id}>
                  <details className="group">
                    <summary className={summaryRow}>
                      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${STATUS[r.status].dot}`} />
                      <span className="min-w-0 flex-1 truncate" title={r.text}>
                        {r.text}
                      </span>
                      {r.priority === "must" && <span className="hidden text-xs text-faint sm:inline">Required</span>}
                      <span className="w-20 shrink-0 text-right text-xs text-muted">{STATUS[r.status].label}</span>
                      {chevron}
                    </summary>
                    <div className="space-y-2 px-4 pb-3 pl-9 text-[13px] leading-5 text-muted">
                      <p className="text-foreground">{r.text}</p>
                      <p>{r.explanation}</p>
                      {r.evidence.length > 0 && (
                        <ul className="space-y-1.5 border-l-2 border-border pl-3">
                          {r.evidence.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>

          {/* The gaps worth working on, each a closed row until you open it. */}
          <section aria-labelledby="learning-roadmap" className="space-y-2">
            <h2 id="learning-roadmap" className="flex items-baseline justify-between gap-2 text-sm font-semibold">
              <span>
                Gaps to work on <span className="font-normal text-muted">· {plan.roadmap.length}</span>
              </span>
              {plan.roadmap.length > 0 && (
                <span className="text-xs font-normal text-muted" title="Self-reported. It doesn't change your CV or your score.">
                  {complete} of {plan.roadmap.length} practised
                </span>
              )}
            </h2>
            {plan.roadmap.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">No gaps in the required skills. Prepare examples of your strongest work.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {plan.roadmap.map((task) => {
                  const done = !!row?.progress[task.id]?.completed;
                  return (
                    <li key={task.id}>
                      <details className="group">
                        <summary className={summaryRow}>
                          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${done ? "bg-success" : task.priority === "must" ? "bg-danger" : "bg-warning"}`} />
                          <span className="min-w-0 flex-1 truncate font-medium" title={task.skill}>
                            {task.skill}
                          </span>
                          <span className="shrink-0 text-xs text-muted">{done ? "Practised" : task.priority === "must" ? "Required" : "Preferred"}</span>
                          {chevron}
                        </summary>
                        <div className="space-y-3 px-4 pb-4 pl-9 text-[13px] leading-5">
                          <p className="text-muted">{task.reason}</p>
                          <ol className="list-decimal space-y-1 pl-4">
                            {task.steps.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ol>
                          <p className="text-muted">
                            <span className="font-medium text-foreground">Practice: </span>
                            {task.exercise}
                          </p>
                          {task.resources.length > 0 && (
                            <p className="flex flex-wrap gap-x-4 gap-y-1">
                              {task.resources.map((resource) => (
                                <a key={resource.url} href={resource.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
                                  {resource.title} ↗
                                </a>
                              ))}
                            </p>
                          )}
                          {task.acceptance.length > 0 && (
                            <ul className="list-disc space-y-0.5 pl-4 text-muted">
                              {task.acceptance.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          )}
                          <p className="text-muted">
                            <span className="font-medium text-foreground">In the interview: </span>
                            {task.interviewExplanation}
                          </p>
                          <p className="text-xs text-faint">{task.effort}</p>
                          {!stale && <LearningTaskForm jobId={id} taskId={task.id} progress={row?.progress[task.id]} />}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Everything else, folded away. */}
          <section aria-label="More about this application" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            <More title="Application answers" count={plan.applicationAnswers.length}>
              <p className="text-xs text-muted">Starting drafts. Fill every bracket with your own facts before sending.</p>
              {plan.applicationAnswers.map((a) => (
                <article key={a.question} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[13px] font-medium">{a.question}</h3>
                    <CopyButton text={a.answer} />
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[13px] leading-5 text-muted">{a.answer}</p>
                </article>
              ))}
            </More>
            {plan.expectations.length > 0 && (
            <More title="Expectations to clarify" count={plan.expectations.length}>
              {plan.expectations.map((e, i) => (
                <div key={i} className="text-[13px] leading-5">
                  <p>{e.text}</p>
                  <p className="mt-0.5 text-xs text-muted">From the post: “{e.quote}”</p>
                </div>
              ))}
            </More>
            )}
            <More title="Company research" count={plan.company.facts.length}>
              {plan.company.warning && <p className="text-xs text-muted">{plan.company.warning}</p>}
              {plan.company.facts.length === 0 ? (
                <p className="text-[13px] text-muted">No company sources yet. Add the company website under “Refresh”.</p>
              ) : (
                plan.company.facts.map((fact, index) => {
                  const source = plan.company.sources.find((s) => s.id === fact.sourceId);
                  return (
                    <blockquote key={index} className="border-l-2 border-border pl-3 text-[13px] leading-5">
                      <p>“{fact.quote}”</p>
                      {source && (
                        <a className="mt-0.5 block break-words text-xs text-accent hover:underline" href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.title} ↗
                        </a>
                      )}
                    </blockquote>
                  );
                })
              )}
            </More>
            {!stale && (
              <More title="Refresh analysis or company sources">
                <PlanBuilder jobId={id} exists companyUrl={plan.company.sources[0]?.url} />
              </More>
            )}
          </section>

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{plan.method === "ai" ? "AI-assisted, quotes checked against the post" : "Basic analysis: AI was unavailable"}</span>
            <Link href="/app/strategy" className="text-accent hover:underline">
              Compare saved jobs
            </Link>
            <Link href="/app/profile" className="text-accent hover:underline">
              Edit your CV
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
