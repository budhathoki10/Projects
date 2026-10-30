import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tailorCv, toggleChange } from "@/app/actions/tailor";
import { AiActionButton } from "@/components/ai-action-button";
import { JobCvLook, type LookOption } from "@/components/studio/job-cv-look";
import { Badge, ButtonLink, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { wordDiff } from "@/lib/diff";
import type { Change, Profile } from "@/lib/model/types";
import { limitsFor } from "@/lib/plans";
import { getTailoredCv } from "@/lib/services/documents";
import { ownedJob } from "@/lib/services/jobs";
import { photoUrl } from "@/lib/services/photos";
import { getProfile, profileReady } from "@/lib/services/profile";
import { listMyTemplates, resolveCvStyle } from "@/lib/services/templates";
import { usageThisMonth } from "@/lib/services/usage";
import { applyChanges } from "@/lib/tailor/apply";
import { recommendTemplates } from "@/lib/templates/registry";
import { parseSpec } from "@/lib/templates/spec";

export const metadata: Metadata = { title: "Tailored CV" };

function where(c: Change, profile: Profile) {
  if (c.kind === "summary") return "Summary";
  if (c.kind === "skills-order") return "Skills";
  const e = profile.experience.find((x) => x.id === c.experienceId);
  return e ? `${e.title}${e.company ? `, ${e.company}` : ""}` : "Experience";
}

function Diff({ before, after }: { before: string; after: string }) {
  return (
    <p className="text-sm leading-relaxed">
      {wordDiff(before, after).map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "added" ? (
          <ins key={i} className="marker no-underline">
            {p.text}
          </ins>
        ) : (
          <del key={i} className="text-muted">
            {p.text}
          </del>
        ),
      )}
    </p>
  );
}

function ChangeCard({ c, jobId, profile }: { c: Change; jobId: string; profile: Profile }) {
  const blocked = c.flags.length > 0;
  const exp = "experienceId" in c ? profile.experience.find((e) => e.id === c.experienceId) : undefined;
  return (
    <li className={`rounded-md border p-4 ${blocked ? "border-pen-border/60 bg-pen-soft" : c.accepted ? "border-strong-border bg-surface" : "border-border bg-panel"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium">{where(c, profile)}</p>
        {blocked ? <Badge tone="bad">Blocked</Badge> : c.accepted ? <Badge tone="good">Using</Badge> : <Badge>Not using</Badge>}
      </div>
      <p className="mt-1 text-[13px] text-muted">{c.reason}</p>
      <div className="mt-3">
        {(c.kind === "summary" || c.kind === "bullet") && <Diff before={c.before} after={c.after} />}
        {c.kind === "bullet-order" && exp && (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {c.order.map((i) => (
              <li key={i} className="truncate">
                {exp.bullets[i]}
              </li>
            ))}
          </ol>
        )}
        {c.kind === "skills-order" && <p className="text-sm">{c.order.slice(0, 12).join(", ")}{c.order.length > 12 ? "…" : ""}</p>}
      </div>
      {blocked ? (
        <p className="mt-3 text-[13px] text-pen-strong">
          This adds something that isn&apos;t in your CV: <strong>{c.flags.join(", ")}</strong>. If it&apos;s true,{" "}
          <Link href="/app/profile" className="underline underline-offset-4">
            add it to your profile
          </Link>{" "}
          and tailor again.
        </p>
      ) : (
        <form action={toggleChange} className="mt-3">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="changeId" value={c.id} />
          <input type="hidden" name="accept" value={c.accepted ? "0" : "1"} />
          <button type="submit" className="text-[13px] font-medium underline underline-offset-4">
            {c.accepted ? "Don't use this" : "Use this"}
          </button>
        </form>
      )}
    </li>
  );
}

export default async function CvTab({ params }: PageProps<"/app/jobs/[id]/cv">) {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile, doc, usage] = await Promise.all([ownedJob(user.id, id), getProfile(user.id), getTailoredCv(user.id, id), usageThisMonth(user.id)]);
  if (!job) notFound();
  if (!profileReady(profile)) {
    return (
      <div className="rounded-xl border border-dashed border-strong-border px-6 py-8">
        <p className="mb-4 text-muted">Add your CV first, so there&apos;s something to tailor.</p>
        <ButtonLink href="/app/profile">Add your CV</ButtonLink>
      </div>
    );
  }
  const limits = limitsFor(user);
  const left = Math.max(0, limits.tailor - usage.tailor);
  const changes = doc?.cv?.changes ?? [];
  const cv = applyChanges(profile, changes);
  const using = changes.filter((c) => c.accepted && c.flags.length === 0).length;
  const [style, photo, mine] = await Promise.all([resolveCvStyle(user.id, job), photoUrl(user.id), listMyTemplates(user.id)]);
  const options: LookOption[] = [
    { id: style.template.id, name: style.template.name, spec: style.template.spec },
    ...recommendTemplates(profile, job.post, 4).map((t) => ({ id: t.id, name: t.name, spec: t.spec })),
    ...mine.flatMap((t) => {
      const spec = parseSpec(t.spec);
      return spec ? [{ id: t.id, name: t.name, spec }] : [];
    }),
  ].filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i);

  if (!doc) {
    return (
      <div className="max-w-2xl space-y-4 rounded-xl border border-border bg-surface shadow-1 p-6">
        <h2 className="text-lg font-semibold">Tailor your CV for this job</h2>
        <p className="text-sm text-muted">
          We&apos;ll suggest rewording and reordering so your most relevant experience comes first, in the words this employer uses. You check each
          change. Anything that isn&apos;t already in your CV is blocked, so nothing made up can slip through.
        </p>
        <AiActionButton action={tailorCv} jobId={job.id} label="Suggest changes" pendingLabel="Reading the job and your CV…" />
        <p className="text-xs text-muted">
          {left} of {limits.tailor} this month{limits.tailor < 100 ? " on the free plan" : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_1fr]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Suggested changes</h2>
          <p className="text-[13px] text-muted">
            Using {using} of {changes.length}
          </p>
        </div>
        {changes.length === 0 ? (
          <p className="text-sm text-muted">Your CV already reads well for this job. Nothing worth changing.</p>
        ) : (
          <ol className="space-y-3">
            {changes.map((c) => (
              <ChangeCard key={c.id} c={c} jobId={job.id} profile={profile} />
            ))}
          </ol>
        )}
        <div className="border-t border-border pt-4">
          <AiActionButton action={tailorCv} jobId={job.id} label="Suggest again" pendingLabel="Working…" variant="secondary" />
          <p className="mt-1 text-xs text-muted">Uses one of your {left} tailorings left this month. Replaces the suggestions above.</p>
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Your CV for this job</Eyebrow>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/app/print/cv/${job.id}`} target="_blank" variant="secondary" className="py-1.5">
              Download PDF
            </ButtonLink>
            {limits.docx ? (
              <a href={`/app/download/cv/${job.id}`} className="inline-flex items-center rounded-lg border border-strong-border bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-hover-border">
                Download Word
              </a>
            ) : (
              <Link href="/app/billing" className="self-center text-[13px] text-muted underline underline-offset-4">
                Word download comes with a pass
              </Link>
            )}
          </div>
        </div>
        <JobCvLook
          key={`${style.template.id}-${JSON.stringify(style.fit)}`}
          jobId={job.id}
          cv={cv}
          photoUrl={photo}
          current={{ id: style.template.id, name: style.template.name }}
          spec={style.spec}
          fitted={Boolean(style.fit)}
          options={options}
        />
      </section>
    </div>
  );
}
