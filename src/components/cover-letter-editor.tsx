"use client";

import { useActionState, useState } from "react";
import { saveCover, writeCover } from "@/app/actions/tailor";
import { Button, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function CoverLetterEditor({ jobId, initial, flags }: { jobId: string; initial: string; flags: string[] }) {
  const [saved, save, saving] = useActionState(saveCover, undefined);
  const [drafted, draft, drafting] = useActionState(writeCover, undefined);
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the text is selectable.
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={keepInputOnSubmit(save)} className="space-y-3">
        <input type="hidden" name="jobId" value={jobId} />
        <textarea
          name="text"
          aria-label="Cover letter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(14, text.split("\n").length + 2)}
          className={`${inputClass} font-serif text-[16px] leading-relaxed`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <button type="button" onClick={copy} className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
            {copied ? "Copied" : "Copy text"}
          </button>
          <span className={`text-xs ${words > 300 ? "text-pen" : "text-muted"}`}>{words} words{words > 300 ? ": aim for under 300" : ""}</span>
        </div>
        <FormMessage error={saved?.error} success={saved?.success} />
      </form>
      {flags.length > 0 && (
        <p role="alert" className="border-l-2 border-pen bg-pen-soft px-3 py-2 text-sm text-pen">
          Check these before sending. They&apos;re not in your CV or the job post: <strong>{flags.join(", ")}</strong>
        </p>
      )}
      <form action={draft} className="border-t border-border pt-4">
        <input type="hidden" name="jobId" value={jobId} />
        <Button type="submit" variant="ghost" className="px-0!" disabled={drafting}>
          {drafting ? "Writing…" : "Write a new draft"}
        </Button>
        <FormMessage error={drafted?.error} />
      </form>
    </div>
  );
}
