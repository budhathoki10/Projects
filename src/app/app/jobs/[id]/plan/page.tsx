import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
const labels = { shown: "Demonstrated in CV", listed: "Listed, needs evidence", missing: "Not evidenced in CV", unclear: "Needs verification" };

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
  return <div className="space-y-7 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Your application plan</h2><p className="mt-1 max-w-2xl text-sm text-muted">Build the strongest truthful application, then practise the gaps that matter.</p></div><ButtonLink href="/app/strategy" variant="secondary" size="sm">Compare saved jobs</ButtonLink></div>
    {stale && <p role="alert" className="rounded-md bg-warning-soft p-4 text-sm text-warning">Your CV or job description has changed. This previous analysis is shown for reference; refresh it before using its recommendations.</p>}
    {!plan || stale ? <PlanBuilder jobId={id} exists={!!plan} companyUrl={plan?.company.sources[0]?.url} /> : null}
    {plan && <>
      <section aria-label="Evidence-based fit" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted">CV evidence coverage</p><p className="mt-1 text-4xl font-semibold tabular-nums">{plan.fit.score}<span className="text-lg text-muted">/100</span></p></div><Badge tone={plan.fit.priority === "apply" ? "good" : "warn"}>{plan.fit.priority === "apply" ? "Prioritise applying" : plan.fit.priority === "prepare" ? "Prepare before applying" : "A substantial stretch"}</Badge></div>
        <p className="mt-4 text-sm leading-relaxed text-muted">{plan.fit.explanation}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">{([["Demonstrated", plan.fit.shown], ["Only listed", plan.fit.listed], ["Missing evidence", plan.fit.missing], ["Verify", plan.fit.unclear]] as const).map(([label, count]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-xl font-medium tabular-nums">{count}</dd></div>)}</dl>
        <p className="mt-4 text-xs text-muted">{plan.method === "ai" ? "AI-assisted analysis with source-checked quotations and a deterministic score." : "Local evidence analysis · AI analysis was unavailable. Review inferred categories and unresolved requirements manually."}</p>
      </section>
      <div className="flex flex-wrap gap-2"><ButtonLink href={`/app/jobs/${id}/cv`}>Prepare tailored CV</ButtonLink><ButtonLink href={`/app/jobs/${id}/cover-letter`} variant="secondary">Prepare letter & email</ButtonLink><ButtonLink href={`/app/jobs/${id}/interview`} variant="secondary">Practise interview</ButtonLink></div>
      <section aria-labelledby="requirement-map"><h2 id="requirement-map" className="mb-3 text-base font-semibold">Every requirement and its evidence</h2><ol className="divide-y divide-border rounded-lg border border-border bg-surface">{plan.requirements.map((r) => <li key={r.id} className="space-y-2 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2"><Badge tone={r.status === "shown" ? "good" : r.status === "missing" ? "bad" : "warn"}>{labels[r.status]}</Badge><span className="text-xs text-muted">{r.priority === "must" ? "Required" : "Preferred"} · {r.category}</span></div><p className="text-sm font-medium">{r.text}</p><p className="text-sm text-muted">{r.explanation}</p>{r.evidence.length > 0 && <details><summary className="cursor-pointer py-1 text-xs font-medium text-accent">Review CV evidence</summary><ul className="mt-2 space-y-2 border-l-2 border-border pl-3">{r.evidence.map((e, i) => <li key={i} className="text-xs leading-relaxed text-muted">{e}</li>)}</ul></details>}</li>)}</ol></section>
      <section aria-labelledby="learning-roadmap" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="learning-roadmap" className="text-base font-semibold">Your priority learning roadmap</h2><p className="text-xs text-muted">{complete} of {plan.roadmap.length} practice tasks recorded</p></div>
        <p className="text-sm text-muted">Practice completion is self-reported. It does not establish professional proficiency or automatically change your CV or fit score.</p>
        {!plan.roadmap.length && <p className="rounded-md border border-border p-4 text-sm text-muted">No priority evidence gaps were found in the mapped requirements. Verify eligibility and prepare examples of your strongest work.</p>}
        {plan.roadmap.map((task, index) => (
          <article key={task.id} className="rounded-lg border border-border bg-surface">
            <details open={index === 0}>
              <summary className="cursor-pointer p-5">
                <span className="text-xs text-muted">Priority {index + 1} · {task.priority === "must" ? "Required" : "Preferred"}{row?.progress[task.id]?.completed ? " · Practice recorded" : ""}</span>
                <h3 className="mt-1 inline font-semibold"> {task.skill}</h3>
                <p className="mt-2 text-sm text-muted">{task.reason}</p>
              </summary>
              <div className="space-y-4 px-5 pb-5">
                <ol className="list-decimal space-y-2 pl-5 text-sm">{task.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                <div><h4 className="text-sm font-medium">Practical work</h4><p className="mt-1 text-sm leading-relaxed text-muted">{task.exercise}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{task.acceptance.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
                <p className="text-xs text-muted">{task.effort}</p>
                {task.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-accent underline underline-offset-4">{resource.title} ↗</a>)}
                <details><summary className="cursor-pointer py-2 text-sm font-medium">How to explain this honestly in an interview</summary><p className="mt-2 text-sm leading-relaxed text-muted">{task.interviewExplanation}</p></details>
                {!stale && <LearningTaskForm jobId={id} taskId={task.id} progress={row?.progress[task.id]} />}
              </div>
            </details>
          </article>
        ))}
      </section>
      <section className="space-y-3"><h2 className="text-base font-semibold">Expectations to clarify</h2>{plan.expectations.map((e, i) => <div key={i} className="rounded-md border border-border p-4"><p className="text-xs font-medium text-warning">Inference to discuss, not a verified hiring rule</p><p className="mt-1 text-sm">{e.text}</p><p className="mt-2 text-xs text-muted">From the description: “{e.quote}”</p></div>)}</section>
      <section className="space-y-3"><h2 className="text-base font-semibold">Company research</h2><p className="text-sm text-muted">{plan.company.warning}</p>{plan.company.facts.map((fact, index) => { const source = plan.company.sources.find((s) => s.id === fact.sourceId); return <blockquote key={index} className="border-l-2 border-border pl-4"><p className="text-xs text-muted">{fact.category} · Company’s own statement</p><p className="mt-1 text-sm leading-relaxed">“{fact.quote}”</p>{source && <a className="mt-1 block break-words text-xs text-accent underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗ · Read {source.retrievedAt.slice(0, 10)} (UTC)</a>}</blockquote>; })}{!plan.company.facts.length && <p className="text-sm text-muted">No verified company excerpts. Use the company website field to add a source; we do not infer its stack or culture from the job title.</p>}</section>
      <section className="space-y-3"><h2 className="text-base font-semibold">Application questions</h2><p className="text-sm text-muted">These are honest starting drafts. Fill every bracket with your own reasons and facts before sending.</p>{plan.applicationAnswers.map((a) => <article key={a.question} className="rounded-lg border border-border bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{a.question}</h3><CopyButton text={a.answer} /></div><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{a.answer}</p></article>)}</section>
      {!stale && <details className="rounded-lg border border-border"><summary className="cursor-pointer p-4 text-sm font-medium">Update company sources or refresh analysis</summary><PlanBuilder jobId={id} exists companyUrl={plan.company.sources[0]?.url} /></details>}
      <Link href="/app/profile" className="inline-block text-sm text-accent underline underline-offset-4">Review your source CV before adding any new evidence</Link>
    </>}
  </div>;
}
