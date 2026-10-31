import { expect, test } from "@playwright/test";
import { FIXTURE_BASE } from "../playwright.config";
import { addDays } from "../src/lib/dates";
import { addFixtureJob, setUpJobSeeker, withDb } from "./helpers";

// Regenerates docs/screenshots. Run with SCREENSHOTS=1 npx playwright test screenshots.
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to regenerate docs/screenshots");
test.use({ viewport: { width: 1280, height: 860 } });

const shot = (name: string, fullPage = true) => ({ path: `docs/screenshots/${name}.png`, fullPage });

test("screenshots", async ({ page, browser }) => {
  const guest = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await guest.goto("/");
  await guest.screenshot(shot("home", false));
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto("/");
  await phone.screenshot(shot("mobile-home", false));

  await setUpJobSeeker(page, `shots-${Date.now()}@example.com`);
  await page.screenshot(shot("profile"));
  const jobUrl = await addFixtureJob(page, FIXTURE_BASE);
  const jobId = jobUrl.split("/").pop()!;
  await page.screenshot(shot("match"));

  // Example suggestions in the shape the AI returns, including one the fact check blocks.
  const owned = await withDb((db) => db.collection("jobs").findOne({ _id: jobId as never }));
  const userId = String(owned!.userId);
  const day = new Date().toISOString().slice(0, 10);
  const stored = await withDb((db) => db.collection("profiles").findOne({ _id: userId as never }));
  const profile = stored!.data as { summary: string; experience: { id: string; bullets: string[] }[] };
  const exp = profile.experience[0];
  const changes = [
    {
      id: "c1",
      kind: "summary",
      before: profile.summary,
      after: "Customer support specialist with four years helping software customers get set up and stay happy, from onboarding calls to renewals. Calm under pressure and good with numbers.",
      reason: "Leads with onboarding and retention, the core of this role",
      flags: [],
      accepted: true,
    },
    {
      id: "c2",
      kind: "bullet",
      experienceId: exp.id,
      index: 1,
      before: exp.bullets[1],
      after: "Onboarded 40 new business accounts through video calls and written guides, getting each one live and supported in Zendesk",
      reason: "Matches 'running onboarding calls with business customers'",
      flags: [],
      accepted: true,
    },
    {
      id: "c3",
      kind: "bullet",
      experienceId: exp.id,
      index: 2,
      before: exp.bullets[2],
      after: "Kept churn under 3% by managing renewals in Salesforce",
      reason: "Uses the post's wording about renewals",
      flags: ["Salesforce"],
      accepted: false,
    },
    { id: "c4", kind: "bullet-order", experienceId: exp.id, order: [1, 2, 0, 3], reason: "Puts onboarding and churn first", flags: [], accepted: true },
  ];
  await withDb((db) =>
    db.collection("documents").insertOne({ _id: crypto.randomUUID() as never, userId, jobId, kind: "cv", cv: { changes }, text: null, createdAt: new Date(), updatedAt: new Date() }),
  );
  await page.goto(`${jobUrl}/cv`);
  await expect(page.getByRole("heading", { name: "Suggested changes" })).toBeVisible();
  await page.screenshot(shot("tailored-cv"));

  await page.goto(`${jobUrl}/cover-letter`);
  await page.getByRole("button", { name: "Write a draft" }).click();
  await expect(page.getByLabel("Cover letter")).not.toHaveValue("");
  await page.screenshot(shot("cover-letter"));

  await page.goto(`${jobUrl}/interview`);
  await page.getByRole("button", { name: "Get my questions" }).click();
  const first = page.getByRole("region", { name: "Current interview question" });
  await first
    .getByLabel("Your answer")
    .fill("Our renewals were slipping, so I set up check-in calls two weeks before each renewal and tracked the answers in the CRM. Over six months churn on my accounts fell under 3 percent, and the rest of the team started doing the same calls.");
  await first.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.getByText(/\d\/5/).first()).toBeVisible();
  await page.screenshot(shot("interview"));

  // A few more jobs at different stages for the board.
  for (const [title, company, status] of [
    ["Support Team Lead", "Kathmandu Cloud", "applied"],
    ["Customer Experience Manager", "Daraz", "interview"],
    ["Account Manager", "Fonepay", "saved"],
  ]) {
    await withDb((db) =>
      db.collection("jobs").insertOne({
        _id: crypto.randomUUID() as never,
        userId,
        url: null,
        postText: "x",
        post: { title, company, location: "Kathmandu", salary: "", summary: "", requirements: [], keywords: [] },
        match: { score: 64, keywords: [], requirements: [] },
        status,
        appliedOn: status === "saved" ? null : addDays(day, -5),
        followUpOn: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }
  await withDb((db) => db.collection("jobs").updateOne({ _id: jobId as never }, { $set: { status: "applied", appliedOn: addDays(day, -8), followUpOn: day } }));
  await page.goto("/app/jobs");
  await page.screenshot(shot("jobs"));
  await page.goto("/app");
  await page.screenshot(shot("today"));
});
