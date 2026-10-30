"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/app", label: "Today" },
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/profile", label: "Your CV" },
  { href: "/app/progress", label: "Progress" },
  { href: "/app/settings", label: "Settings" },
];

export function AppNav({ followUps = 0 }: { followUps?: number }) {
  const pathname = usePathname();
  return (
    <nav className="order-last -mb-px flex w-full gap-5 overflow-x-auto text-sm sm:order-none sm:mr-auto sm:w-auto">
      {NAV.map((n) => {
        const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 py-3 ${active ? "border-ink text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {n.label}
            {n.href === "/app" && followUps > 0 && (
              <span className="ml-1.5 rounded-full bg-ink px-1.5 py-px font-mono text-[11px] text-on-ink" aria-label={`${followUps} to follow up`}>
                {followUps}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
