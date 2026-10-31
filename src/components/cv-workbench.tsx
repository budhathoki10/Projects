"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toggleAllChanges, toggleChange } from "@/app/actions/tailor";
import { wordDiff } from "@/lib/diff";
import type { Change, Profile } from "@/lib/model/types";
import { applyChanges } from "@/lib/tailor/apply";
import { presentCv, type CvContent } from "@/lib/cv/presentation";
import type { TemplateSpec } from "@/lib/templates/spec";
import { JobCvLook, type LookOption } from "./studio/job-cv-look";
import { OriginalPdfPreview } from "./cv/original-pdf-preview";
import { useToast } from "./toast";
import { Badge, Button, buttonClass, Eyebrow } from "./ui";

function where(c: Change, profile: Profile) {
  if (c.kind === "summary") return "Summary";
  if (c.kind === "skills-order") return "Skills";
  if (c.kind === "section-order") return "Section order";
  if (c.kind === "projects-order") return "Project order";
  if (c.kind === "project-bullet") return profile.projects.find((p) => p.id === c.projectId)?.name ?? "Project";
  const e = "experienceId" in c ? profile.experience.find((x) => x.id === c.experienceId) : undefined;
  return e ? `${e.title}${e.company ? `, ${e.company}` : ""}` : "Experience";
}

/** Added words are green when the change is fine and red when the fact check blocked it. */
function Diff({ before, after, blocked }: { before: string; after: string; blocked: boolean }) {
  return (
    <p className="text-sm leading-relaxed">
      {wordDiff(before, after).map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "added" ? (
          <ins key={i} className={blocked ? "rounded-[2px] bg-danger/15 px-0.5 font-medium text-danger no-underline" : "hl-shown no-underline"}>
            {p.text}
          </ins>
        ) : (
          <del key={i} className="text-faint">
            {p.text}
          </del>
        ),
      )}
    </p>
  );
}

