import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { heuristicProfile } from "@/lib/cv/heuristic";
import { addDays } from "@/lib/dates";
import { fetchJobPost } from "@/lib/jobs/fetch-post";
import { heuristicJob } from "@/lib/jobs/heuristic";
import { scoreMatch } from "@/lib/match/score";
import { LIMITS, monthKey, today } from "@/lib/plans";
import { deleteUser } from "@/lib/services/account";
import { completePendingPayment, extendPass, recordPayment } from "@/lib/services/billing";
import { getInterview, getTailoredCv, saveCoverLetter, saveInterview, saveTailoredCv } from "@/lib/services/documents";
import { createJob, dueFollowUpCount, dueFollowUps, listJobs, ownedJob, progress, rescoreAll, setStatus } from "@/lib/services/jobs";
import { getProfile, saveProfile } from "@/lib/services/profile";
import { sendFollowUpDigests } from "@/lib/services/reminders";
import { refundAllowance, spendAllowance, usageThisMonth } from "@/lib/services/usage";
import { DAY, makeUser, resetDb } from "./helpers";

const OUTBOX = path.join(os.tmpdir(), `shortlist-integration-outbox-${process.pid}.jsonl`);
const emails = (): { to: string; subject: string; text: string }[] => {
  try {
    return readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

const profile = heuristicProfile(readFileSync("tests/fixtures/cv.txt", "utf8"));
const postText = readFileSync("tests/fixtures/job.txt", "utf8");
const post = heuristicJob(postText);

beforeEach(async () => {
  await resetDb();
  rmSync(OUTBOX, { force: true });
  process.env.EMAIL_DEV_OUTBOX = OUTBOX;
});
afterAll(() => rmSync(OUTBOX, { force: true }));

const reload = async (id: string) => (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];
const newJob = (userId: string) => createJob(userId, { url: null, postText, post, match: null });

describe("monthly allowance", () => {
  it("allows the free amount, then stops, and a refund gives one back", async () => {
    const user = await makeUser();
    for (let i = 0; i < LIMITS.free.tailor; i++) expect(await spendAllowance(user, "tailor")).toBe(true);
    expect(await spendAllowance(user, "tailor")).toBe(false);
    expect((await usageThisMonth(user.id)).tailor).toBe(LIMITS.free.tailor);
    await refundAllowance(user.id, "tailor");
    expect(await spendAllowance(user, "tailor")).toBe(true);
    // Other kinds are counted separately.
    expect(await spendAllowance(user, "cover")).toBe(true);
  });

  it("can't be overspent by requests arriving at the same time", async () => {
    const user = await makeUser();
    const results = await Promise.all(Array.from({ length: 10 }, () => spendAllowance(user, "tailor")));
    expect(results.filter(Boolean)).toHaveLength(LIMITS.free.tailor);
  });

  it("resets each month and is higher with a pass", async () => {
    const user = await makeUser();
    const lastMonth = new Date(Date.now() - 40 * DAY);
    for (let i = 0; i < LIMITS.free.tailor; i++) await spendAllowance(user, "tailor", lastMonth);
    expect(await spendAllowance(user, "tailor")).toBe(true);
    expect(monthKey(lastMonth)).not.toBe(monthKey());

    const pass = await makeUser({ passUntil: new Date(Date.now() + 10 * DAY) });
    for (let i = 0; i < LIMITS.free.tailor + 2; i++) expect(await spendAllowance(pass, "tailor")).toBe(true);
  });
});

describe("passes", () => {
  it("start from today, and a second one adds to the end", async () => {
    const user = await makeUser({ passUntil: new Date(Date.now() - 5 * DAY) });
    await extendPass(user.id, 30);
    const first = (await reload(user.id)).passUntil!;
    expect(Math.round((first.getTime() - Date.now()) / DAY)).toBe(30);
    await extendPass(user.id, 90);
    expect(Math.round(((await reload(user.id)).passUntil!.getTime() - Date.now()) / DAY)).toBe(120);
  });

  it("a Khalti payment completes once, even with simultaneous callbacks", async () => {
    const user = await makeUser();
    await recordPayment({ userId: user.id, provider: "khalti", ref: "pidx_1", status: "pending", amountMinor: 150000, currency: "NPR", days: 30 });
    expect(await recordPayment({ userId: user.id, provider: "khalti", ref: "pidx_1", status: "pending", amountMinor: 150000, currency: "NPR", days: 30 })).toBe(false);
    const results = await Promise.all([completePendingPayment("khalti", "pidx_1"), completePendingPayment("khalti", "pidx_1")]);
    const won = results.filter(Boolean);
    expect(won).toHaveLength(1);
    expect(won[0]!.days).toBe(30);
  });
});

describe("jobs", () => {
  it("applying sets a follow-up a week out; an answer clears it", async () => {
    const user = await makeUser();
    const job = await newJob(user.id);
    await setStatus(user.id, job.id, "applied", "2026-10-20");
    let j = (await ownedJob(user.id, job.id))!;
    expect(j).toMatchObject({ status: "applied", appliedOn: "2026-10-20", followUpOn: "2026-10-27" });

    expect((await dueFollowUps(user.id, "2026-10-26")).length).toBe(0);
    expect((await dueFollowUps(user.id, "2026-10-27")).map((x) => x.id)).toEqual([job.id]);
    expect(await dueFollowUpCount(user.id, "2026-10-29")).toBe(1);

    await setStatus(user.id, job.id, "interview", "2026-10-28");
    j = (await ownedJob(user.id, job.id))!;
    expect(j).toMatchObject({ status: "interview", appliedOn: "2026-10-20", followUpOn: null });
  });

  it("counts progress", async () => {
    const user = await makeUser();
    const a = await newJob(user.id);
    const b = await newJob(user.id);
    const c = await newJob(user.id);
    await newJob(user.id);
    await setStatus(user.id, a.id, "applied", today());
    await setStatus(user.id, b.id, "applied", addDays(today(), -20));
    await setStatus(user.id, b.id, "rejected");
    await setStatus(user.id, c.id, "applied", today());
    await setStatus(user.id, c.id, "interview");
    expect(await progress(user.id)).toEqual({ saved: 4, applied: 3, appliedThisWeek: 2, responseRate: 67, interviews: 1, offers: 0, waiting: 1 });
  });

  it("re-scores every job when the profile changes", async () => {
    const user = await makeUser();
    const job = await createJob(user.id, { url: null, postText, post, match: scoreMatch(profile, post) });
    const before = job.match!.score;
    await rescoreAll(user.id, { ...profile, skills: [...profile.skills, "HubSpot", "Salesforce"] });
    expect((await ownedJob(user.id, job.id))!.match!.score).toBeGreaterThan(before);
  });

  it("keeps everyone's jobs and documents private", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const job = await newJob(owner.id);
    await saveTailoredCv(owner.id, job.id, { changes: [] });
    expect(await ownedJob(other.id, job.id)).toBeNull();
    expect(await getTailoredCv(other.id, job.id)).toBeNull();
    expect(await setStatus(other.id, job.id, "applied")).toBeNull();
    expect(await listJobs(other.id)).toHaveLength(0);
    expect(await ownedJob(owner.id, "not-a-uuid")).toBeNull();
  });
});

describe("documents", () => {
  it("keeps one tailored CV, cover letter and interview per job, updated in place", async () => {
    const user = await makeUser();
    const job = await newJob(user.id);
    await saveTailoredCv(user.id, job.id, { changes: [] });
    await saveTailoredCv(user.id, job.id, { changes: [{ id: "c", kind: "summary", before: "", after: "x", reason: "", flags: [], accepted: true }] });
    await saveCoverLetter(user.id, job.id, "one");
    await saveCoverLetter(user.id, job.id, "two");
    const docs = await db.select().from(schema.documents).where(eq(schema.documents.jobId, job.id));
    expect(docs).toHaveLength(2);
    expect((await getTailoredCv(user.id, job.id))!.cv!.changes).toHaveLength(1);

    await saveInterview(user.id, job.id, [{ id: "q1", question: "Why?", why: "", answer: "", feedback: null }]);
    await saveInterview(user.id, job.id, [{ id: "q1", question: "Why?", why: "", answer: "Because", feedback: null }]);
    expect((await getInterview(user.id, job.id))!.questions[0].answer).toBe("Because");
  });
});

describe("reading job links", () => {
  const base = process.env.FIXTURE_BASE;

  it("reads the structured job posting a page embeds", async () => {
    const res = await fetchJobPost(`${base}/jobs/northwind.html`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.text).toMatch(/^Customer Success Lead\nCompany: Northwind Software/);
    expect(res.text).toContain("• Experience with Zendesk and HubSpot");
    expect(res.text).not.toContain("Careers");
    const read = heuristicJob(res.text);
    expect(read).toMatchObject({ title: "Customer Success Lead", company: "Northwind Software" });
    expect(read.requirements.filter((r) => r.kind === "nice")).toHaveLength(2);
  });

  it("explains when a page can't be read", async () => {
    expect(await fetchJobPost(`${base}/jobs/login-wall`)).toEqual({ ok: false, reason: "blocked" });
    expect(await fetchJobPost(`${base}/jobs/empty`)).toEqual({ ok: false, reason: "too_short" });
    expect(await fetchJobPost(`${base}/jobs/nothing.html`)).toEqual({ ok: false, reason: "unreachable" });
    expect(await fetchJobPost("ftp://example.com/job")).toEqual({ ok: false, reason: "blocked" });
  });
});

describe("accounts", () => {
  it("deleting an account removes every row that belongs to it", async () => {
    const user = await makeUser();
    await saveProfile(user.id, profile);
    const job = await newJob(user.id);
    await saveTailoredCv(user.id, job.id, { changes: [] });
    await saveCoverLetter(user.id, job.id, "letter");
    await saveInterview(user.id, job.id, []);
    await spendAllowance(user, "tailor");
    await recordPayment({ userId: user.id, provider: "paddle", ref: "txn_x", status: "completed", amountMinor: 1500, currency: "USD", days: 30 });

    await deleteUser(user.id);
    for (const table of [schema.profiles, schema.jobs, schema.documents, schema.interviews, schema.usage, schema.payments] as const) {
      expect(await db.select().from(table).where(eq(table.userId, user.id))).toHaveLength(0);
    }
    expect(await getProfile(user.id)).toBeNull();
  });
});

describe("follow-up reminders", () => {
  it("emails each person once, listing their due applications", async () => {
    const asha = await makeUser({ email: "asha@example.com" });
    const ram = await makeUser({ email: "ram@example.com" });
    const due1 = await newJob(asha.id);
    const due2 = await createJob(asha.id, { url: null, postText, post: { ...post, title: "Support Manager", company: "Acme" }, match: null });
    const notYet = await newJob(ram.id);
    await setStatus(asha.id, due1.id, "applied", addDays(today(), -8));
    await setStatus(asha.id, due2.id, "applied", addDays(today(), -7));
    await setStatus(ram.id, notYet.id, "applied", addDays(today(), -2));

    expect(await sendFollowUpDigests()).toEqual({ people: 1, sent: 1 });
    const [mail] = emails();
    expect(mail.to).toBe("asha@example.com");
    expect(mail.subject).toBe("2 applications to follow up on");
    expect(mail.text).toContain("• Customer Success Lead at Northwind Software");
    expect(mail.text).toContain("• Support Manager at Acme");
  });
});
