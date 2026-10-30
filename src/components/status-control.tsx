"use client";

import { changeStatus } from "@/app/actions/jobs";
import { STATUS_LABELS, type Status } from "@/lib/services/job-status";

/** Changing the select saves straight away. */
export function StatusControl({ jobId, status }: { jobId: string; status: Status }) {
  return (
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
        className="rounded-[5px] border border-strong-border bg-surface px-2 py-1 text-sm"
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
  );
}
