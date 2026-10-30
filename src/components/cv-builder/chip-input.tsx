"use client";

import { useId, useState } from "react";
import { Icon } from "../icons";
import { inputClass } from "../ui";

/** A list of short items (skills, languages) as removable chips, with a box to add more and optional one-tap suggestions. */
export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  suggestions = [],
  suggestionsLabel,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  suggestionsLabel?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const add = (raw: string) => {
    const items = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !has(s));
    if (items.length) onChange([...values, ...items]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={id} className="block text-[13px] font-medium">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder={placeholder}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => add(draft)}
            disabled={!draft.trim()}
            className="shrink-0 rounded-lg border border-strong-border bg-surface px-3 text-sm font-medium shadow-1 hover:border-hover-border hover:bg-panel disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
      {values.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-md bg-subtle py-1 pl-2.5 pr-1 text-[13px]">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded p-0.5 text-muted hover:bg-subtle-hover hover:text-foreground">
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] text-muted">{suggestionsLabel ?? "Suggestions"}</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  aria-label={`Add ${s}`}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-strong-border px-2.5 py-1 text-[13px] text-muted hover:border-solid hover:border-hover-border hover:text-foreground"
                >
                  <Icon name="plus" size={14} />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
