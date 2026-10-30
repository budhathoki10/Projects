import { expect, test } from "@playwright/test";
import { FIXTURE_BASE } from "../playwright.config";
import { addFixtureJob, query, setUpJobSeeker } from "./helpers";

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
  await guest.goto("/templates");
  await guest.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((i) => i.setAttribute("loading", "eager")));
  await guest.waitForLoadState("networkidle");
  await guest.screenshot(shot("templates-public", false));

  await setUpJobSeeker(page, `shots-${Date.now()}@example.com`);
  await page.screenshot(shot("profile"));
  const jobUrl = await addFixtureJob(page, FIXTURE_BASE);
  const jobId = jobUrl.split("/").pop()!;
  await page.screenshot(shot("match"));

  // Example suggestions in the shape the AI returns, including one the fact check blocks.
  const [{ data }] = await query((sql) => sql`select p.data from profiles p join jobs j on j.user_id = p.user_id where j.id = ${jobId}`);
  const profile = data as { summary: string; experience: { id: string; bullets: string[] }[] };
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
  await query((sql) => sql`insert into documents (user_id, job_id, kind, cv) select user_id, id, 'cv', ${sql.json(changes)} from jobs where id = ${jobId}`);
  await query((sql) => sql`update documents set cv = jsonb_build_object('changes', cv) where job_id = ${jobId} and kind = 'cv'`);
  await page.goto(`${jobUrl}/cv`);
  await expect(page.getByRole("heading", { name: "Suggested changes" })).toBeVisible();
  await page.screenshot(shot("tailored-cv"));

  await page.goto(`${jobUrl}/cover-letter`);
  await page.getByRole("button", { name: "Write a draft" }).click();
  await expect(page.getByLabel("Cover letter")).not.toHaveValue("");
  await page.screenshot(shot("cover-letter"));

  await page.goto(`${jobUrl}/interview`);
  await page.getByRole("button", { name: "Get my questions" }).click();
  const first = page.getByRole("listitem").first();
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
    await query(
      (sql) => sql`insert into jobs (user_id, post_text, post, status, applied_on, match)
        select user_id, 'x', ${sql.json({ title, company, location: "Kathmandu", salary: "", summary: "", requirements: [], keywords: [] })}, ${status},
          case when ${status} = 'saved' then null else current_date - 5 end, ${sql.json({ score: 64, keywords: [], requirements: [] })}
        from jobs where id = ${jobId}`,
    );
  }
  await query((sql) => sql`update jobs set status = 'applied', applied_on = current_date - 8, follow_up_on = current_date where id = ${jobId}`);
  await query((sql) => sql`update jobs set interview_on = current_date + 2 where post->>'company' = 'Daraz' and user_id = (select user_id from jobs where id = ${jobId})`);
  await page.goto("/app/jobs");
  await page.screenshot(shot("jobs"));
  await page.goto("/app");
  await page.screenshot(shot("today"));

  // CV Studio: home, the gallery, a preview with the user's CV, and the editor.
  await page.goto("/app/studio");
  await page.screenshot(shot("studio"));
  await page.goto("/app/studio/templates");
  await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((i) => i.setAttribute("loading", "eager")));
  await page.waitForLoadState("networkidle");
  await page.screenshot(shot("templates", false));
  await page.getByLabel("Search templates").fill("saffron");
  await page.getByRole("button", { name: /^Saffron\./ }).click();
  await expect(page.getByRole("dialog", { name: "Saffron preview" }).getByLabel("CV preview")).toContainText("Asha Gurung");
  await page.waitForTimeout(500);
  await page.screenshot(shot("template-preview", false));
  await page.goto("/app/studio/edit/sl-086");
  await expect(page.getByLabel("CV preview")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot(shot("editor", false));

  // Dark mode.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/app");
  await page.screenshot(shot("today-dark", false));
  await page.emulateMedia({ colorScheme: "light" });

  // Phone: Today with the tab bar.
  const phoneApp = await browser.newPage({ viewport: { width: 390, height: 844 }, storageState: await page.context().storageState() });
  await phoneApp.goto("/app");
  await phoneApp.screenshot(shot("mobile-today", false));
});
