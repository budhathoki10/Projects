import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { today } from "@/lib/plans";
import { preparedJobIds } from "@/lib/services/documents";
import { listJobs } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Interviews" };

/** Every job with an interview, soonest first, then other jobs worth practising for. */
export default async function Interviews() {
  const user = await requireUser();
  const day = today();
  const [jobs, prepared] = await Promise.all([listJobs(user.id), preparedJobIds(user.id)]);
  const booked = jobs
    .filter((j) => j.status === "interview" || j.status === "offer")
    .sort((a, b) => (a.interviewOn ?? "9999").localeCompare(b.interviewOn ?? "9999"));
  const others = jobs.filter((j) => j.status === "saved" || j.status === "applied");

  const Row = ({ j }: { j: (typeof jobs)[number] }) => {
    const past = j.interviewOn && j.interviewOn < day;
    return (
      <li className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4">
        <div className={`flex w-14 flex-col items-center rounded-lg py-1.5 ${j.interviewOn && !past ? "bg-highlight text-ink" : "bg-background text-muted"}`}>
          {j.interviewOn ? (
            <>
              <span className="text-[10px] font-medium uppercase">{new Date(`${j.interviewOn}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
              <span className="font-mono text-xl leading-none">{Number(j.interviewOn.slice(8))}</span>
            </>
          ) : (
            <Icon name="calendar" size={20} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{j.post.title || "Untitled job"}</p>
          <p className="truncate text-[13px] text-muted">
            {j.post.company}
            {j.interviewOn ? ` · ${past ? "was" : ""} ${formatDay(j.interviewOn)}` : j.status === "interview" ? " · no date set" : ""}
          </p>
        </div>
        <span className={`text-[12px] ${prepared.practised.has(j.id) ? "text-money" : "text-muted"}`}>{prepared.practised.has(j.id) ? "Practice started" : "Not practised yet"}</span>
        <Link href={`/app/jobs/${j.id}/interview`} className="inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[13px] font-medium text-on-ink hover:bg-ink-hover">
          Practise
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <header>
        <Eyebrow>Interview prep</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Interviews</h1>
        <p className="mt-2 max-w-xl text-muted">Questions built from each job and your CV, including the hard ones about gaps. Type your answer and get honest feedback.</p>
      </header>
      <section aria-labelledby="booked" className="space-y-3">
        <h2 id="booked" className="font-serif text-2xl">
          Booked
        </h2>
        {booked.length ? (
          <ul className="space-y-2">
            {booked.map((j) => (
              <Row key={j.id} j={j} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-strong-border p-6 text-sm text-muted">
            No interviews yet. When you get one, set the job to Interviewing and add the date. It shows up here and on Today.
          </p>
        )}
      </section>
      {others.length > 0 && (
        <section aria-labelledby="ahead" className="space-y-3">
          <h2 id="ahead" className="font-serif text-2xl">
            Get ahead
          </h2>
          <p className="text-sm text-muted">Practising before you hear back makes the call less stressful.</p>
          <ul className="space-y-2">
            {others.slice(0, 8).map((j) => (
              <Row key={j.id} j={j} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
