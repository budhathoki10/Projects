import type { Change, Profile } from "@/lib/model/types";

/** The CV for one job: the profile with the accepted changes applied. Rejected and flagged changes are ignored. */
export function applyChanges(profile: Profile, changes: Change[]): Profile {
  const cv: Profile = structuredClone(profile);
  for (const c of changes) {
    if (!c.accepted || c.flags.length > 0) continue;
    if (c.kind === "summary") cv.summary = c.after;
    if (c.kind === "skills-order") {
      const known = c.order.filter((s) => cv.skills.includes(s));
      cv.skills = [...known, ...cv.skills.filter((s) => !known.includes(s))];
    }
    const exp = "experienceId" in c ? cv.experience.find((e) => e.id === c.experienceId) : undefined;
    if (!exp) continue;
    if (c.kind === "bullet" && c.index < exp.bullets.length) exp.bullets[c.index] = c.after;
  }
  // Reorder after rewriting, so bullet indexes in rewrites always refer to the original order.
  for (const c of changes) {
    if (!c.accepted || c.flags.length > 0 || c.kind !== "bullet-order") continue;
    const exp = cv.experience.find((e) => e.id === c.experienceId);
    if (!exp || !isPermutation(c.order, exp.bullets.length)) continue;
    exp.bullets = c.order.map((i) => exp.bullets[i]);
  }
  return cv;
}

export function isPermutation(order: number[], length: number): boolean {
  return order.length === length && new Set(order).size === length && order.every((i) => Number.isInteger(i) && i >= 0 && i < length);
}
