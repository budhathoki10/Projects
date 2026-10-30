import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heuristicProfile } from "@/lib/cv/heuristic";
import { htmlToText, jobPostingFromHtml } from "@/lib/jobs/html";
import { heuristicJob } from "@/lib/jobs/heuristic";
import { canonical, cleanText, containsTerm, overlap } from "@/lib/text";

const cvText = readFileSync("tests/fixtures/cv.txt", "utf8");
const jobText = readFileSync("tests/fixtures/job.txt", "utf8");

describe("reading a CV without AI", () => {
  const p = heuristicProfile(cvText);

  it("finds the contact details at the top", () => {
    expect(p.name).toBe("Asha Gurung");
    expect(p.headline).toBe("Customer Support Specialist");
    expect(p.email).toBe("asha.gurung@example.com");
    expect(p.phone).toBe("+977 9801234567");
    expect(p.location).toBe("Kathmandu, Nepal");
    expect(p.links).toEqual(["linkedin.com/in/ashagurung"]);
  });

  it("splits roles into title, employer, place, dates and bullets", () => {
    expect(p.experience).toHaveLength(2);
    expect(p.experience[0]).toMatchObject({ title: "Support Specialist", company: "Brightdesk", location: "Kathmandu", start: "Jan 2022", end: "Present" });
    expect(p.experience[0].bullets).toHaveLength(4);
    expect(p.experience[0].bullets[1]).toBe("Onboarded 40 new business accounts through video calls and written guides");
    expect(p.experience[1]).toMatchObject({ title: "Customer Service Associate", company: "Himal Telecom", start: "Jun 2019", end: "Dec 2021" });
  });

  it("reads education, skills and languages", () => {
    expect(p.education[0]).toMatchObject({ degree: "BBA", school: "Tribhuvan University", start: "2015", end: "2019" });
    expect(p.skills).toEqual(["Zendesk", "Customer Success", "Onboarding", "Excel", "CRM", "Written communication", "English", "Nepali"]);
    expect(p.languages).toEqual(["English", "Nepali", "Hindi"]);
    expect(p.summary).toMatch(/^Customer support specialist with four years/);
  });

  it("copes with 'Title at Company' and dates on the same line", () => {
    const q = heuristicProfile("Ram Thapa\nram@x.com\n\nWork Experience\nWaiter at Hotel Annapurna (2020 - 2023)\n• Served 80 covers a night\n");
    expect(q.experience[0]).toMatchObject({ title: "Waiter", company: "Hotel Annapurna", start: "2020", end: "2023", bullets: ["Served 80 covers a night"] });
  });
});

describe("reading a job post without AI", () => {
  const j = heuristicJob(jobText);

  it("pulls out the basics", () => {
    expect(j.title).toBe("Customer Success Lead");
    expect(j.company).toBe("Northwind Software");
    expect(j.location).toBe("Remote (Asia)");
    expect(j.salary).toBe("USD 1,800 to 2,400 per month");
  });

  it("separates must-haves from nice-to-haves and ignores benefits", () => {
    expect(j.requirements.filter((r) => r.kind === "must").map((r) => r.text)).toHaveLength(5);
    expect(j.requirements.filter((r) => r.kind === "nice").map((r) => r.text)).toEqual(["Salesforce experience", "Japanese language skills"]);
    expect(j.requirements.some((r) => /Flexible hours/.test(r.text))).toBe(false);
  });

  it("doesn't mistake currencies and abbreviations for skills", () => {
    expect(j.keywords).not.toContain("USD");
    expect(heuristicJob("Waiter\nSalary: NPR 30,000 per month, paid PTO\n\nRequirements\n- 1 year in a busy restaurant\n- POS experience").keywords).toEqual(["POS"]);
  });

  it("finds the skills it names", () => {
    expect(j.keywords).toEqual(expect.arrayContaining(["Zendesk", "HubSpot", "Salesforce", "English", "Japanese", "Onboarding", "Customer Success"]));
    expect(j.requirements.find((r) => r.text.includes("Zendesk"))?.keywords).toEqual(expect.arrayContaining(["Zendesk", "HubSpot"]));
  });
});

describe("job pages", () => {
  it("prefers the structured JobPosting data job boards embed for Google", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "X" },
        {
          "@type": "JobPosting",
          title: "Staff Nurse",
          description: "<p>Care for patients.</p><ul><li>BLS certificate</li><li>2 years experience</li></ul>",
          hiringOrganization: { name: "City Hospital" },
          jobLocation: { address: { addressLocality: "Lalitpur", addressCountry: "NP" } },
          baseSalary: { currency: "NPR", value: { minValue: 45000, maxValue: 60000, unitText: "MONTH" } },
        },
      ],
    })}</script></head><body><nav>Menu</nav>Ignored</body></html>`;
    const text = jobPostingFromHtml(html)!;
    expect(text).toContain("Staff Nurse\nCompany: City Hospital\nLocation: Lalitpur, NP\nSalary: NPR 45000 to 60000 per month");
    expect(text).toContain("• BLS certificate");
    expect(text).not.toContain("Menu");
  });

  it("falls back to the page text without scripts, menus or entities", () => {
    expect(htmlToText("<nav>Home</nav><h1>Chef &amp; Cook</h1><script>x()</script><p>Make&nbsp;food</p>")).toBe("Chef & Cook\nMake food");
    expect(jobPostingFromHtml("<p>No data</p>")).toBeNull();
  });
});

describe("matching words", () => {
  it.each([
    ["Built apps in JavaScript", "Java", false],
    ["Five years of Java", "Java", true],
    ["Wrote C++ services", "C++", true],
    ["APIs in Node.js", "node", true],
    ["Used JS daily", "JavaScript", true],
    ["Postgres admin", "PostgreSQL", true],
    ["React developer", "R", false],
    ["Fluent in English.", "English", true],
  ])("%s / %s", (text, term, found) => expect(containsTerm(text, term)).toBe(found));

  it("stems words so different forms match", () => {
    expect(overlap("Experience reducing churn", "Kept churn under 3% by reducing cancellations")).toBe(1);
    expect(overlap("reduced costs", "reduces cost")).toBe(1);
  });

  it("normalises spellings and measures overlap", () => {
    expect(canonical("K8s")).toBe("kubernetes");
    expect(overlap("Strong written communication in English", "Wrote help articles in English with clear communication")).toBeGreaterThan(0.6);
    expect(cleanText("a \t b\r\n\n\n\nc\u0000")).toBe("a b\n\nc");
  });
});
