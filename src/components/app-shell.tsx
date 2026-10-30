"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CommandBar, type CommandJob } from "./command-bar";
import { Icon, type IconName } from "./icons";
import { Logo } from "./ui";

type NavItem = { href: string; label: string; icon: IconName; short?: string };

export const NAV: NavItem[] = [
  { href: "/app", label: "Today", icon: "today" },
  { href: "/app/jobs", label: "Jobs", icon: "jobs" },
  { href: "/app/profile", label: "Your CV", icon: "cv" },
  { href: "/app/studio", label: "CV Studio", icon: "studio", short: "Studio" },
  { href: "/app/interviews", label: "Interviews", icon: "interview" },
  { href: "/app/progress", label: "Progress", icon: "progress" },
];

const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

const TITLES: [RegExp, string][] = [
  [/^\/app$/, "Today"],
  [/^\/app\/jobs\/[^/]+/, "Job"],
  [/^\/app\/jobs/, "Jobs"],
  [/^\/app\/profile/, "Your CV"],
  [/^\/app\/studio\/templates/, "Templates"],
  [/^\/app\/studio\/edit/, "Template editor"],
  [/^\/app\/studio/, "CV Studio"],
  [/^\/app\/interviews/, "Interviews"],
  [/^\/app\/progress/, "Progress"],
  [/^\/app\/settings/, "Settings"],
  [/^\/app\/billing/, "Plan and billing"],
];

export type ShellUser = { name: string; email: string; pass: { daysLeft: number } | null; allowance: { used: number; limit: number } };

function PassCard({ user }: { user: ShellUser }) {
  if (user.pass) {
    return (
      <Link href="/app/billing" className="block rounded-lg border border-border bg-background p-3 text-[13px] hover:border-strong-border">
        <p className="font-medium">Job-hunt pass</p>
        <p className="mt-0.5 text-muted">
          {user.pass.daysLeft} {user.pass.daysLeft === 1 ? "day" : "days"} left
        </p>
      </Link>
    );
  }
  const { used, limit } = user.allowance;
  return (
    <Link href="/app/billing" className="block rounded-lg border border-border bg-background p-3 text-[13px] hover:border-strong-border">
      <p className="font-medium">Free plan</p>
      <p className="mt-0.5 text-muted">
        {Math.max(0, limit - used)} of {limit} tailored CVs left this month
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full bg-ink" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
      </div>
      <p className="mt-2 font-medium text-ink underline underline-offset-4">Get a pass</p>
    </Link>
  );
}

function AccountMenu({ user, logout }: { user: ShellUser; logout: () => Promise<void> }) {
  return (
    <details className="relative [&_summary::-webkit-details-marker]:hidden">
      <summary
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-highlight font-medium text-ink hover:ring-2 hover:ring-border"
        aria-label="Account menu"
      >
        {user.name.trim().charAt(0).toUpperCase() || "?"}
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-border bg-surface p-1.5 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.10)]">
        <div className="border-b border-border px-3 py-2">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-[13px] text-muted">{user.email}</p>
        </div>
        <Link href="/app/billing" className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 hover:bg-background">
          <Icon name="card" size={16} /> Plan and billing
        </Link>
        <Link href="/app/settings" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-background">
          <Icon name="settings" size={16} /> Settings
        </Link>
        <form action={logout}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-background">
            <Icon name="logout" size={16} /> Log out
          </button>
        </form>
      </div>
    </details>
  );
}

/**
 * The signed-in app frame: a sidebar on desktop (icons only on tablets), a slim top bar with
 * search and "Add job", and a bottom tab bar with a floating "Add job" button on phones.
 */
