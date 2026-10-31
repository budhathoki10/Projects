"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TABS = [
  { slug: "", label: "Match" },
  { slug: "plan", label: "Application plan" },
  { slug: "cv", label: "Tailored CV" },
  { slug: "cover-letter", label: "Cover letter" },
  { slug: "interview", label: "Interview prep" },
];

export function JobTabs({ jobId }: { jobId: string }) {
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
          return (
            <Link
              key={t.slug}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-4 text-sm transition-colors duration-150 ${
                active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
