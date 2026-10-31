import type { Profile } from "@/lib/model/types";

/**
 * Adds a skill the candidate says they have. Only their own input is used: the skill joins the
 * skills list (once), and their sentence, if any, becomes a bullet under the role they picked.
 */
export function withSkillEvidence(profile: Profile, input: { skill: string; experienceId: string; sentence: string }): { profile: Profile } | { error: string } {
  const skill = input.skill.replace(/\s+/g, " ").trim().slice(0, 60);
  const sentence = input.sentence.replace(/\s+/g, " ").trim().replace(/^[-•*]\s*/, "");
  if (!skill) return { error: "Choose a skill to add." };
  const role = input.experienceId ? profile.experience.find((e) => e.id === input.experienceId) : null;
  if (input.experienceId && !role) return { error: "That role is no longer in your CV. Reload the page and try again." };
  if (role && sentence.length < 12) return { error: `Say briefly what you did with ${skill}, in your own words.` };
  if (sentence.length > 300) return { error: "Keep it to one sentence (under 300 characters)." };
  const listed = profile.skills.some((x) => x.toLowerCase() === skill.toLowerCase());
  return {
    profile: {
      ...profile,
      skills: listed ? profile.skills : [...profile.skills, skill],
      experience: role ? profile.experience.map((e) => (e.id === role.id ? { ...e, bullets: [...e.bullets, sentence] } : e)) : profile.experience,
    },
  };
}
