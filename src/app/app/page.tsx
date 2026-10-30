import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SearchSummary } from "@/components/today/search-summary";
import { StepList } from "@/components/today/step-list";
import { WeekGoal } from "@/components/today/week-goal";
import { FlashToast } from "@/components/toast";
import { FormMessage } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { cvStrength } from "@/lib/cv/strength";
import { today } from "@/lib/plans";
import { preparedJobIds } from "@/lib/services/documents";
import { dueFollowUps, isStatus, listJobs, progress, STATUS_LABELS, STATUSES } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { nextSteps, upcomingInterviews, weeklyApplied } from "@/lib/today";

export const metadata: Metadata = { title: "Today" };

const longDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function Today({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const day = today();
  const [{ verified, reset }, profile, jobs, due, stats, prepared] = await Promise.all([
    searchParams,
    getProfile(user.id),
    listJobs(user.id),
    dueFollowUps(user.id),
    progress(user.id),
    preparedJobIds(user.id),
  ]);
  const ready = profileReady(profile);
  const strength = ready ? cvStrength(profile) : null;
  const steps = nextSteps({
    profileReady: ready,
    jobs,
    dueFollowUps: due,
    tailored: prepared.tailored,
    practised: prepared.practised,
    appliedThisWeek: stats.appliedThisWeek,
    weeklyGoal: user.weeklyGoal,
    day,
    cv: strength && { score: strength.score, failing: strength.checks.filter((c) => !c.ok).map((c) => c.label) },
  });
  const interviews = upcomingInterviews(jobs, day);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, jobs.filter((j) => j.status === s).length])) as Record<(typeof STATUSES)[number], number>;
  const recent = jobs.filter((j) => j.status !== "rejected").slice(0, 5);

  return (
    <div className="mx-auto max-w-[760px] space-y-10">
      <FlashToast message={verified === "1" ? "Email confirmed. Thanks." : reset === "1" ? "Password changed. You're logged in." : null} clear={["verified", "reset"]} />
      <FormMessage error={verified === "0" ? "That confirmation link has expired or was already used. Use “Resend link” at the top for a fresh one." : null} />
      <PageHeader title="Today" subtitle={longDate(day)} actions={ready ? <WeekGoal done={stats.appliedThisWeek} goal={user.weeklyGoal} /> : undefined} />

      <section aria-labelledby="up-next">
        <SectionHeading id="up-next">Up next</SectionHeading>
        <StepList steps={steps} />
      </section>

      {ready && jobs.length > 0 && (
        <section aria-labelledby="search">
          <SectionHeading id="search">Your search</SectionHeading>
          <SearchSummary counts={counts} responseRate={stats.responseRate} waiting={stats.waiting} applied={stats.applied} weekly={weeklyApplied(jobs, day)} />
        </section>
      )}

      {interviews.length > 0 && (
        <section aria-labelledby="coming-up">
          <SectionHeading id="coming-up">Coming up</SectionHeading>
          <ul className="divide-y divide-border border-y border-border">
            {interviews.map((j) => (
              <li key={j.id} className="flex items-center gap-4 py-3 text-[15px]">
                <span className="w-24 shrink-0 font-medium tabular-nums">{shortDate(j.interviewOn!)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {j.post.title}
                  <span className="text-muted"> · {j.post.company}</span>
                </span>
                <Link href={`/app/jobs/${j.id}/interview`} className="shrink-0 text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
                  {prepared.practised.has(j.id) ? "Keep practising" : "Practise"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent">
          <SectionHeading
            id="recent"
            action={
              <Link href="/app/jobs" className="underline-offset-4 hover:text-foreground hover:underline">
                All jobs
              </Link>
            }
          >
            Recent jobs
          </SectionHeading>
          <ul className="divide-y divide-border border-y border-border">
            {recent.map((j) => (
              <li key={j.id}>
                <Link href={`/app/jobs/${j.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-3 text-[15px] hover:bg-panel sm:grid-cols-[1fr_10rem_7rem_3rem]">
                  <span className="min-w-0 truncate font-medium">{j.post.title || "Untitled job"}</span>
                  <span className="hidden truncate text-muted sm:block">{j.post.company}</span>
                  <span className="hidden text-[13px] text-muted sm:block">{isStatus(j.status) ? STATUS_LABELS[j.status] : j.status}</span>
                  <span className={`text-right text-[13px] tabular-nums ${j.match && j.match.score >= 80 ? "font-medium text-money" : "text-muted"}`}>
                    {j.match ? `${j.match.score}%` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
