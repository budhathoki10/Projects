import type { Metadata } from "next";
import Link from "next/link";
import { followUpAction, weeklyGoalAction } from "@/app/actions/jobs";
import { Icon, type IconName } from "@/components/icons";
import { StrengthMeter } from "@/components/strength-meter";
import { Badge, Button, Card, Eyebrow, FormMessage, scoreTone } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { limitsFor, today } from "@/lib/plans";
import { preparedJobIds } from "@/lib/services/documents";
import { dueFollowUps, isStatus, listJobs, progress, STATUS_LABELS, STATUSES } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { usageThisMonth } from "@/lib/services/usage";
import { nextBestAction, upcomingInterviews, weeklyApplied, type NextAction } from "@/lib/today";

export const metadata: Metadata = { title: "Today" };

const ACTION_ICONS: Record<NextAction["kind"], IconName> = {
  cv: "cv",
  interview: "interview",
  "follow-up": "arrow",
  tailor: "sparkle",
  add: "plus",
  "on-track": "check",
};

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const w = 96;
  const h = 28;
  const step = w / (values.length - 1);
  const ys = values.map((v) => h - 2 - (v / max) * (h - 4));
  const points = ys.map((y, i) => `${(i * step).toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="overflow-visible">
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="var(--brand)" opacity="0.6" />
      <polyline points={points} fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={ys.at(-1)} r="2.5" fill="var(--ink)" />
    </svg>
  );
}

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const share = Math.min(1, done / goal);
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${done} of ${goal} applications this week`} className="shrink-0">
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--subtle)" strokeWidth="8" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${share * circ} ${circ}`}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="44" textAnchor="middle" className="fill-foreground font-mono text-[18px] font-medium">
        {done}
      </text>
      <text x="42" y="58" textAnchor="middle" className="fill-muted text-[10px]">
        of {goal}
      </text>
    </svg>
  );
}

