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

export type NextAction = { title: string; body: string; href: string; cta: string; kind: "cv" | "interview" | "follow-up" | "tailor" | "add" | "on-track" };

/**
 * The single most useful thing to do now: add a CV, practise for an interview in the next 3 days,
 * send a follow-up that's due, tailor a saved job, add jobs to reach the weekly goal, or nothing.
 */
export function nextBestAction(input: {
  profileReady: boolean;
  jobs: JobLike[];
  dueFollowUps: JobLike[];
  tailored: Set<string>;
  practised: Set<string>;
  appliedThisWeek: number;
  weeklyGoal: number;
  day: string;
}): NextAction {
  const { jobs, day } = input;
  const label = (j: JobLike) => `${j.post.title || "this job"}${j.post.company ? ` at ${j.post.company}` : ""}`;
  if (!input.profileReady) {
    return { kind: "cv", title: "Add your CV", body: "Upload it once. Every tailored CV, letter and interview question is built from it and nothing else.", href: "/app/profile", cta: "Add your CV" };
  }
  const soon = upcomingInterviews(jobs, day, 10).find((j) => j.interviewOn! <= addDays(day, 3));
  if (soon) {
    const days = Math.round((Date.parse(soon.interviewOn!) - Date.parse(day)) / 86_400_000);
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    return {
      kind: "interview",
      title: `Interview ${when}: ${label(soon)}`,
      body: input.practised.has(soon.id) ? "You've started practising. Go through the questions you skipped and say your answers out loud." : "Practise the likely questions now, including the ones about your gaps.",
      href: `/app/jobs/${soon.id}/interview`,
      cta: "Practise answers",
    };
  }
  const due = input.dueFollowUps[0];
  if (due) {
    return {
      kind: "follow-up",
      title: `Follow up with ${due.post.company || "the employer"}`,
      body: `You applied for ${due.post.title || "this job"} a week ago with no answer. A short, polite note is ready to send.`,
      href: `/app/jobs/${due.id}`,
      cta: "See the message",
    };
  }
  const untailored = jobs.find((j) => j.status === "saved" && !input.tailored.has(j.id));
  if (untailored) {
    return {
      kind: "tailor",
      title: `Tailor your CV for ${label(untailored)}`,
      body: "It takes a minute. Your most relevant work moves up, in the words this employer uses.",
      href: `/app/jobs/${untailored.id}/cv`,
      cta: "Tailor my CV",
    };
  }
  if (input.appliedThisWeek < input.weeklyGoal) {
    const left = input.weeklyGoal - input.appliedThisWeek;
    return {
      kind: "add",
      title: jobs.length ? `${left} more ${left === 1 ? "application" : "applications"} to reach this week's goal` : "Add a job you want",
      body: jobs.length ? "Paste a job post you like. You'll see how well you fit before you spend time on it." : "Paste a link or the description of any job, and see how well your CV fits it before you apply.",
      href: "/app/jobs?add=1",
      cta: "Add a job",
    };
  }
  return { kind: "on-track", title: "You're on track this week", body: "Goal reached. Take a breath, or get ahead with one more strong application.", href: "/app/jobs?add=1", cta: "Add another job" };
}
