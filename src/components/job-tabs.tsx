"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Match" },
  { slug: "cv", label: "Tailored CV" },
  { slug: "cover-letter", label: "Cover letter" },
  { slug: "interview", label: "Interview prep" },
];

export function JobTabs({ jobId }: { jobId: string }) {
  const pathname = usePathname();
  const base = `/app/jobs/${jobId}`;
  return (
    <nav aria-label="This job" className="-mx-4 overflow-x-auto border-b border-border px-4 md:-mx-8 md:px-8 print:hidden">
      <div className="flex gap-6 text-sm">
        {TABS.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base;
          const active = pathname === href;
          return (
            <Link
              key={t.slug}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 py-2.5 ${active ? "border-ink text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
