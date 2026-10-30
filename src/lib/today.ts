import { addDays } from "@/lib/dates";

/** Plain logic behind the Today page, kept out of the page so it can be tested. */

type JobLike = { id: string; status: string; appliedOn: string | null; interviewOn: string | null; post: { title: string; company: string } };

/** Applications sent in each of the last `weeks` weeks, oldest first. A week ends on `day`. */
export function weeklyApplied(jobs: Pick<JobLike, "appliedOn">[], day: string, weeks = 8): number[] {
  return Array.from({ length: weeks }, (_, i) => {
    const end = addDays(day, -7 * (weeks - 1 - i));
    const start = addDays(end, -6);
    return jobs.filter((j) => j.appliedOn && j.appliedOn >= start && j.appliedOn <= end).length;
  });
}

export function upcomingInterviews<J extends JobLike>(jobs: J[], day: string, limit = 3): J[] {
  return jobs
    .filter((j) => j.interviewOn && j.interviewOn >= day && (j.status === "interview" || j.status === "offer"))
    .sort((a, b) => a.interviewOn!.localeCompare(b.interviewOn!))
    .slice(0, limit);
}

export type StepKind = "cv" | "interview" | "follow-up" | "tailor" | "cv-fix" | "goal";

export type Step = {
  kind: StepKind;
  title: string;
  detail: string;
  href: string;
  cta: string;
  /** A second, quieter action (e.g. "Build one with help"). */
  alt?: { href: string; label: string };
  /** For follow-ups: the job, so the row can offer "Done". */
  jobId?: string;
};

export const MAX_STEPS = 5;

const daysUntil = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const at = (j: JobLike) => [j.post.title || "Untitled job", j.post.company].filter(Boolean).join(" · ");

/**
 * Today's to-do list, most useful first: add a CV; practise for interviews in the next 3 days;
 * send follow-ups that are due; tailor saved jobs; fix a weak CV; reach the weekly goal.
 * At most MAX_STEPS. An empty list means the user is all caught up.
 */
export function nextSteps(input: {
  profileReady: boolean;
  jobs: JobLike[];
  dueFollowUps: JobLike[];
  tailored: Set<string>;
  practised: Set<string>;
  appliedThisWeek: number;
  weeklyGoal: number;
  day: string;
  /** CV strength, when there's a CV: the score and the labels of the checks that fail. */
  cv?: { score: number; failing: string[] } | null;
}): Step[] {
  const { jobs, day } = input;
  if (!input.profileReady) {
    return [
      {
        kind: "cv",
        title: "Add your CV",
        detail: "Every tailored CV, letter and interview question is built from it, and nothing else.",
        href: "/app/profile",
        cta: "Upload my CV",
        alt: { href: "/app/profile/build", label: "No CV? Build one with help" },
      },
    ];
  }

  const steps: Step[] = [];
  for (const j of upcomingInterviews(jobs, day, 10).filter((j) => daysUntil(day, j.interviewOn!) <= 3)) {
    const d = daysUntil(day, j.interviewOn!);
    const when = d === 0 ? "today's" : d === 1 ? "tomorrow's" : `your interview in ${d} days`;
    steps.push({
      kind: "interview",
      title: d <= 1 ? `Practise for ${when} interview` : `Practise for ${when}`,
      detail: `${at(j)}${input.practised.has(j.id) ? " · started" : ""}`,
      href: `/app/jobs/${j.id}/interview`,
      cta: input.practised.has(j.id) ? "Keep practising" : "Practise",
    });
  }
  for (const j of input.dueFollowUps) {
    steps.push({
      kind: "follow-up",
      title: `Follow up with ${j.post.company || "the employer"}`,
      detail: `${j.post.title || "Untitled job"}${j.appliedOn ? ` · applied ${new Date(`${j.appliedOn}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}` : ""} · no reply yet`,
      href: `/app/jobs/${j.id}`,
      cta: "See the message",
      jobId: j.id,
    });
  }
  for (const j of jobs.filter((j) => j.status === "saved" && !input.tailored.has(j.id))) {
    steps.push({ kind: "tailor", title: `Tailor your CV for ${j.post.title || "this job"}`, detail: at(j), href: `/app/jobs/${j.id}/cv`, cta: "Tailor" });
  }
  if (input.cv && input.cv.score < 85 && input.cv.failing.length) {
    const n = input.cv.failing.length;
    steps.push({
      kind: "cv-fix",
      title: `Fix ${n} ${n === 1 ? "thing" : "things"} in your CV`,
      detail: input.cv.failing.slice(0, 3).join(", "),
      href: "/app/studio",
      cta: "Fix",
    });
  }
  if (input.appliedThisWeek < input.weeklyGoal) {
    const left = input.weeklyGoal - input.appliedThisWeek;
    steps.push({
      kind: "goal",
      title: jobs.length ? `Add ${left} more ${left === 1 ? "application" : "applications"} this week` : "Add a job you'd like",
      detail: jobs.length ? "Paste a job you like and see how well you fit before you spend time on it." : "Paste a link or the description, and see how well your CV fits before you apply.",
      href: "/app/jobs?add=1",
      cta: "Add a job",
    });
  }
  return steps.slice(0, MAX_STEPS);
}
