import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heuristicProfile } from "@/lib/cv/heuristic";
import { cvStrength } from "@/lib/cv/strength";
import { EMPTY_PROFILE } from "@/lib/model/types";
import { passDaysLeft } from "@/lib/plans";
import { nextBestAction, upcomingInterviews, weeklyApplied } from "@/lib/today";

const day = "2026-10-30";
const job = (id: string, patch: Partial<{ status: string; appliedOn: string | null; interviewOn: string | null }> = {}) => ({
  id,
  status: "saved",
  appliedOn: null,
  interviewOn: null,
  post: { title: `Job ${id}`, company: `Co ${id}` },
  ...patch,
});
const base = { profileReady: true, jobs: [], dueFollowUps: [], tailored: new Set<string>(), practised: new Set<string>(), appliedThisWeek: 0, weeklyGoal: 5, day };

describe("next best step", () => {
  it("asks for a CV first", () => {
    expect(nextBestAction({ ...base, profileReady: false }).kind).toBe("cv");
  });

  it("puts an interview in the next 3 days before everything else", () => {
    const jobs = [job("a", { status: "interview", interviewOn: "2026-10-31" }), job("b")];
    const a = nextBestAction({ ...base, jobs, dueFollowUps: [job("c", { status: "applied" })] });
    expect(a).toMatchObject({ kind: "interview", href: "/app/jobs/a/interview" });
    expect(a.title).toContain("tomorrow");
    expect(nextBestAction({ ...base, jobs: [job("a", { status: "interview", interviewOn: "2026-11-20" })] }).kind).toBe("add");
  });

  it("then a due follow-up, then tailoring a saved job, then the weekly goal", () => {
    expect(nextBestAction({ ...base, jobs: [job("b")], dueFollowUps: [job("c", { status: "applied" })] }).kind).toBe("follow-up");
    expect(nextBestAction({ ...base, jobs: [job("b")] })).toMatchObject({ kind: "tailor", href: "/app/jobs/b/cv" });
    expect(nextBestAction({ ...base, jobs: [job("b")], tailored: new Set(["b"]), appliedThisWeek: 3 }).title).toBe("2 more applications to reach this week's goal");
    expect(nextBestAction({ ...base, jobs: [job("b")], tailored: new Set(["b"]), appliedThisWeek: 5 }).kind).toBe("on-track");
  });
});

describe("Today numbers", () => {
  it("counts applications per week for 8 weeks, oldest first", () => {
    const jobs = [{ appliedOn: "2026-10-30" }, { appliedOn: "2026-10-24" }, { appliedOn: "2026-10-23" }, { appliedOn: "2026-09-12" }, { appliedOn: null }];
    expect(weeklyApplied(jobs, day)).toEqual([0, 1, 0, 0, 0, 0, 1, 2]);
  });

  it("lists upcoming interviews soonest first, skipping past ones", () => {
    const jobs = [
      job("late", { status: "interview", interviewOn: "2026-11-09" }),
      job("past", { status: "interview", interviewOn: "2026-10-01" }),
      job("soon", { status: "interview", interviewOn: "2026-11-02" }),
      job("closed", { status: "rejected", interviewOn: "2026-11-03" }),
    ];
    expect(upcomingInterviews(jobs, day).map((j) => j.id)).toEqual(["soon", "late"]);
  });

  it("counts pass days left", () => {
    const now = new Date("2026-10-30T10:00:00Z");
    expect(passDaysLeft({ passUntil: new Date("2026-11-09T10:00:00Z") }, now)).toBe(10);
    expect(passDaysLeft({ passUntil: new Date("2026-10-30T11:00:00Z") }, now)).toBe(1);
    expect(passDaysLeft({ passUntil: new Date("2026-10-29T10:00:00Z") }, now)).toBeNull();
    expect(passDaysLeft({ passUntil: null }, now)).toBeNull();
  });
});

describe("CV strength", () => {
  it("scores a solid CV well and points to what to fix", () => {
    const { score, checks } = cvStrength(heuristicProfile(readFileSync("tests/fixtures/cv.txt", "utf8")));
    expect(score).toBeGreaterThanOrEqual(80);
    for (const c of checks) expect(c.href).toMatch(/^\/app\/profile#/);
  });

  it("flags missing numbers, weak starts, long points, missing dates and few skills", () => {
    const weak = {
      ...EMPTY_PROFILE,
      name: "Test",
      email: "t@example.com",
      experience: [{ id: "e", title: "Clerk", company: "Shop", location: "", start: "2020", end: "", bullets: ["I was responsible for the till", "Responsible for a lot of different things in the shop including cleaning, stock, customers, opening and closing, and anything else at all that the store manager or the area manager asked me to do on that day or in that week"] }],
      skills: ["Excel"],
    };
    const { score, checks } = cvStrength(weak);
    const failing = checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(["contact", "summary", "numbers", "verbs", "length", "dates", "skills"]));
    expect(checks.find((c) => c.id === "verbs")!.detail).toContain('start with "I" or "My"');
    expect(score).toBeLessThan(40);
  });

  it("treats a first job seeker fairly: projects count instead of jobs", () => {
    const student = { ...EMPTY_PROFILE, name: "S", projects: [{ id: "p", name: "Club website", link: "", bullets: ["Built it"] }] };
    const c = cvStrength(student).checks;
    expect(c.find((x) => x.id === "first-job")?.ok).toBe(true);
    expect(c.find((x) => x.id === "verbs")?.ok).toBe(true);
  });
});
