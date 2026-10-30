"use client";

import { changeStatus, interviewDateAction } from "@/app/actions/jobs";
import { STATUS_LABELS, type Status } from "@/lib/services/job-status";

/** Changing the select saves straight away. Once there's an interview, its date can be set too. */
export function StatusControl({ jobId, status, interviewOn }: { jobId: string; status: Status; interviewOn?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <form action={changeStatus} className="flex items-center gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <label htmlFor="job-status" className="text-[13px] text-muted">
          Status
        </label>
        <select
          id="job-status"
          name="status"
          defaultValue={status}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-9 rounded-lg border border-strong-border bg-surface px-2 text-sm"
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="text-[13px] underline">
            Save
          </button>
        </noscript>
      </form>
      {(status === "interview" || status === "offer") && (
        <form action={interviewDateAction} className="flex items-center gap-2">
          <input type="hidden" name="jobId" value={jobId} />
          <label htmlFor="interview-on" className="text-[13px] text-muted">
            Interview
          </label>
          <input
            id="interview-on"
            type="date"
            name="day"
            defaultValue={interviewOn ?? ""}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-9 rounded-lg border border-strong-border bg-surface px-2 text-sm"
          />
        </form>
      )}
    </div>
  );
}