function ChangeCard({ c, profile, onToggle }: { c: Change; profile: Profile; onToggle: (accept: boolean) => void }) {
  const blocked = c.flags.length > 0;
  const exp = "experienceId" in c ? profile.experience.find((e) => e.id === c.experienceId) : undefined;
  return (
    <li className={`rounded-md border p-4 transition-colors duration-150 ${blocked ? "border-danger/30 bg-danger-soft" : c.accepted ? "border-strong-border bg-surface" : "border-border bg-background"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium" title={where(c, profile)}>
          {where(c, profile)}
        </p>
        {blocked ? <Badge tone="bad">Blocked</Badge> : c.accepted ? <Badge tone="good">Using</Badge> : <Badge>Not using</Badge>}
      </div>
      <p className="mt-1 text-[13px] text-muted">{c.reason}</p>
      <div className="mt-3">
        {(c.kind === "summary" || c.kind === "bullet" || c.kind === "project-bullet") && <Diff before={c.before} after={c.after} blocked={blocked} />}
        {c.kind === "section-order" && <p className="text-sm capitalize">{c.order.join(" → ")}</p>}
        {c.kind === "projects-order" && <ol className="list-decimal space-y-1 pl-5 text-sm">{c.order.map((id) => <li key={id}>{profile.projects.find((p) => p.id === id)?.name}</li>)}</ol>}
        {c.kind === "bullet-order" && exp && (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {c.order.map((i) => (
              <li key={i} className="truncate" title={exp.bullets[i]}>
                {exp.bullets[i]}
              </li>
            ))}
          </ol>
        )}
        {c.kind === "skills-order" && (
          <p className="text-sm">
            {c.order.slice(0, 12).join(", ")}
            {c.order.length > 12 ? "…" : ""}
          </p>
        )}
      </div>
      {blocked ? (
        <p className="mt-3 text-[13px] text-danger">
          This adds something that isn’t in your CV: <strong>{c.flags.join(", ")}</strong>. If it’s true,{" "}
          <Link href="/app/profile" className="underline underline-offset-4">
            add it to your profile
          </Link>{" "}
          and tailor again.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(!c.accepted)}
          className="mt-3 inline-flex h-8 items-center rounded px-2 text-[13px] font-medium text-accent transition-colors duration-150 hover:bg-accent-soft max-sm:h-10"
        >
          {c.accepted ? "Don't use this" : "Use this"}
        </button>
      )}
    </li>
  );
}

/**
 * The suggestions beside the CV they produce. A toggle changes the list and the preview on the
 * same frame; the save happens in the background and is rolled back (with a message) if it fails.
 */
export function CvWorkbench({
  jobId,
  profile,
  initial,
  docx,
  original,
  look,
  action,
}: {
  jobId: string;
  profile: Profile;
  initial: Change[];
  docx: boolean;
  original: { name: string; type: string; matchesProfile: boolean } | null;
  /** The job's CV template, the person's photo and the looks they can try. */
  look: { photoUrl: string | null; current: { id: string; name: string }; spec: TemplateSpec; fitted: boolean; fitKey: string; options: LookOption[] };
  /** The "Suggest again" control, rendered on the server. */
  action: React.ReactNode;
}) {
  const [changes, setChanges] = useState(initial);
  const [content, setContent] = useState<CvContent>("full");
  const hasOriginalPdf = original?.type === "application/pdf";
  const [layout, setLayout] = useState<"original" | "redesigned">(hasOriginalPdf ? "original" : "redesigned");
  // When the server sends a different set (a fresh round of suggestions), start from it.
  // Adjusting state while rendering, keyed on what the server last sent.
  const signature = initial.map((c) => `${c.id}:${c.accepted}`).join();
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setChanges(initial);
  }
  const [saving, startTransition] = useTransition();
  const toast = useToast();

  // The save happens in the background, so leaving mid-save would lose the change: ask first.
  useEffect(() => {
    if (!saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);
  const cv = presentCv(applyChanges(profile, changes), content);
  const usable = changes.filter((c) => c.flags.length === 0);
  const using = usable.filter((c) => c.accepted).length;

  const save = (apply: (cs: Change[]) => Change[], run: (fd: FormData) => Promise<void>, fields: Record<string, string>) => {
    const before = changes;
    setChanges(apply(before));
    startTransition(async () => {
      const data = new FormData();
      data.set("jobId", jobId);
      for (const [k, v] of Object.entries(fields)) data.set(k, v);
      try {
        await run(data);
      } catch {
        setChanges(before);
        toast.show({ tone: "error", message: "Couldn’t save that change. It’s been put back." });
      }
    });
  };

  const toggle = (id: string, accept: boolean) =>
    save((cs) => cs.map((c) => (c.id === id && c.flags.length === 0 ? { ...c, accepted: accept } : c)), toggleChange, { changeId: id, accept: accept ? "1" : "0" });
  const setAll = (accept: boolean) => save((cs) => cs.map((c) => (c.flags.length === 0 ? { ...c, accepted: accept } : c)), toggleAllChanges, { accept: accept ? "1" : "0" });

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Suggested changes</h2>
          <p className="text-[13px] text-muted tabular-nums" aria-live="polite">
            Using {using} of {changes.length}
          </p>
        </div>
        {usable.length > 1 && (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAll(true)} disabled={using === usable.length}>
              Use all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAll(false)} disabled={using === 0}>
              Use none
            </Button>
          </div>
        )}
        {changes.length === 0 ? (
          <p className="text-sm text-muted">No supported changes were identified. Review your CV against the job requirements before applying.</p>
        ) : (
          <ol className="space-y-3">
            {changes.map((c) => (
              <ChangeCard key={c.id} c={c} profile={profile} onToggle={(accept) => toggle(c.id, accept)} />
            ))}
          </ol>
        )}
        <div className="border-t border-border pt-4">{action}</div>
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Your CV for this job</Eyebrow>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/app/download/cv/${jobId}?format=pdf&layout=${layout}&content=${content}`} className={buttonClass("primary", "sm")}>
              Download PDF
            </a>
            <Link href={`/app/print/cv/${jobId}?layout=${layout}&content=${content}`} target="_blank" className={buttonClass("ghost", "sm")}>Print preview</Link>
            {layout === "redesigned" && (docx ? (
              <a href={`/app/download/cv/${jobId}?layout=redesigned&content=${content}`} className={buttonClass("secondary", "sm")}>
                Download Word
              </a>
            ) : (
              <Link href="/app/billing" className="text-[13px] text-muted underline underline-offset-4 hover:text-foreground">
                Word download is included in paid plans
              </Link>
            ))}
          </div>
        </div>
        <div role="group" aria-label="CV format" className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          <button type="button" disabled={!hasOriginalPdf} aria-pressed={layout === "original"} onClick={() => setLayout("original")} className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${layout === "original" ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-hover"}`}>Original PDF</button>
          <button type="button" aria-pressed={layout === "redesigned"} onClick={() => setLayout("redesigned")} className={`rounded-md px-3 py-2 text-sm font-medium ${layout === "redesigned" ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-hover"}`}>Tailored version</button>
        </div>
        {!hasOriginalPdf && <p className="text-sm text-muted"><Link href="/app/profile" className="underline underline-offset-4">Upload your original PDF</Link> to keep its exact formatting. Previous imports saved extracted text only.</p>}
        {layout === "original" ? (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">Your uploaded PDF, unchanged</p>
            <p className="text-sm leading-relaxed text-muted">Fonts, spacing, section order, all pages and embedded links are preserved. Accepted AI suggestions apply only to the separate tailored version.</p>
            {original && !original.matchesProfile && <p className="text-sm text-warning">You have edited your profile since this upload. Those edits are not in the original PDF.</p>}
            <p className="break-all text-xs text-muted">{original?.name}</p>
            <Link href="/app/download/original?inline=1" target="_blank" className={buttonClass("secondary", "sm")}>Open original PDF</Link>
            <OriginalPdfPreview />
          </div>
        ) : (<>
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <div role="group" aria-label="CV content length" className="flex gap-1">{(["focused", "full"] as const).map((mode) => <button key={mode} type="button" aria-pressed={content === mode} onClick={() => setContent(mode)} className={`rounded-md px-3 py-2 text-xs font-medium ${content === mode ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-hover"}`}>{mode === "focused" ? "Focused CV" : "Full source"}</button>)}</div>
          <p className="text-xs leading-relaxed text-muted">{content === "focused" ? "Selected project highlights and a shorter summary, copied from your profile. Review the preview before downloading. Your complete source remains saved." : "Includes every saved description and highlight. Long source descriptions will make a longer document."}</p>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Print preview and the Word file follow the look chosen below. The PDF download uses a simple, single-column layout.
        </p>
        <JobCvLook
          key={`${look.current.id}-${look.fitKey}`}
          jobId={jobId}
          cv={cv}
          photoUrl={look.photoUrl}
          current={look.current}
          spec={look.spec}
          fitted={look.fitted}
          options={look.options}
        />
        </>)}
      </section>
    </div>
  );
}
