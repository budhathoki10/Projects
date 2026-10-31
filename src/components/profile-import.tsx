"use client";

import { ActionToast } from "@/components/toast";
import { useActionState, useState } from "react";
import { confirmCvImport, importCv } from "@/app/actions/profile";
import { CvPreview } from "./cv-preview";
import { inputClass } from "./ui";
import { FormSubmit } from "./form-submit";
import { keepInputOnSubmit } from "./use-keep-input";

export function ProfileImport({ replacing }: { replacing: boolean }) {
  const [state, action, pending] = useActionState(importCv, undefined);
  const [confirmed, confirm, confirming] = useActionState(confirmCvImport, undefined);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [discarded, setDiscarded] = useState<typeof state>();
  if (state?.preview && discarded !== state) {
    const p = state.preview;
    const missing = [!p.summary && "summary", !p.skills.length && "skills", !p.links.length && "contact links", !p.education.length && "education"].filter(Boolean);
    return (
      <div className="space-y-5" aria-label="CV import review">
        <div>
          <p className="t-label text-accent">Ready for your review</p>
          <h2 className="t-title mt-1">{p.name || "Your CV"}</h2>
          <p className="mt-2 text-sm text-muted">Check the extracted content before {replacing ? "replacing your saved profile" : "using it in your applications"}.</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Roles", p.experience.length], ["Projects", p.projects.length], ["Skills", p.skills.length], ["Contact links", p.links.length]].map(([label, count]) => (
            <div key={label} className="rounded-lg border border-border bg-background px-4 py-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{count}</dd></div>
          ))}
        </dl>
        <p className="rounded-md bg-accent-soft px-4 py-3 text-sm text-muted">
          {state.method === "ai" ? "AI extraction with links recovered from the file." : "Read with the local parser. AI extraction was unavailable; review the section boundaries and wording."}
          {missing.length > 0 && ` Not found: ${missing.join(", ")}. Add these after importing if they belong in your CV.`}
        </p>
        <details className="rounded-lg border border-border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">Preview extracted CV</summary><div className="max-h-[32rem] overflow-auto border-t border-border"><CvPreview cv={p} /></div></details>
        <details className="rounded-lg border border-border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">Compare with extracted source text</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-border p-4 font-sans text-xs leading-relaxed text-muted">{state.source}</pre></details>
        <form action={confirm} className="space-y-3">
          <input type="hidden" name="importId" value={state.importId ?? ""} />
          {state.originalType === "application/pdf" && <p className="text-sm text-muted">Your original PDF is kept with its fonts, layout, page breaks and clickable links. It is the default download; redesigned versions are optional.</p>}
          <ActionToast state={confirmed} only="error" />
          <div className="flex flex-wrap items-center gap-3">
            <FormSubmit loading={confirming}>{confirming ? "Saving your CV…" : "Use this CV"}</FormSubmit>
            <button type="button" className="px-3 py-2 text-sm text-muted hover:text-foreground" disabled={confirming} onClick={() => setDiscarded(state)}>Choose another file</button>
          </div>
        </form>
      </div>
    );
  }
  return (
    <form method="post" onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <div role="tablist" aria-label="How to add your CV" className="flex gap-1 border-b border-border text-sm">
        {(["file", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`-mb-px inline-flex h-10 items-center border-b-2 px-3 transition-colors duration-150 ${mode === m ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {m === "file" ? "Upload a file" : "Paste the text"}
          </button>
        ))}
      </div>
      {mode === "file" ? (
        <div className="space-y-3 rounded-lg border border-dashed border-strong-border bg-background px-5 py-6">
          <label htmlFor="cv-file" className="t-label block">
            Your CV
          </label>
          <input
            id="cv-file"
            name="file"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="block w-full cursor-pointer text-sm text-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded file:border file:border-strong-border file:bg-surface file:px-3.5 file:text-sm file:font-medium file:text-foreground file:transition-colors file:duration-150 hover:file:bg-surface-hover"
          />
          <p className="text-xs text-muted">PDF, Word (.docx) or text, up to 5 MB. Embedded LinkedIn, GitHub and project links are included.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="cv-text" className="t-label block">
            CV text
          </label>
          <textarea id="cv-text" name="text" rows={10} className={inputClass} placeholder="Paste everything: name, contact details, jobs, education, skills." />
        </div>
      )}
      <ActionToast state={state} />
      <FormSubmit loading={pending}>
        {pending ? "Reading your CV…" : replacing ? "Replace my profile" : "Read my CV"}
      </FormSubmit>
      <p className="text-xs text-muted">You’ll review the extraction before {replacing ? "replacing your saved CV" : "saving your profile"}.</p>
    </form>
  );
}