export function AppShell({
  user,
  followUps,
  jobs,
  banner,
  logout,
  children,
}: {
  user: ShellUser;
  followUps: number;
  jobs: CommandJob[];
  banner?: ReactNode;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Shortlist";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the phone "More" sheet after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
  }

  const badge = (href: string) =>
    href === "/app" && followUps > 0 ? (
      <span className="ml-auto rounded-full bg-ink px-1.5 py-px font-mono text-[11px] text-on-ink lg:ml-auto" aria-label={`${followUps} to follow up`}>
        {followUps}
      </span>
    ) : null;

  return (
    <div className="flex min-h-dvh print:block">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Sidebar: full on desktop, icons only on tablets, hidden on phones. */}
      <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-border bg-surface md:flex lg:w-60 print:hidden">
        <Link href="/app" className="flex h-14 items-center px-5" aria-label="Shortlist, Today">
          <span className="hidden lg:inline">
            <Logo />
          </span>
          <svg className="lg:hidden" width="26" height="26" viewBox="0 0 18 18" aria-hidden="true">
            <rect x="1" y="1" width="16" height="16" rx="4" fill="var(--highlight)" />
            <path d="M5 9.5l2.6 2.6L13 6.5" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <nav aria-label="Main" className="mt-2 flex-1 space-y-0.5 px-3">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                title={n.label}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-background font-medium text-foreground" : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-ink" aria-hidden />}
                <Icon name={n.icon} />
                <span className="hidden lg:inline">{n.label}</span>
                <span className="hidden lg:contents">{badge(n.href)}</span>
                {n.href === "/app" && followUps > 0 && <span className="absolute right-2 top-1.5 size-2 rounded-full bg-pen lg:hidden" aria-hidden />}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 p-3">
          <div className="hidden lg:block">
            <PassCard user={user} />
          </div>
          <Link
            href="/app/settings"
            title="Settings"
            aria-current={isActive(pathname, "/app/settings") ? "page" : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background hover:text-foreground aria-[current=page]:text-foreground"
          >
            <Icon name="settings" />
            <span className="hidden lg:inline">Settings</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6 print:hidden">
          <Link href="/app" className="md:hidden" aria-label="Shortlist, Today">
            <svg width="24" height="24" viewBox="0 0 18 18" aria-hidden="true">
              <rect x="1" y="1" width="16" height="16" rx="4" fill="var(--highlight)" />
              <path d="M5 9.5l2.6 2.6L13 6.5" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <p className="truncate text-sm font-medium" aria-hidden>
            {title}
          </p>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted hover:border-strong-border md:w-64"
            aria-label="Search and jump (Ctrl+K)"
          >
            <Icon name="search" size={16} />
            <span className="hidden md:inline">Search or jump to…</span>
            <kbd className="ml-auto hidden rounded border border-border px-1.5 font-mono text-[11px] md:inline">⌘K</kbd>
          </button>
          <Link
            href="/app/jobs?add=1"
            className="hidden h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-sm font-medium text-on-ink hover:bg-ink-hover md:flex"
          >
            <Icon name="plus" size={16} /> Add job
          </Link>
          <AccountMenu user={user} logout={logout} />
        </header>
        {banner}
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>

      {/* Phones: bottom tabs and a floating Add job button. */}
      <Link
        href="/app/jobs?add=1"
        aria-label="Add job"
        className="fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-ink text-on-ink shadow-[0_8px_24px_rgb(0_0_0/0.18)] md:hidden print:hidden"
      >
        <Icon name="plus" size={24} />
      </Link>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {[NAV[0], NAV[1], NAV[3]].map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-foreground" : "text-muted"}`}
            >
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-b bg-ink" aria-hidden />}
              <Icon name={n.icon} size={22} />
              {n.short ?? n.label}
              {n.href === "/app" && followUps > 0 && <span className="absolute right-[30%] top-1.5 size-2 rounded-full bg-pen" aria-hidden />}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted"
        >
          <Icon name="more" size={22} />
          More
        </button>
      </nav>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
            <div className="grid grid-cols-3 gap-2">
              {[NAV[2], NAV[4], NAV[5], { href: "/app/settings", label: "Settings", icon: "settings" as const }, { href: "/app/billing", label: "Billing", icon: "card" as const }].map((n) => (
                <Link key={n.href} href={n.href} className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-[13px]">
                  <Icon name={n.icon} size={22} />
                  {n.label}
                </Link>
              ))}
            </div>
            <div className="mt-3">
              <PassCard user={user} />
            </div>
          </div>
        </div>
      )}
      <CommandBar open={searchOpen} onClose={() => setSearchOpen(false)} jobs={jobs} />
    </div>
  );
}
