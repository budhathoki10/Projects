"use client";

import { useActionState, useId, useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import type { Education, Experience, Profile, Project } from "@/lib/model/types";
import { Button, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

let next = 0;
const newId = (p: string) => `${p}new${Date.now().toString(36)}${(next++).toString(36)}`;
const lines = (s: string) => s.split("\n");
const join = (xs: string[]) => xs.join("\n");

function Text({ label, value, onChange, placeholder, wide }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean }) {
  const id = useId();
  return (
    <div className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

/** The hint is linked with aria-describedby, so screen readers announce just the label as the field's name. */
function Area({ label, value, onChange, rows = 4, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="space-y-1 sm:col-span-2">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${inputClass} leading-relaxed`}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={title.toLowerCase()} className="scroll-mt-20 space-y-4 border-t border-border pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const small = "text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline";

/** Every section of the profile, editable. One bullet per line keeps it fast to fix. */
export function ProfileEditor({ initial }: { initial: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const [p, setP] = useState(initial);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((cur) => ({ ...cur, [key]: value }));
  const setItem = <K extends "experience" | "education" | "projects">(key: K, id: string, patch: Partial<Profile[K][number]>) =>
    setP((cur) => ({ ...cur, [key]: (cur[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const remove = (key: "experience" | "education" | "projects", id: string) =>
    setP((cur) => ({ ...cur, [key]: (cur[key] as { id: string }[]).filter((x) => x.id !== id) }));
  const move = (id: string, dir: -1 | 1) =>
    setP((cur) => {
      const xs = [...cur.experience];
      const i = xs.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= xs.length) return cur;
      [xs[i], xs[j]] = [xs[j], xs[i]];
      return { ...cur, experience: xs };
    });

  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-8">
      <input type="hidden" name="profile" value={JSON.stringify(p)} />

      <div id="contact" className="grid scroll-mt-20 gap-4 sm:grid-cols-2">
        <Text label="Full name" value={p.name} onChange={(v) => set("name", v)} />
        <Text label="Headline" value={p.headline} onChange={(v) => set("headline", v)} placeholder="e.g. Staff Nurse, Frontend Developer" />
        <Text label="Email" value={p.email} onChange={(v) => set("email", v)} />
        <Text label="Phone" value={p.phone} onChange={(v) => set("phone", v)} />
        <Text label="Location" value={p.location} onChange={(v) => set("location", v)} placeholder="City, Country" />
        <Area label="Links" value={join(p.links)} onChange={(v) => set("links", lines(v))} rows={2} hint="One per line: LinkedIn, portfolio, GitHub." />
        <Area label="Summary" value={p.summary} onChange={(v) => set("summary", v)} rows={4} />
      </div>

      <Section
        title="Experience"
        action={
          <button
            type="button"
            className={small}
            onClick={() => set("experience", [{ id: newId("x"), title: "", company: "", location: "", start: "", end: "", bullets: [] } satisfies Experience, ...p.experience])}
          >
            Add a role
          </button>
        }
      >
        {p.experience.length === 0 && <p className="text-sm text-muted">No roles yet. Add one, including part-time work, internships and volunteering.</p>}
        {p.experience.map((e, i) => (
          <fieldset key={e.id} className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2">
            <legend className="sr-only">{e.title || `Role ${i + 1}`}</legend>
            <Text label="Job title" value={e.title} onChange={(v) => setItem("experience", e.id, { title: v })} />
            <Text label="Employer" value={e.company} onChange={(v) => setItem("experience", e.id, { company: v })} />
            <Text label="Location" value={e.location} onChange={(v) => setItem("experience", e.id, { location: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="From" value={e.start} onChange={(v) => setItem("experience", e.id, { start: v })} placeholder="Jan 2022" />
              <Text label="To" value={e.end} onChange={(v) => setItem("experience", e.id, { end: v })} placeholder="Present" />
            </div>
            <Area
              label="What you did"
              value={join(e.bullets)}
              onChange={(v) => setItem("experience", e.id, { bullets: lines(v) })}
              rows={Math.max(3, e.bullets.length + 1)}
              hint="One point per line. Real numbers help: how many, how much, how fast."
            />
            <div className="flex flex-wrap gap-4 sm:col-span-2">
              <button type="button" className={small} onClick={() => move(e.id, -1)} disabled={i === 0}>
                Move up
              </button>
              <button type="button" className={small} onClick={() => move(e.id, 1)} disabled={i === p.experience.length - 1}>
                Move down
              </button>
              <button type="button" className={`${small} hover:text-pen`} onClick={() => remove("experience", e.id)}>
                Remove
              </button>
            </div>
          </fieldset>
        ))}
      </Section>

      <Section
        title="Education"
        action={
          <button type="button" className={small} onClick={() => set("education", [...p.education, { id: newId("e"), school: "", degree: "", start: "", end: "", details: [] } satisfies Education])}>
            Add
          </button>
        }
      >
        {p.education.map((e) => (
          <fieldset key={e.id} className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2">
            <Text label="Qualification" value={e.degree} onChange={(v) => setItem("education", e.id, { degree: v })} placeholder="e.g. BSc Computer Science, +2 Science" />
            <Text label="School or college" value={e.school} onChange={(v) => setItem("education", e.id, { school: v })} />
            <Text label="From" value={e.start} onChange={(v) => setItem("education", e.id, { start: v })} />
            <Text label="To" value={e.end} onChange={(v) => setItem("education", e.id, { end: v })} />
            <Area label="Details" value={join(e.details)} onChange={(v) => setItem("education", e.id, { details: lines(v) })} rows={2} hint="Optional. Grades, awards, relevant modules, one per line." />
            <button type="button" className={`${small} justify-self-start hover:text-pen`} onClick={() => remove("education", e.id)}>
              Remove
            </button>
          </fieldset>
        ))}
      </Section>

      <Section title="Skills">
        <div className="grid gap-4 sm:grid-cols-2">
          <Area
            label="Skills and tools"
            value={p.skills.join(", ")}
            onChange={(v) => set("skills", v.split(",").map((s) => s.trimStart()))}
            rows={3}
            hint="Separated by commas. Only list what you'd be comfortable being asked about."
          />
          <Area label="Certifications and licences" value={join(p.certifications)} onChange={(v) => set("certifications", lines(v))} rows={2} hint="One per line." />
          <Area label="Languages" value={p.languages.join(", ")} onChange={(v) => set("languages", v.split(",").map((s) => s.trimStart()))} rows={1} />
        </div>
      </Section>

      <Section
        title="Projects"
        action={
          <button type="button" className={small} onClick={() => set("projects", [...p.projects, { id: newId("p"), name: "", link: "", bullets: [] } satisfies Project])}>
            Add
          </button>
        }
      >
        {p.projects.length === 0 && <p className="text-sm text-muted">Optional. Useful for students and career changers.</p>}
        {p.projects.map((x) => (
          <fieldset key={x.id} className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2">
            <Text label="Project" value={x.name} onChange={(v) => setItem("projects", x.id, { name: v })} />
            <Text label="Link" value={x.link} onChange={(v) => setItem("projects", x.id, { link: v })} />
            <Area label="What you did" value={join(x.bullets)} onChange={(v) => setItem("projects", x.id, { bullets: lines(v) })} rows={2} />
            <button type="button" className={`${small} justify-self-start hover:text-pen`} onClick={() => remove("projects", x.id)}>
              Remove
            </button>
          </fieldset>
        ))}
      </Section>

      <div className="sticky bottom-0 -mx-1 space-y-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <FormMessage error={state?.error} success={state?.success} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
