"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

export type CommandJob = { id: string; title: string; company: string };

type Command = { id: string; label: string; hint?: string; icon: IconName; href: string; group: string };

const PAGES: Command[] = [
  { id: "add", label: "Add a job", icon: "plus", href: "/app/jobs?add=1", group: "Actions" },
  { id: "studio", label: "Browse CV templates", icon: "studio", href: "/app/studio/templates", group: "Actions" },
  { id: "cv", label: "Edit your CV", icon: "cv", href: "/app/profile", group: "Actions" },
  { id: "today", label: "Today", icon: "today", href: "/app", group: "Go to" },
  { id: "jobs", label: "Jobs", icon: "jobs", href: "/app/jobs", group: "Go to" },
  { id: "studio-home", label: "CV Studio", icon: "studio", href: "/app/studio", group: "Go to" },
  { id: "interviews", label: "Interviews", icon: "interview", href: "/app/interviews", group: "Go to" },
  { id: "progress", label: "Progress", icon: "progress", href: "/app/progress", group: "Go to" },
  { id: "billing", label: "Plan and billing", icon: "card", href: "/app/billing", group: "Go to" },
  { id: "settings", label: "Settings", icon: "settings", href: "/app/settings", group: "Go to" },
];

/** Every word typed must start a word in the text, so "cs lead" finds "Customer Success Lead". */
function matches(text: string, query: string) {
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((q) => words.some((w) => w.startsWith(q)) || text.toLowerCase().includes(q));
}

/** ⌘K / Ctrl+K: jump to any page, job or action from the keyboard. */
export function CommandBar({ open, onClose, jobs }: { open: boolean; onClose: () => void; jobs: CommandJob[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const items = useMemo(() => {
    const all: Command[] = [
      ...PAGES,
      ...jobs.map((j) => ({ id: `job-${j.id}`, label: j.title || "Untitled job", hint: j.company, icon: "jobs" as const, href: `/app/jobs/${j.id}`, group: "Jobs" })),
    ];
    return query.trim() ? all.filter((c) => matches(`${c.label} ${c.hint ?? ""}`, query)).slice(0, 12) : all.slice(0, 12);
  }, [jobs, query]);

  // Reset when opened. Done during render, not in an effect, so the list never flashes stale.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!open) return null;

  const go = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    router.push(c.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search and jump">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_64px_rgb(0_0_0/0.18)]">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon name="search" className="text-muted" />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(items[active]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search jobs, pages and actions"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${items[active].id}` : undefined}
            aria-label="Search"
          />
          <kbd className="rounded border border-border px-1.5 font-mono text-[11px] text-muted">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches &ldquo;{query}&rdquo;.</li>}
          {items.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${c.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(c)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${i === active ? "bg-background" : ""}`}
            >
              <Icon name={c.icon} size={16} className="text-muted" />
              <span className="truncate">{c.label}</span>
              {c.hint && <span className="truncate text-muted">{c.hint}</span>}
              <span className="ml-auto text-[11px] text-faint">{c.group}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
