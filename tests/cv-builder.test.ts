import { describe, expect, it } from "vitest";
import { firstIncompleteStep, heuristicBullets, heuristicSummary, suggestSkills, tidyProfile } from "@/lib/cv/builder";
import { EMPTY_PROFILE, type Profile } from "@/lib/model/types";
import { unsupportedFacts } from "@/lib/tailor/fact-check";

const wordsOf = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

describe("heuristicBullets", () => {
  const notes = `I was in charge of the night shift. We served about 200 customers a day!
- my job was to count the till and lock up
• trained 2 new staff on the coffee machine.
ok
trained 2 new staff on the coffee machine`;

  it("splits notes into tidy bullets: no I or my, capitalised, no repeats, nothing too short", () => {
    expect(heuristicBullets(notes)).toEqual([
      "In charge of the night shift",
      "Served about 200 customers a day",
      "Count the till and lock up",
      "Trained 2 new staff on the coffee machine",
    ]);
  });

  it("never adds a word that isn't in the notes", () => {
    const allowed = new Set(wordsOf(notes));
    for (const b of heuristicBullets(notes)) for (const w of wordsOf(b)) expect(allowed.has(w), w).toBe(true);
  });

  it("keeps at most five bullets of at most 30 words", () => {
    const long = Array.from({ length: 8 }, (_, i) => `Handled task number ${i} ${"carefully ".repeat(40)}`).join("\n");
    const out = heuristicBullets(long);
    expect(out).toHaveLength(5);
    expect(Math.max(...out.map((b) => b.split(" ").length))).toBe(30);
  });
});

const asha: Profile = {
  ...EMPTY_PROFILE,
  name: "Asha Gurung",
  headline: "Customer Support Specialist",
  location: "Pokhara, Nepal",
  skills: ["Zendesk", "Customer service", "Excel", "Nepali"],
  languages: ["English", "Nepali"],
  experience: [{ id: "x1", title: "Support Agent", company: "Daraz", location: "", start: "2022", end: "Present", bullets: ["Answered 60 tickets a day"] }],
};

describe("heuristicSummary", () => {
  it("is built only from the profile's own facts", () => {
    const text = heuristicSummary(asha);
    expect(text).toBe("Customer Support Specialist at Daraz. Skilled in Zendesk, Customer service and Excel. Speaks English and Nepali.");
    expect(unsupportedFacts(text, asha)).toEqual([]);
  });

  it("works for a first job hunt with only studies", () => {
    const student: Profile = { ...EMPTY_PROFILE, name: "Bikash", education: [{ id: "e1", school: "Tribhuvan University", degree: "BBA", start: "2021", end: "2025", details: [] }] };
    expect(heuristicSummary(student)).toBe("Student, BBA at Tribhuvan University.");
  });
});

describe("the fact check on suggestions", () => {
  it("flags an employer or number the notes never mention", () => {
    const flags = unsupportedFacts("Answered 90 tickets a day at Foodmandu", asha, "Answered 60 tickets a day");
    expect(flags).toEqual(expect.arrayContaining(["90", "Foodmandu"]));
  });
});

describe("suggestSkills", () => {
  it("offers skills from their own words first, and never ones they already have", () => {
    const p = { ...asha, skills: ["Excel"], experience: [{ ...asha.experience[0], bullets: ["Kept stock in Excel and answered customers in Zendesk"] }] };
    const out = suggestSkills(p);
    expect(out[0]).toBe("Zendesk");
    expect(out.map((s) => s.toLowerCase())).not.toContain("excel");
    expect(out.length).toBeLessThanOrEqual(12);
  });
});

describe("firstIncompleteStep", () => {
  it("resumes at the first step that's still empty", () => {
    expect(firstIncompleteStep(null)).toBe(0);
    const about = { ...EMPTY_PROFILE, name: "Asha", headline: "Nurse" };
    expect(firstIncompleteStep(about)).toBe(1);
    const work = { ...about, experience: asha.experience };
    expect(firstIncompleteStep(work)).toBe(2);
    const studies = { ...work, education: [{ id: "e", school: "TU", degree: "BSc Nursing", start: "", end: "", details: [] }] };
    expect(firstIncompleteStep(studies)).toBe(3);
    expect(firstIncompleteStep({ ...studies, skills: ["a", "b", "c"] })).toBe(4);
    expect(firstIncompleteStep({ ...studies, skills: ["a", "b", "c"], summary: "Nurse." })).toBe(5);
  });
});

describe("tidyProfile", () => {
  it("drops empty rows and lines, like saving does", () => {
    const messy = { ...asha, skills: ["Excel", " "], experience: [...asha.experience, { id: "x2", title: "", company: "", location: "", start: "", end: "", bullets: [""] }] };
    const out = tidyProfile(messy);
    expect(out.skills).toEqual(["Excel"]);
    expect(out.experience).toHaveLength(1);
  });
});
