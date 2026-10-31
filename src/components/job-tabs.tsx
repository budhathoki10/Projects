"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** The four steps of an application, in order. */
const TABS = [
  { slug: "", label: "Fit", short: "Fit", step: null },
  { slug: "cv", label: "Tailored CV", short: "CV", step: "cv" },
  { slug: "cover-letter", label: "Cover letter", short: "Letter", step: "letter" },
  { slug: "interview", label: "Interview", short: "Interview", step: "interview" },
] as const;

export type JobSteps = { cv: boolean; letter: boolean; interview: boolean };

export function JobTabs({ jobId, done }: { jobId: string; done: JobSteps }) {
  const pathname = usePathname();
  const base = `/app/jobs/${jobId}`;
  const row = useRef<HTMLDivElement>(null);
  // On a phone the row scrolls sideways, so make sure the current tab is the one in view.
  useEffect(() => {
    const active = row.current?.querySelector<HTMLElement>("[aria-current=page]");
    if (!active || !row.current) return;
    const box = row.current;
    box.scrollLeft = Math.max(0, active.offsetLeft - (box.clientWidth - active.offsetWidth) / 2);
  }, [pathname]);
  return (
    <nav aria-label="This job" className="rounded-lg border border-border bg-surface p-1 print:hidden">
      <div ref={row} className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base;
          const active = pathname === href || (!!t.slug && pathname.startsWith(`${href}/`));
          const finished = t.step ? done[t.step] : false;
          return (
            <Link
              key={t.slug}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-4 text-sm max-sm:flex-1 max-sm:px-2 transition-colors duration-150 ${
                active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {/* Short names on phones so all four steps fit; screen readers always hear the full name. */}
              <span aria-hidden="true" className="sm:hidden">
                {t.short}
              </span>
              <span className="max-sm:sr-only">{t.label}</span>
              {finished && (
                <>
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  <span className="sr-only">(done)</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
