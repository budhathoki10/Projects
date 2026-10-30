"use client";

import { useId, useState, useTransition } from "react";
import { turnNotesIntoBullets } from "@/app/actions/profile";
import type { Suggestion } from "@/lib/cv/builder";
import { Button, inputClass } from "../ui";

/**
 * A rough-notes box for one role or project. "Turn into bullet points" proposes a few bullets
 * from the notes alone; the person picks which to use. Anything the fact check can't find in the
 * notes or profile starts unticked, with the words named.
 */
export function NotesToBullets({ title, company, onUse }: { title: string; company: string; onUse: (bullets: string[]) => void }) {
  const id = useId();
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ask = () =>
    start(async () => {
      setError(null);
      const res = await turnNotesIntoBullets({ notes, title, company });
      if (res.error || !res.suggestions) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setSuggestions(res.suggestions);
      setPicked(res.suggestions.map((s) => s.flags.length === 0));
    });

  const use = () => {
    onUse(suggestions!.filter((_, i) => picked[i]).map((s) => s.text));
    setSuggestions(null);
    setNotes("");
  };

  return (
    <div className="space-y-3 rounded-lg bg-panel p-4">
      <div className="space-y-1">
        <label htmlFor={id} className="block text-[13px] font-medium">
          What did you do there?
        </label>
        <textarea
          id={id}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          aria-describedby={`${id}-hint`}
          placeholder="I looked after 12 patients a shift, trained new nurses, and started a checklist for handovers so fewer things got missed."
          className={`${inputClass} leading-relaxed`}
        />
        <p id={`${id}-hint`} className="text-xs text-muted">
          Write it the way you&apos;d tell a friend. We only use what you write here.
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={ask} disabled={pending || notes.trim().length < 10}>
        {pending ? "Writing…" : "Turn into bullet points"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-pen-strong">
          {error}
        </p>
      )}
      {suggestions && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[13px] font-medium">Tick the ones to use. You can edit them after.</legend>
          {suggestions.map((s, i) => (
            <label key={i} className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={picked[i] ?? false}
                onChange={(e) => setPicked((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))}
                className="mt-0.5 size-4 accent-[var(--ink)]"
              />
              <span className="min-w-0">
                {s.text}
                {s.flags.length > 0 && (
                  <span className="mt-1 block text-xs text-notice-strong">Check this: &ldquo;{s.flags.join("”, “")}&rdquo; isn&apos;t in your notes.</span>
                )}
              </span>
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={use} disabled={!picked.some(Boolean)}>
              Add {picked.filter(Boolean).length === 1 ? "this point" : "these points"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSuggestions(null)}>
              Discard
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