export default async function Today({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const day = today();
  const [{ verified, reset }, profile, jobs, due, stats, usage, prepared] = await Promise.all([
    searchParams,
    getProfile(user.id),
    listJobs(user.id),
    dueFollowUps(user.id),
    progress(user.id),
    usageThisMonth(user.id),
    preparedJobIds(user.id),
  ]);
  const ready = profileReady(profile);
  const limits = limitsFor(user);
  const firstName = (profile?.name || user.name).split(" ")[0];
  const action = nextBestAction({
    profileReady: ready,
    jobs,
    dueFollowUps: due,
    tailored: prepared.tailored,
    practised: prepared.practised,
    appliedThisWeek: stats.appliedThisWeek,
    weeklyGoal: user.weeklyGoal,
    day,
  });
  const trend = weeklyApplied(jobs, day);
  const interviews = upcomingInterviews(jobs, day);
  const inProgress = jobs.filter((j) => j.status === "saved" || j.status === "interview").slice(0, 4);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, jobs.filter((j) => j.status === s).length])) as Record<(typeof STATUSES)[number], number>;
  const maxCount = Math.max(1, ...Object.values(counts));

  const kpis = [
    { id: "applied-week", label: "Applied this week", value: String(stats.appliedThisWeek), extra: <Sparkline values={trend} label={`Applications per week for 8 weeks: ${trend.join(", ")}`} /> },
    { id: "waiting", label: "Waiting to hear", value: String(stats.waiting), extra: <span className="text-right text-[12px] text-muted">{due.length ? `${due.length} worth a nudge` : "Nothing overdue"}</span> },
    { id: "interviews", label: "Interviews", value: String(stats.interviews), extra: <span className="text-right text-[12px] text-muted">{interviews.length ? `Next ${formatDay(interviews[0].interviewOn!)}` : "None booked"}</span> },
    {
      id: "response",
      label: "Response rate",
      value: stats.responseRate === null ? "–" : `${stats.responseRate}%`,
      extra: <span className="text-right text-[12px] text-muted">{stats.applied ? `of ${stats.applied} sent` : "Apply to see it"}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <FormMessage
        success={verified === "1" ? "Email confirmed." : reset === "1" ? "Password changed. You're logged in." : null}
        error={verified === "0" ? "That confirmation link has expired or was already used. Use “Send it again” above for a fresh one." : null}
      />
      <header>
        <Eyebrow>{new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Hi {firstName}</h1>
      </header>

      <section aria-labelledby="next" className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-1 sm:flex-row sm:items-center md:p-7">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong" aria-hidden>
          <Icon name={ACTION_ICONS[action.kind]} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-money">Next best step</p>
          <h2 id="next" className="mt-1 font-serif text-2xl leading-snug md:text-[28px]">
            {action.title}
          </h2>
          <p className="mt-1 max-w-xl text-[15px] text-muted">{action.body}</p>
        </div>
        <Link
          href={action.href}
          className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-ink px-4 text-sm font-medium text-on-ink shadow-1 transition-colors hover:bg-ink-hover sm:self-center"
        >
          {action.cta} <Icon name="arrow" size={16} />
        </Link>
      </section>

      {ready && jobs.length > 0 && (
        <dl aria-label="This week" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <dt className="text-[13px] text-muted">{s.label}</dt>
              <dd className="mt-1 flex items-end justify-between gap-2">
                <span data-testid={`stat-${s.id}`} className="font-mono text-3xl tabular-nums">
                  {s.value}
                </span>
                {s.extra}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {due.length > 0 && (
            <section aria-labelledby="follow-ups">
              <h2 id="follow-ups" className="mb-3 font-serif text-2xl">
                Worth a follow-up
              </h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {due.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/jobs/${j.id}`} className="font-medium underline-offset-4 hover:underline">
                        {j.post.title || "Untitled job"}
                      </Link>
                      <p className="text-[13px] text-muted">
                        {j.post.company && `${j.post.company} · `}applied {j.appliedOn ? formatDay(j.appliedOn) : ""}, no answer yet
                      </p>
                    </div>
                    <form action={followUpAction} className="flex items-center gap-1">
                      <input type="hidden" name="jobId" value={j.id} />
                      <Link href={`/app/jobs/${j.id}`} className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[13px] font-medium text-on-ink hover:bg-ink-hover">
                        See the message
                      </Link>
                      <Button type="submit" name="op" value="done" variant="secondary" className="h-8 py-0">
                        Done
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {interviews.length > 0 && (
            <section aria-labelledby="interviews">
              <h2 id="interviews" className="mb-3 font-serif text-2xl">
                Coming up
              </h2>
              <ul className="space-y-2">
                {interviews.map((j) => (
                  <li key={j.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3">
                    <div className="flex w-12 flex-col items-center rounded-lg bg-brand-soft py-1 text-brand-strong">
                      <span className="text-[10px] font-medium uppercase">{new Date(`${j.interviewOn}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
                      <span className="font-mono text-lg leading-none">{Number(j.interviewOn!.slice(8))}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{j.post.title}</p>
                      <p className="truncate text-[13px] text-muted">{j.post.company}</p>
                    </div>
                    <Link href={`/app/jobs/${j.id}/interview`} className="text-[13px] font-medium underline underline-offset-4">
                      {prepared.practised.has(j.id) ? "Keep practising" : "Practise"}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {inProgress.length > 0 && (
            <section aria-labelledby="in-progress">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id="in-progress" className="font-serif text-2xl">
                  In progress
                </h2>
                <Link href="/app/jobs" className="text-sm underline underline-offset-4">
                  All jobs
                </Link>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {inProgress.map((j) => (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-strong-border">
                      <p className="truncate font-medium">{j.post.title || "Untitled job"}</p>
                      <p className="truncate text-[13px] text-muted">{j.post.company || "Company not stated"}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        {j.match && <Badge tone={scoreTone(j.match.score)}>{j.match.score}% match</Badge>}
                        <span className="text-muted">{isStatus(j.status) ? STATUS_LABELS[j.status] : j.status}</span>
                        {prepared.tailored.has(j.id) && <span className="ml-auto text-money">CV tailored</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4">
              <GoalRing done={stats.appliedThisWeek} goal={user.weeklyGoal} />
              <div className="min-w-0">
                <Eyebrow>Weekly goal</Eyebrow>
                <p className="mt-1 text-sm">
                  {stats.appliedThisWeek >= user.weeklyGoal ? "Reached. Well done." : `${user.weeklyGoal - stats.appliedThisWeek} to go this week.`}
                </p>
                <form action={weeklyGoalAction} className="mt-2 flex items-center gap-2">
                  <label htmlFor="goal" className="text-[12px] text-muted">
                    Goal
                  </label>
                  <input id="goal" name="goal" type="number" min={1} max={30} defaultValue={user.weeklyGoal} className="h-8 w-16 rounded-xl border border-border bg-surface shadow-1 px-2 text-sm" />
                  <button type="submit" className="text-[12px] font-medium underline underline-offset-4">
                    Save
                  </button>
                </form>
              </div>
            </div>
          </Card>

          {jobs.length > 0 && (
            <Card>
              <Eyebrow className="mb-3">Pipeline</Eyebrow>
              <ul className="space-y-2">
                {STATUSES.map((s) => (
                  <li key={s}>
                    <Link href={`/app/jobs#stage-${s}`} className="group grid grid-cols-[90px_1fr_24px] items-center gap-3 text-[13px]">
                      <span className="text-muted group-hover:text-foreground">{STATUS_LABELS[s]}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-subtle">
                        <span className={`block h-full rounded-full ${s === "offer" ? "bg-brand" : s === "rejected" ? "bg-faint" : "bg-foreground/80"}`} style={{ width: `${(counts[s] / maxCount) * 100}%` }} />
                      </span>
                      <span className="text-right font-mono tabular-nums">{counts[s]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {ready && (
            <Card>
              <div className="mb-3 flex items-baseline justify-between">
                <Eyebrow>CV strength</Eyebrow>
                <Link href="/app/studio" className="text-[12px] underline underline-offset-4">
                  CV Studio
                </Link>
              </div>
              <StrengthMeter profile={profile} compact />
            </Card>
          )}

          {ready && (
            <p className="text-[13px] text-muted">
              This month: {usage.tailor} of {limits.tailor} tailored CVs, {usage.cover} of {limits.cover} cover letters, {usage.interview} of {limits.interview}{" "}
              interview sessions.{" "}
              {limits.tailor < 100 && (
                <Link href="/app/billing" className="text-foreground underline underline-offset-4">
                  Get a Job-hunt pass
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
