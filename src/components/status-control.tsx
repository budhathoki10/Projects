"use client";

import { useOptimistic, useTransition } from "react";
import { changeStatus } from "@/app/actions/jobs";
import { STATUS_LABELS, type Status } from "@/lib/services/job-status";
import { useToast } from "./toast";

/**
 * Changing the select takes effect on screen at once; the save happens in the background.
 * If it fails the select goes back and a toast says so. A successful change offers Undo.
 */
export function StatusControl({ jobId, status }: { jobId: string; status: Status }) {
  const [shown, setShown] = useOptimistic(status);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const save = (next: Status, previous: Status, announce: boolean) =>
    startTransition(async () => {
      setShown(next);
      const data = new FormData();
      data.set("jobId", jobId);
      data.set("status", next);
      try {
        await changeStatus(data);
        if (announce) {
          toast.show({ message: `Moved to ${STATUS_LABELS[next]}`, action: { label: "Undo", onClick: () => save(previous, next, false) } });
        }
      } catch {
        toast.show({ tone: "error", message: "Couldn’t update the status. Check your connection and try again." });
      }
    });

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="job-status" className="text-[13px] text-muted">
        Status
      </label>
      <select
        id="job-status"
        name="status"
        value={shown}
        onChange={(e) => save(e.target.value as Status, shown, true)}
        className="h-9 rounded border border-strong-border bg-surface px-2.5 text-sm transition-colors duration-150 hover:border-faint max-sm:h-11 max-sm:text-base"
      >
        {Object.entries(STATUS_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
