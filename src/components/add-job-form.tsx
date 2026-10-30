"use client";

import { useActionState, useState } from "react";
import { addJob } from "@/app/actions/jobs";
import { Button, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function AddJobForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [state, action, pending] = useActionState(addJob, undefined);
  const [paste, setPaste] = useState(false);
  const showText = paste || state?.needText;
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-3">
      <label htmlFor="job-url" className="block text-[13px] font-medium">
        Link to the job post
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="job-url"
          name="url"
          type="text"
          inputMode="url"
          defaultValue={state?.url}
          placeholder="https://"
          autoFocus={autoFocus}
          className={inputClass}
        />
        {!showText && (
          <Button type="submit" disabled={pending} className="shrink-0">
            {pending ? "Reading the post…" : "Add job"}
          </Button>
        )}
      </div>
      {!showText ? (
        <button type="button" onClick={() => setPaste(true)} className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
          Or paste the job description
        </button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="job-text" className="block text-[13px] font-medium">
            Job description
          </label>
          <textarea
            id="job-text"
            name="text"
            rows={10}
            autoFocus={!!state?.needText}
            className={inputClass}
            placeholder="Paste the whole post: title, company, what you'd do, and what they're looking for."
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Reading the post…" : "Add job"}
          </Button>
        </div>
      )}
      <FormMessage error={state?.error} />
    </form>
  );
}
