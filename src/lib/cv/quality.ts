import type { Profile } from "@/lib/model/types";

/** Detect the old line-per-project bug without rewriting the user's saved work. */
export function profileNeedsRepair(profile: Profile): boolean {
  const fragments = profile.projects.filter((p) => !p.bullets.length && (/^Tech Stack:/i.test(p.name) || p.name.length > 100 || /[.!?]$/.test(p.name)));
  return profile.projects.length > 5 && fragments.length >= 2;
}

export const CV_READER_VERSION = 3;
