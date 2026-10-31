"use client";

import { ActionToast } from "@/components/toast";
import { useActionState } from "react";
import { prepareApplicationPlan, saveLearningTask } from "@/app/actions/career";
import type { LearningProgress } from "@/lib/career/types";
import { Button, inputClass } from "../ui";

export function PlanBuilder({ jobId, exists, companyUrl = "" }: { jobId: string; exists: boolean; companyUrl?: string }) {
  const [state, action, pending] = useActionState(prepareApplicationPlan, undefined);
  return <form action={action} className="space-y-4 rounded-lg border border-border bg-surface p-5">
    <input type="hidden" name="jobId" value={jobId} />
    <div><h2 className="font-semibold">{exists ? "Refresh the application plan" : "Understand this job before applying"}</h2><p className="mt-1 text-sm leading-relaxed text-muted">Map the complete description to your CV, check essential gaps and prepare a focused learning plan. Uses one tailoring allowance.</p></div>
    <div className="space-y-1.5"><label htmlFor="company-website" className="text-sm font-medium">Company website <span className="font-normal text-muted">(optional)</span></label><input id="company-website" name="companyUrl" type="url" defaultValue={companyUrl} placeholder="https://company.example" maxLength={2000} className={inputClass} /><p className="text-xs text-muted">Use the employer’s own website. We read its homepage and up to two linked company pages; without it, company details stay unverified.</p></div>
    <Button type="submit" loading={pending}>{pending ? "Reading the job, CV and company sources…" : exists ? "Refresh plan" : "Build application plan"}</Button>
    <ActionToast state={state} />
  </form>;
}

export function LearningTaskForm({ jobId, taskId, progress }: { jobId: string; taskId: string; progress?: LearningProgress[string] }) {
  const [state, action, pending] = useActionState(saveLearningTask, undefined);
  return <form action={action} className="space-y-3 border-t border-border pt-4">
    <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="taskId" value={taskId} />
    <div className="space-y-1.5"><label htmlFor={`url-${taskId}`} className="text-sm font-medium">Work sample or evidence URL</label><input id={`url-${taskId}`} name="evidenceUrl" type="url" defaultValue={progress?.evidenceUrl ?? ""} className={inputClass} placeholder="https://example.com/my-work-sample" maxLength={2000} /></div>
    <div className="space-y-1.5"><label htmlFor={`notes-${taskId}`} className="text-sm font-medium">What you completed and checked</label><textarea id={`notes-${taskId}`} name="notes" rows={3} maxLength={2000} defaultValue={progress?.notes ?? ""} className={inputClass} placeholder="Describe your actual work, the checks you ran, and what you still need help with." /></div>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="completed" defaultChecked={progress?.completed} className="size-4 accent-accent" /> I completed these practice checks</label>
    <Button type="submit" variant="secondary" size="sm" loading={pending}>{pending ? "Saving…" : "Save learning progress"}</Button>
    <ActionToast state={state} />
  </form>;
}
