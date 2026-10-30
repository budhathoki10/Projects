import { SKILL_TERMS } from "@/lib/jobs/skills-dictionary";
import type { Profile } from "@/lib/model/types";
import { containsTerm } from "@/lib/text";

/**
 * The guided CV builder's plain logic: no AI and nothing server-only, so the builder screens can
 * use it too. The AI versions of the writing help are in assist.ts.
 */

/** A suggested bullet or summary, with any words the fact check couldn't find in what the person wrote. */
export type Suggestion = { text: string; flags: string[] };

export const MAX_BULLETS = 5;
const MAX_WORDS = 30;

/** Turn rough notes into bullet points using only the notes' own words: trims and tidies, never adds. */
export function heuristicBullets(notes: string): string[] {
  const pieces = notes
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((p) => p.replace(/^[\s\-•*·–]+/, "").trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let p of pieces) {
    p = p
      .replace(/^my\s+(job|role|work)\s+(was|is)\s+(to\s+)?/i, "")
      .replace(/^(i|we)\s+(was|were|am|are|have|had)\s+/i, "")
      .replace(/^(i|we)('ve|'m|'d)?\s+/i, "")
      .replace(/[.;!]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    const words = p.split(" ");
    if (words.length < 3) continue;
    p = words.slice(0, MAX_WORDS).join(" ");
    p = p.charAt(0).toUpperCase() + p.slice(1);
    if (!out.some((o) => o.toLowerCase() === p.toLowerCase())) out.push(p);
    if (out.length === MAX_BULLETS) break;
  }
  return out;
}

const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** A summary assembled only from the profile's own fields. */
export function heuristicSummary(p: Profile): string {
  const parts: string[] = [];
  const latest = p.experience[0];
  const edu = p.education[0];
  const headline = p.headline.trim();
  if (latest) {
    const current = !latest.end || /present|now|current/i.test(latest.end);
    parts.push(`${headline || latest.title}${latest.company ? `${current ? " at" : ", most recently at"} ${latest.company}` : ""}.`);
  } else if (edu) {
    parts.push(`${headline || "Student"}${edu.degree ? `, ${edu.degree}` : ""}${edu.school ? ` at ${edu.school}` : ""}.`);
  } else if (headline) {
    parts.push(`${headline}.`);
  }
  const skills = p.skills.slice(0, 3);
  if (skills.length) parts.push(`Skilled in ${listOf(skills)}.`);
  if (p.languages.length > 1) parts.push(`Speaks ${listOf(p.languages.slice(0, 3))}.`);
  return parts.join(" ");
}

const COMMON_SKILLS = ["Communication", "Teamwork", "Customer service", "Problem solving", "Time management", "Microsoft Office", "Excel", "Leadership"];

/** Skills worth offering as one-tap chips: ones their own words mention first, then common ones. */
export function suggestSkills(p: Profile, limit = 12): string[] {
  const text = [p.headline, p.summary, ...p.experience.flatMap((e) => [e.title, ...e.bullets]), ...p.projects.flatMap((x) => [x.name, ...x.bullets]), ...p.education.flatMap((e) => [e.degree, ...e.details])].join("\n");
  const have = new Set(p.skills.map((s) => s.toLowerCase()));
  const mentioned = SKILL_TERMS.filter((t) => containsTerm(text, t));
  return [...new Set([...mentioned, ...COMMON_SKILLS])].filter((s) => !have.has(s.toLowerCase())).slice(0, limit);
}

export const BUILDER_STEPS = ["About you", "Work", "Studies", "Skills", "Summary", "Your look"] as const;

/** Where to pick up a half-built CV: the first step that still has nothing in it. */
export function firstIncompleteStep(p: Profile | null): number {
  if (!p || !p.name.trim() || !p.headline.trim()) return 0;
  if (!p.experience.length && !p.projects.length) return 1;
  if (!p.education.length && !p.certifications.length) return 2;
  if (p.skills.length < 3) return 3;
  if (!p.summary.trim()) return 4;
  return 5;
}

/** The profile as it will be saved: empty rows and lines dropped. Used for the live preview. */
export function tidyProfile(p: Profile): Profile {
  const nonEmpty = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  return {
    ...p,
    links: nonEmpty(p.links),
    skills: nonEmpty(p.skills),
    languages: nonEmpty(p.languages),
    certifications: nonEmpty(p.certifications),
    experience: p.experience.map((e) => ({ ...e, bullets: nonEmpty(e.bullets) })).filter((e) => e.title.trim() || e.company.trim() || e.bullets.length),
    education: p.education.map((e) => ({ ...e, details: nonEmpty(e.details) })).filter((e) => e.school.trim() || e.degree.trim()),
    projects: p.projects.map((x) => ({ ...x, bullets: nonEmpty(x.bullets) })).filter((x) => x.name.trim()),
  };
}
