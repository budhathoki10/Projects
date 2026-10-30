import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/lib/plans";
import { EMPTY_PROFILE } from "@/lib/model/types";
import { saveProfile } from "@/lib/services/profile";
import { usageThisMonth } from "@/lib/services/usage";
import { makeUser, resetDb } from "./helpers";

// The builder's writing help, through its real server actions: who's signed in and whether the AI
// is on are the only things faked.
const fake = vi.hoisted(() => ({ user: null as unknown, ai: false, fail: false }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => fake.user }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/ai", async (real) => ({
  ...(await real<typeof import("@/lib/ai")>()),
  aiEnabled: () => fake.ai,
  structured: async () => {
    if (fake.fail) throw new Error("API down");
    return { bullets: ["Looked after 12 patients a shift", "Trained 3 new nurses at Grande Hospital"], summary: "Staff nurse at Bir Hospital." };
  },
}));

const { turnNotesIntoBullets, writeSummary } = await import("@/app/actions/profile");

const notes = { notes: "I looked after 12 patients a shift. I trained 3 new nurses.", title: "Staff Nurse", company: "Bir Hospital" };

beforeEach(async () => {
  await resetDb();
  fake.ai = false;
  fake.fail = false;
  fake.user = await makeUser();
});

describe("CV builder writing help", () => {
  it("without AI, uses the plain version and never spends the allowance", async () => {
    const res = await turnNotesIntoBullets(notes);
    expect(res.method).toBe("basic");
    expect(res.suggestions!.map((s) => s.text)).toEqual(["Looked after 12 patients a shift", "Trained 3 new nurses"]);
    expect(res.suggestions!.every((s) => s.flags.length === 0)).toBe(true);
    expect((await usageThisMonth((fake.user as { id: string }).id)).assist ?? 0).toBe(0);
  });

  it("with AI, flags anything the notes don't say, and stops at the free allowance", async () => {
    fake.ai = true;
    const res = await turnNotesIntoBullets(notes);
    expect(res.method).toBe("ai");
    // "Grande Hospital" is an employer the notes never mention.
    expect(res.suggestions![0].flags).toEqual([]);
    expect(res.suggestions![1].flags).toEqual(expect.arrayContaining(["Grande"]));

    for (let i = 1; i < LIMITS.free.assist; i++) expect((await turnNotesIntoBullets(notes)).error).toBeUndefined();
    expect((await turnNotesIntoBullets(notes)).error).toMatch(/used this month's writing help/);
  });

  it("gives the allowance back when the AI call fails", async () => {
    fake.ai = true;
    fake.fail = true;
    expect((await turnNotesIntoBullets(notes)).error).toMatch(/couldn't write that/);
    expect((await usageThisMonth((fake.user as { id: string }).id)).assist).toBe(0);
  });

  it("drafts a summary only once there's something to summarise, and checks it", async () => {
    const user = fake.user as { id: string };
    expect((await writeSummary()).error).toMatch(/Add your work/);
    await saveProfile(user.id, { ...EMPTY_PROFILE, name: "Asha", headline: "Staff Nurse", skills: ["Patient care"], experience: [{ id: "x1", title: "Staff Nurse", company: "Bir Hospital", location: "", start: "2021", end: "Present", bullets: [] }] });
    const basic = await writeSummary();
    expect(basic).toMatchObject({ method: "basic", text: "Staff Nurse at Bir Hospital. Skilled in Patient care.", flags: [] });
    fake.ai = true;
    expect(await writeSummary()).toMatchObject({ method: "ai", text: "Staff nurse at Bir Hospital.", flags: [] });
  });
});
