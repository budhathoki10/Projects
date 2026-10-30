import type { Profile } from "@/lib/model/types";

/**
 * A rule-based CV check (no AI): what recruiters notice in the first 10 seconds. Each check
 * says what to fix and links to the place to fix it.
 */

export type StrengthCheck = { id: string; label: string; ok: boolean; detail: string; weight: number; href: string };

const ACTION_VERBS = new Set(
  (
    "achieved added advised analysed analyzed answered arranged assisted audited balanced booked boosted built calculated cared " +
    "checked cleaned closed coached collaborated completed configured coordinated created cut dealt debugged delivered designed " +
    "developed directed drafted drove edited enabled engineered ensured established estimated expanded facilitated fixed " +
    "founded generated grew guided handled helped hired identified implemented improved increased introduced launched led " +
    "maintained managed mentored migrated monitored negotiated onboarded operated organised organized oversaw planned prepared " +
    "presented processed produced programmed promoted proposed published raised ran reduced redesigned replaced reported " +
    "researched resolved restructured reviewed saved scheduled served set shipped simplified sold solved standardised " +
    "standardized started streamlined supervised supported taught tested trained translated treated tutored updated wrote " +
    "answer assist build coordinate create deliver design develop handle help lead manage plan prepare run serve support teach train write"
  ).split(" "),
);

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const firstWord = (s: string) => words(s)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
const isActionStart = (bullet: string) => {
  const w = firstWord(bullet);
  return ACTION_VERBS.has(w) || (w.length > 4 && w.endsWith("ed"));
};
const hasNumber = (s: string) => /\d/.test(s);

export function cvStrength(p: Profile): { score: number; checks: StrengthCheck[] } {
  const bullets = p.experience.flatMap((e) => e.bullets).filter((b) => b.trim());
  const pct = (n: number) => (bullets.length ? Math.round((n / bullets.length) * 100) : 0);
  const quantified = bullets.filter(hasNumber).length;
  const actionStarts = bullets.filter(isActionStart).length;
  const tooLong = bullets.filter((b) => words(b).length > 32).length;
  const thinRoles = p.experience.filter((e) => e.bullets.filter((b) => b.trim()).length < 2);
  const undated = p.experience.filter((e) => !e.start.trim() || !e.end.trim());
  const summaryWords = words(p.summary).length;
  const firstPerson = bullets.filter((b) => /^(i|my|we)\b/i.test(b.trim())).length;
  const firstJob = p.experience.length === 0;

  const checks: StrengthCheck[] = [
    {
      id: "contact",
      label: "Contact details",
      ok: Boolean(p.email.trim() && p.phone.trim() && p.location.trim()),
      detail: p.email && p.phone && p.location ? "Email, phone and location are all there." : "Add your email, phone and city so recruiters can reach you.",
      weight: 10,
      href: "/app/profile#contact",
    },
    {
      id: "summary",
      label: "A short summary",
      ok: summaryWords >= 20 && summaryWords <= 90,
      detail:
        summaryWords === 0
          ? "Add 2 or 3 sentences: who you are, what you're good at, what you want next."
          : summaryWords < 20
            ? `It's ${summaryWords} words. Aim for 30 to 70.`
            : summaryWords > 90
              ? `It's ${summaryWords} words. Cut it to 30 to 70 so it gets read.`
              : `${summaryWords} words. A good length.`,
      weight: 10,
      href: "/app/profile#contact",
    },
    firstJob
      ? {
          id: "first-job",
          label: "Something you've done",
          ok: p.projects.length > 0 || p.education.some((e) => e.details.length > 0),
          detail: "No jobs yet is fine. Add a project, volunteering or a course detail that shows what you can do.",
          weight: 25,
          href: "/app/profile#projects",
        }
      : {
          id: "numbers",
          label: "Results with numbers",
          ok: pct(quantified) >= 40,
          detail: `${quantified} of ${bullets.length} points have a number. Numbers make work concrete: how many, how much, how fast.`,
          weight: 25,
          href: "/app/profile#experience",
        },
    {
      id: "verbs",
      label: "Points start with what you did",
      ok: firstJob || pct(actionStarts) >= 60,
      detail: firstJob
        ? "You'll see this once you add a role."
        : `${actionStarts} of ${bullets.length} start with a verb like "Planned", "Led" or "Fixed".${firstPerson ? ` ${firstPerson} start with "I" or "My": drop it.` : ""}`,
      weight: 15,
      href: "/app/profile#experience",
    },
    {
      id: "length",
      label: "Points are easy to scan",
      ok: tooLong === 0,
      detail: tooLong ? `${tooLong} ${tooLong === 1 ? "point is" : "points are"} over 32 words. Split or trim them.` : "Every point is a quick read.",
      weight: 10,
      href: "/app/profile#experience",
    },
    {
      id: "depth",
      label: "Each role has detail",
      ok: firstJob || thinRoles.length === 0,
      detail: thinRoles.length ? `${thinRoles.map((e) => e.title || "A role").join(", ")}: add at least 2 points.` : "Every role has at least 2 points.",
      weight: 10,
      href: "/app/profile#experience",
    },
    {
      id: "dates",
      label: "Dates on every role",
      ok: undated.length === 0,
      detail: undated.length ? `Add start and end dates to ${undated.map((e) => e.title || "a role").join(", ")}. Write "Present" for a current job.` : "Every role has dates.",
      weight: 10,
      href: "/app/profile#experience",
    },
    {
      id: "skills",
      label: "Skills listed",
      ok: p.skills.length >= 5,
      detail: p.skills.length >= 5 ? `${p.skills.length} skills listed.` : `Only ${p.skills.length}. List at least 5 tools or skills you'd be happy to be asked about.`,
      weight: 10,
      href: "/app/profile#skills",
    },
  ];
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const score = Math.round((checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0) / total) * 100);
  return { score, checks };
}

export const strengthLabel = (score: number) => (score >= 85 ? "Strong" : score >= 60 ? "Good, with a few fixes" : "Needs work");
