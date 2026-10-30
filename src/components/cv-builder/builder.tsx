"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { updateProfile, writeSummary } from "@/app/actions/profile";
import { setDefaultTemplateAction } from "@/app/actions/templates";
import { CvMini } from "@/components/cv/cv-mini";
import { CvSheet } from "@/components/cv/cv-sheet";
import { AtsBadge } from "@/components/studio/template-bits";
import { BUILDER_STEPS, suggestSkills, tidyProfile } from "@/lib/cv/builder";
import type { Education, Experience, Profile, Project } from "@/lib/model/types";
import { atsReport } from "@/lib/templates/checks";
import { recommendTemplates } from "@/lib/templates/registry";
import type { TemplateSpec } from "@/lib/templates/spec";
import { Icon } from "../icons";
import { Button, FormMessage, inputClass } from "../ui";
import { ChipInput } from "./chip-input";
import { NotesToBullets } from "./notes-to-bullets";

let seq = 0;
const newId = (p: string) => `${p}b${Date.now().toString(36)}${(seq++).toString(36)}`;
const blankJob = (): Experience => ({ id: newId("x"), title: "", company: "", location: "", start: "", end: "", bullets: [] });
const blankStudy = (): Education => ({ id: newId("e"), school: "", degree: "", start: "", end: "", details: [] });
const blankProject = (): Project => ({ id: newId("p"), name: "", link: "", bullets: [] });
const lines = (s: string) => s.split("\n");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function Text({ label, value, onChange, placeholder, hint, type = "text", autoComplete, disabled, className = "" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function Lines({ label, value, onChange, rows = 4, hint, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; rows?: number; hint?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="space-y-1 sm:col-span-2">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <textarea id={id} value={value.join("\n")} onChange={(e) => onChange(lines(e.target.value))} rows={rows} placeholder={placeholder} aria-describedby={hint ? `${id}-hint` : undefined} className={`${inputClass} leading-relaxed`} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function Entry({ title, onRemove, children }: { title: string; onRemove?: () => void; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-5 first:border-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <legend className="text-[15px] font-semibold">{title}</legend>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
            Remove
          </button>
        )}
      </div>
      {children}
    </fieldset>
  );
}

const addLink = "inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline";

/**
 * "Build my CV": six short steps with a live preview. Each step saves through the same action as
 * the full editor, so leaving halfway loses nothing and the next visit starts where it stopped.
 */
export function CvBuilder({ initial, startStep, defaultSpec, photoUrl }: { initial: Profile; startStep: number; defaultSpec: TemplateSpec; photoUrl: string | null }) {
  const router = useRouter();
  const [p, setP] = useState<Profile>(() => ({
    ...initial,
    experience: initial.experience.length || initial.projects.length ? initial.experience : [blankJob()],
    education: initial.education.length ? initial.education : [blankStudy()],
  }));
  const [step, setStep] = useState(startStep);
  const [noWork, setNoWork] = useState(initial.experience.length === 0 && initial.projects.length > 0);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryNote, setSummaryNote] = useState<{ flags: string[]; method: "ai" | "basic" } | null>(null);
  const [pending, start] = useTransition();

  const tidy = useMemo(() => tidyProfile(p), [p]);
  const recommended = useMemo(() => (step === 5 ? recommendTemplates(tidy, null, 4) : []), [step, tidy]);
  const [lookId, setLookId] = useState<string | null>(null);
  const chosen = recommended.find((t) => t.id === lookId) ?? null;
  const spec = step === 5 && chosen ? chosen.spec : defaultSpec;
  const skillIdeas = useMemo(() => (step === 3 ? suggestSkills(tidy) : []), [step, tidy]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((cur) => ({ ...cur, [key]: value }));
  const patch = <K extends "experience" | "education" | "projects">(key: K, id: string, change: Partial<Profile[K][number]>) =>
    setP((cur) => ({ ...cur, [key]: (cur[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...change } : x)) }));
  const drop = (key: "experience" | "education" | "projects", id: string) => setP((cur) => ({ ...cur, [key]: (cur[key] as { id: string }[]).filter((x) => x.id !== id) }));

  async function save(): Promise<boolean> {
    const fd = new FormData();
    fd.set("profile", JSON.stringify(p));
    const res = await updateProfile(undefined, fd);
    if (res?.error) {
      setError(res.error);
      return false;
    }
    return true;
  }

  function check(): string | null {
    if (step === 0) {
      if (!p.name.trim()) return "Add your name.";
      if (!p.headline.trim()) return "Add a headline: the job you do, or the one you want.";
    }
    return null;
  }

  const go = (to: number) =>
    start(async () => {
      setError(null);
      const problem = to > step ? check() : null;
      if (problem) return setError(problem);
      if (!(await save())) return;
      setStep(to);
      setPreview(false);
      window.scrollTo({ top: 0 });
    });

  const finish = () =>
    start(async () => {
      setError(null);
      if (!tidy.experience.length && !tidy.projects.length && !tidy.education.length) {
        return setError("Add at least one job, project or qualification, so your CV has something in it.");
      }
      if (!(await save())) return;
      const pick = chosen ?? recommended[0];
      if (pick) {
        const fd = new FormData();
        fd.set("id", pick.id);
        const res = await setDefaultTemplateAction(undefined, fd);
        if (res?.error) return setError(res.error);
      }
      router.push("/app/studio?ready=1");
    });

  const later = () =>
    start(async () => {
      if (p.name.trim() && (await save())) router.push("/app");
      else if (!p.name.trim()) setError("Add your name first, so there's something to save.");
    });

  const writeIt = () =>
    start(async () => {
      setError(null);
      if (!(await save())) return;
      const res = await writeSummary();
      if (res.error || !res.text) return setError(res.error ?? "Something went wrong.");
      set("summary", res.text);
      setSummaryNote({ flags: res.flags ?? [], method: res.method ?? "basic" });
    });

  const last = step === BUILDER_STEPS.length - 1;
  const workEmpty = !tidy.experience.length && !tidy.projects.length;
  const studiesEmpty = !tidy.education.length && !tidy.certifications.length;
  const skippable = (step === 1 && workEmpty) || (step === 2 && studiesEmpty) || (step === 4 && !p.summary.trim());

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted">
              Step {step + 1} of {BUILDER_STEPS.length}
            </p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{STEP_TITLES[step]}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={later} disabled={pending} className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
              Save and come back later
            </button>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              aria-pressed={preview}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-strong-border bg-surface px-2.5 text-[13px] font-medium shadow-1 hover:bg-panel lg:hidden"
            >
              <Icon name={preview ? "close" : "eye"} size={15} />
              {preview ? "Back to editing" : "Preview"}
            </button>
          </div>
        </div>
        <nav aria-label="Steps">
          <ol className="grid grid-cols-6 gap-1.5">
            {BUILDER_STEPS.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => i !== step && go(i)}
                  disabled={pending}
                  aria-current={i === step ? "step" : undefined}
                  className="group block w-full text-left"
                >
                  <span className={`block h-1 rounded-full ${i <= step ? "bg-ink" : "bg-subtle group-hover:bg-subtle-hover"}`} />
                  <span className={`mt-1.5 hidden text-xs sm:block ${i === step ? "font-medium text-foreground" : "text-muted group-hover:text-foreground"}`}>{name}</span>
                  <span className="sr-only sm:hidden">{name}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className={`min-w-0 space-y-6 ${preview ? "hidden lg:block" : ""}`}>
          <p className="text-[15px] text-muted">{STEP_INTROS[step]}</p>

          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Full name" value={p.name} onChange={(v) => set("name", v)} autoComplete="name" />
              <Text label="Headline" value={p.headline} onChange={(v) => set("headline", v)} placeholder="Staff Nurse" hint="The job you do, or want. For example “Final-year BBA student”." />
              <Text label="Email" type="email" value={p.email} onChange={(v) => set("email", v)} autoComplete="email" />
              <Text label="Phone" type="tel" value={p.phone} onChange={(v) => set("phone", v)} autoComplete="tel" placeholder="+977 98…" />
              <Text label="City and country" value={p.location} onChange={(v) => set("location", v)} placeholder="Pokhara, Nepal" />
              <Text label="Link (optional)" value={p.links[0] ?? ""} onChange={(v) => set("links", [v, ...p.links.slice(1)])} placeholder="linkedin.com/in/your-name" hint="LinkedIn, a portfolio or a website." />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8">
              {!noWork && (
                <div className="space-y-6">
                  {p.experience.map((e, i) => (
                    <Entry key={e.id} title={e.title.trim() || `Job ${i + 1}`} onRemove={p.experience.length > 1 || p.projects.length ? () => drop("experience", e.id) : undefined}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Text label="Job title" value={e.title} onChange={(v) => patch("experience", e.id, { title: v })} placeholder="Sales Assistant" />
                        <Text label="Employer" value={e.company} onChange={(v) => patch("experience", e.id, { company: v })} placeholder="Bhatbhateni Supermarket" />
                        <Text label="From" value={e.start} onChange={(v) => patch("experience", e.id, { start: v })} placeholder="Mar 2022" />
                        <div className="space-y-1">
                          <Text label="To" value={e.end === "Present" ? "Now" : e.end} onChange={(v) => patch("experience", e.id, { end: v })} placeholder="Jan 2024" disabled={e.end === "Present"} />
                          <label className="flex items-center gap-2 pt-1 text-[13px] text-muted">
                            <input type="checkbox" checked={e.end === "Present"} onChange={(ev) => patch("experience", e.id, { end: ev.target.checked ? "Present" : "" })} className="size-4 accent-[var(--ink)]" />
                            I work here now
                          </label>
                        </div>
                      </div>
                      <NotesToBullets title={e.title} company={e.company} onUse={(b) => patch("experience", e.id, { bullets: [...e.bullets.filter((x) => x.trim()), ...b] })} />
                      <Lines label="Bullet points" value={e.bullets} onChange={(v) => patch("experience", e.id, { bullets: v })} hint="One per line. Edit them freely." rows={Math.max(3, e.bullets.length + 1)} />
                    </Entry>
                  ))}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <button type="button" className={addLink} onClick={() => set("experience", [...p.experience, blankJob()])}>
                      <Icon name="plus" size={16} /> Add another job
                    </button>
                    {workEmpty && (
                      <button
                        type="button"
                        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
                        onClick={() => {
                          setNoWork(true);
                          setP((cur) => ({ ...cur, experience: cur.experience.filter((x) => x.title.trim() || x.company.trim()), projects: cur.projects.length ? cur.projects : [blankProject()] }));
                        }}
                      >
                        No work yet? Add projects, volunteering or part-time work instead
                      </button>
                    )}
                  </div>
                </div>
              )}

              {(noWork || p.projects.length > 0) && (
                <div className="space-y-6">
                  {!noWork && <h2 className="border-t border-border pt-6 text-base font-semibold">Projects and volunteering</h2>}
                  {p.projects.map((x, i) => (
                    <Entry key={x.id} title={x.name.trim() || `Project ${i + 1}`} onRemove={() => drop("projects", x.id)}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Text label="Name" value={x.name} onChange={(v) => patch("projects", x.id, { name: v })} placeholder="Volunteer, Red Cross blood drive" />
                        <Text label="Link (optional)" value={x.link} onChange={(v) => patch("projects", x.id, { link: v })} />
                      </div>
                      <NotesToBullets title={x.name} company="" onUse={(b) => patch("projects", x.id, { bullets: [...x.bullets.filter((l) => l.trim()), ...b] })} />
                      <Lines label="Bullet points" value={x.bullets} onChange={(v) => patch("projects", x.id, { bullets: v })} hint="One per line." rows={Math.max(3, x.bullets.length + 1)} />
                    </Entry>
                  ))}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <button type="button" className={addLink} onClick={() => set("projects", [...p.projects, blankProject()])}>
                      <Icon name="plus" size={16} /> Add {p.projects.length ? "another" : "a"} project
                    </button>
                    {noWork && (
                      <button
                        type="button"
                        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
                        onClick={() => {
                          setNoWork(false);
                          if (!p.experience.length) set("experience", [blankJob()]);
                        }}
                      >
                        Add a job after all
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {p.education.map((e, i) => (
                <Entry key={e.id} title={e.degree.trim() || `Qualification ${i + 1}`} onRemove={p.education.length > 1 ? () => drop("education", e.id) : undefined}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Text label="Qualification" value={e.degree} onChange={(v) => patch("education", e.id, { degree: v })} placeholder="Bachelor of Business Administration" />
                    <Text label="School, college or university" value={e.school} onChange={(v) => patch("education", e.id, { school: v })} placeholder="Tribhuvan University" />
                    <Text label="From" value={e.start} onChange={(v) => patch("education", e.id, { start: v })} placeholder="2020" />
                    <Text label="To" value={e.end} onChange={(v) => patch("education", e.id, { end: v })} placeholder="2024, or Expected 2025" />
                    <Lines label="Details (optional)" value={e.details} onChange={(v) => patch("education", e.id, { details: v })} rows={2} hint="One per line: a grade, a thesis, an award." />
                  </div>
                </Entry>
              ))}
              <button type="button" className={addLink} onClick={() => set("education", [...p.education, blankStudy()])}>
                <Icon name="plus" size={16} /> Add another
              </button>
              <div className="border-t border-border pt-6">
                <Lines label="Certificates and courses (optional)" value={p.certifications} onChange={(v) => set("certifications", v)} rows={3} hint="One per line, like “First Aid, Red Cross, 2023”." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <ChipInput label="Skills" values={p.skills} onChange={(v) => set("skills", v)} placeholder="Type a skill and press Enter" suggestions={skillIdeas} suggestionsLabel="Tap to add. The first ones come from what you wrote." />
              <div className="border-t border-border pt-6">
                <ChipInput label="Languages" values={p.languages} onChange={(v) => set("languages", v)} placeholder="English, Nepali, Hindi…" />
              </div>
            </div>
          )}

          {step === 4 && (
            <SummaryStep value={p.summary} onChange={(v) => { set("summary", v); setSummaryNote(null); }} note={summaryNote} onWrite={writeIt} pending={pending} />
          )}

          {step === 5 && (
            <fieldset>
              <legend className="sr-only">Choose a look</legend>
              <div className="grid grid-cols-2 gap-4 sm:gap-5">
                {recommended.map((t, i) => {
                  const on = (chosen ?? recommended[0])?.id === t.id;
                  return (
                    <label key={t.id} className={`block cursor-pointer rounded-xl p-2 ring-1 transition ${on ? "bg-panel ring-2 ring-ink" : "ring-border hover:ring-hover-border"}`}>
                      <input type="radio" name="look" value={t.id} checked={on} onChange={() => setLookId(t.id)} className="sr-only" />
                      <div className="overflow-hidden rounded-md ring-1 ring-border">
                        <CvMini spec={t.spec} cv={tidy} photoUrl={photoUrl} />
                      </div>
                      <span className="mt-2 flex items-center justify-between gap-2 px-1">
                        <span className="truncate text-sm font-medium">
                          {t.name}
                          {i === 0 && <span className="font-normal text-muted"> · best fit</span>}
                        </span>
                        <AtsBadge level={atsReport(t.spec).level} />
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-4 text-[13px] text-muted">You can switch to any of the 100 templates, or design your own, in CV Studio later.</p>
            </fieldset>
          )}

          <FormMessage error={error} />

          <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
            {step > 0 ? (
              <Button type="button" variant="secondary" onClick={() => go(step - 1)} disabled={pending}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {last ? (
              <Button type="button" onClick={finish} disabled={pending}>
                {pending ? "Saving…" : "Finish"}
              </Button>
            ) : (
              <Button type="button" onClick={() => go(step + 1)} disabled={pending}>
                {pending ? "Saving…" : skippable ? "Skip for now" : "Continue"}
              </Button>
            )}
          </div>
        </div>

        <aside aria-label="Preview" className={`min-w-0 lg:block ${preview ? "" : "hidden"}`}>
          <div className="lg:sticky lg:top-20">
            <p className="mb-2 text-[13px] text-muted">Preview{chosen ? ` · ${chosen.name}` : ""}</p>
            <CvSheet spec={spec} cv={{ ...tidy, name: tidy.name || "Your name" }} photoUrl={photoUrl} maxScale={0.75} />
          </div>
        </aside>
      </div>

    </div>
  );
}

const STEP_TITLES = ["About you", "Your work", "Your studies", "Skills and languages", "A short summary", "Pick a look"];
const STEP_INTROS = [
  "The basics employers need to reach you.",
  "Start with your latest job. Write roughly what you did, and we'll tidy it into bullet points using only your words.",
  "Your highest qualification first. School counts if it's your latest.",
  "Add at least three skills you'd be happy to be asked about.",
  "Two or three sentences at the top of your CV. Write your own, or let us draft one from what you've entered.",
  "Four looks that suit your CV. All of them read cleanly in applicant tracking systems unless the label says otherwise.",
];

function SummaryStep({ value, onChange, note, onWrite, pending }: { value: string; onChange: (v: string) => void; note: { flags: string[]; method: "ai" | "basic" } | null; onWrite: () => void; pending: boolean }) {
  const id = useId();
  const n = words(value);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium">
          Summary
        </label>
        <span className={`text-xs tabular-nums ${n > 70 ? "text-notice-strong" : "text-muted"}`} aria-live="polite">
          {n} words{n > 0 && (n < 30 ? " · a little short" : n > 70 ? " · a little long" : " · a good length")}
        </span>
      </div>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={5} className={`${inputClass} leading-relaxed`} placeholder="Staff nurse with four years on a busy surgical ward…" />
      <Button type="button" variant="secondary" onClick={onWrite} disabled={pending}>
        <Icon name="sparkle" size={16} /> {value.trim() ? "Write it again for me" : "Write it for me"}
      </Button>
      {note && (
        <p className="text-[13px] text-muted">
          {note.flags.length > 0 ? (
            <span className="text-notice-strong">Check this before you keep it: &ldquo;{note.flags.join("”, “")}&rdquo; isn&apos;t in your CV.</span>
          ) : note.method === "basic" ? (
            "Put together from your headline, latest role and skills. Edit it to sound like you."
          ) : (
            "Drafted from what you've entered, and checked against it. Edit it to sound like you."
          )}
        </p>
      )}
    </div>
  );
}
