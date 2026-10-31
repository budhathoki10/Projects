"use client";

import { useRef, useState, useTransition } from "react";
import { saveNotes } from "@/app/actions/jobs";
import { useToast } from "./toast";
import { inputClass } from "./ui";

/** Notes save themselves when you click away, so there is no button to forget. Esc puts back what was saved. */
export function NotesField({ jobId, initial }: { jobId: string; initial: string }) {
  const saved = useRef(initial);
  const skipBlur = useRef(false);
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  const toast = useToast();

  const save = (text = value) => {
    if (text === saved.current) return;
    setStatus("saving");
    const data = new FormData();
    data.set("jobId", jobId);
    data.set("notes", text);
    startTransition(async () => {
      try {
        await saveNotes(data);
        saved.current = text;
        setStatus("saved");
      } catch {
        setStatus("error");
        toast.show({
          tone: "error",
          key: "notes",
          message: "Notes not saved",
          description: "Your draft is still here.",
          // Retry with whatever is in the box now, not what it held when the save failed.
          action: { label: "Retry", onClick: () => save((document.getElementById("notes") as HTMLTextAreaElement | null)?.value ?? text) },
        });
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor="notes" className="t-label">
          Notes
        </label>
        <span role="status" className={`text-xs ${status === "error" ? "text-danger" : "text-faint"}`}>
          {status === "saving" ? "Saving notes…" : status === "saved" ? "Notes saved" : status === "error" ? "Not saved" : ""}
        </span>
      </div>
      <textarea
        id="notes"
        rows={4}
        maxLength={5000}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        onBlur={() => {
          if (skipBlur.current) skipBlur.current = false;
          else save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            skipBlur.current = true;
            setValue(saved.current);
            e.currentTarget.blur();
          } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            save();
          }
        }}
        placeholder="Recruiter’s name, salary talk, interview dates…"
        className={inputClass}
      />
    </div>
  );
}
