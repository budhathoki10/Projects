import { describe, expect, it } from "vitest";
import { withSkillEvidence } from "@/lib/cv/skill-evidence";
import type { Profile } from "@/lib/model/types";

const base: Profile = {
  name: "Asha Gurung",
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  experience: [{ id: "x1", title: "Support Specialist", company: "Brightdesk", location: "", start: "2022", end: "Present", bullets: ["Answered tickets in Zendesk"] }],
  education: [],
  skills: ["Zendesk"],
  projects: [],
  certifications: [],
  languages: [],
} as Profile;

describe("I have this", () => {
  it("adds only the candidate's own sentence, under the role they picked", () => {
    const r = withSkillEvidence(base, { skill: "HubSpot", experienceId: "x1", sentence: "  - Set up HubSpot   for 40 accounts " });
    if ("error" in r) throw new Error(r.error);
    expect(r.profile.skills).toEqual(["Zendesk", "HubSpot"]);
    expect(r.profile.experience[0].bullets).toEqual(["Answered tickets in Zendesk", "Set up HubSpot for 40 accounts"]);
    expect(base.experience[0].bullets).toHaveLength(1); // the original is untouched
  });

  it("can add to the skills list alone, without inventing a bullet", () => {
    const r = withSkillEvidence(base, { skill: "Salesforce", experienceId: "", sentence: "" });
    if ("error" in r) throw new Error(r.error);
    expect(r.profile.skills).toContain("Salesforce");
    expect(r.profile.experience).toEqual(base.experience);
  });

  it("doesn't list a skill twice", () => {
    const r = withSkillEvidence(base, { skill: "zendesk", experienceId: "", sentence: "" });
    if ("error" in r) throw new Error(r.error);
    expect(r.profile.skills).toEqual(["Zendesk"]);
  });

  it("asks for the candidate's words when a role is picked, and refuses unknown roles", () => {
    expect(withSkillEvidence(base, { skill: "HubSpot", experienceId: "x1", sentence: "yes" })).toHaveProperty("error");
    expect(withSkillEvidence(base, { skill: "HubSpot", experienceId: "nope", sentence: "Set up HubSpot for 40 accounts" })).toHaveProperty("error");
    expect(withSkillEvidence(base, { skill: " ", experienceId: "", sentence: "" })).toHaveProperty("error");
  });
});
