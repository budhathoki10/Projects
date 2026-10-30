"use client";

import { useActionState, useState } from "react";
import { importCv } from "@/app/actions/profile";
import { Button, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function ProfileImport({ replacing }: { replacing: boolean }) {
  const [state, action, pending] = useActionState(importCv, undefined);
  const [mode, setMode] = useState<"file" | "text">("file");
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-4">
      <div role="tablist" aria-label="How to add your CV" className="flex gap-4 text-sm">
        {(["file", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`border-b-2 pb-1 ${mode === m ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {m === "file" ? "Upload a file" : "Paste the text"}
          </button>
        ))}
      </div>
      {mode === "file" ? (
        <div className="space-y-1.5">
          <label htmlFor="cv-file" className="block text-[13px] font-medium">
            Your CV
          </label>
          <input
            id="cv-file"
            name="file"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-strong-border file:bg-surface file:px-3 file:py-1.5 file:text-sm"
          />
          <p className="text-xs text-muted">PDF, Word (.docx) or text, up to 5 MB.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="cv-text" className="block text-[13px] font-medium">
            CV text
          </label>
          <textarea id="cv-text" name="text" rows={10} className={inputClass} placeholder="Paste everything: name, contact details, jobs, education, skills." />
        </div>
      )}
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Reading your CV…" : replacing ? "Replace my profile" : "Read my CV"}
      </Button>
      {replacing && <p className="text-xs text-muted">This replaces everything in your profile below.</p>}
    </form>
  );
}
