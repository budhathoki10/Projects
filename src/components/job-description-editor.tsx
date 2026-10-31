"use client";

import { ActionToast } from "@/components/toast";
import { useActionState } from "react";
import { updateJobDescription } from "@/app/actions/jobs";
import { FormSubmit } from "./form-submit";
import { inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function JobDescriptionEditor({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(updateJobDescription, undefined);
  return <form id="job-description" method="post" onSubmit={keepInputOnSubmit(action)} className="space-y-4 rounded-xl border border-warning/25 bg-surface p-5 sm:p-6">
    <input type="hidden" name="jobId" value={jobId} />
    <div><p className="t-label text-warning">Job description needed</p><h2 className="t-title mt-1">Let’s read the actual vacancy</h2><p className="mt-2 text-sm leading-relaxed text-muted">The saved page contains search results or too few requirements. A 0% score here would be misleading. Paste the full description for this role to get a useful match.</p></div>
    <label className="block space-y-2"><span className="t-label">Full job description</span><textarea name="text" rows={9} required minLength={120} maxLength={40000} className={inputClass} placeholder="Job title, company, responsibilities, required skills and experience…" /></label>
    <FormSubmit loading={pending}>{pending ? "Reading the vacancy…" : "Update job description"}</FormSubmit>
    <ActionToast state={state} />
  </form>;
}
