import { expect, test } from "@playwright/test";
import { FIXTURE_BASE } from "../playwright.config";
import { addFixtureJob, logIn, query, setUpJobSeeker } from "./helpers";

const email = `asha-${Date.now()}@example.com`;

test.describe.configure({ mode: "serial" });

test("the home page explains the product and its promise", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A CV for every job. Nothing made up.");
  await expect(page.getByText("Blocked · Salesforce isn't in your CV")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free" }).first()).toHaveAttribute("href", "/signup");
});

test("a job seeker goes from CV to application to follow-up, without anything invented", async ({ page }) => {
  // 1. CV: a real PDF upload, read into an editable profile.
  await setUpJobSeeker(page, email);
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Gurung");
  await expect(page.getByLabel("Email")).toHaveValue("asha.gurung@example.com");
  await expect(page.getByLabel("Job title").first()).toHaveValue("Support Specialist");
  await expect(page.getByLabel("Employer").first()).toHaveValue("Brightdesk");
  await expect(page.getByLabel("What you did").first()).toHaveValue(/Onboarded 40 new business accounts/);

  // Fix something by hand, as a user would.
  await page.getByLabel("Headline").fill("Customer Support Specialist, 4 years");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // 2. A job by link: the page's structured data is read.
  const jobUrl = await addFixtureJob(page, FIXTURE_BASE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Customer Success Lead");
  await expect(page.getByText("Northwind Software · Remote, Asia · USD 1800 to 2400 per month")).toBeVisible();

  // 3. Match check: Zendesk shown, Customer Success only listed, HubSpot missing.
  const score = Number(await page.getByTestId("match-score").innerText().then((t) => t.replace("%", "")));
  expect(score).toBeGreaterThan(20);
  const reqs = page.getByRole("heading", { name: "What they ask for" }).locator("xpath=..");
  await expect(reqs.getByRole("listitem").filter({ hasText: "Experience with Zendesk and HubSpot" })).toContainText("Not in your CV");
  await expect(reqs.getByRole("listitem").filter({ hasText: "Experience reducing churn" })).toContainText("You show this");
  await expect(page.locator("mark.marker", { hasText: "Zendesk" }).first()).toBeVisible();
  await expect(page.locator(".pen-mark", { hasText: "HubSpot" }).first()).toBeVisible();

  // 4. Tailored CV: suggestions, preview, PDF.
  await page.getByRole("link", { name: "Tailor my CV" }).click();
  await page.getByRole("button", { name: "Suggest changes" }).click();
  await expect(page.getByRole("heading", { name: "Suggested changes" })).toBeVisible();
  const preview = page.getByLabel("CV preview");
  await expect(preview.getByRole("region", { name: "Experience" }).getByRole("listitem").first()).toContainText("Zendesk");
  await expect(preview).toContainText("Zendesk, Customer Success, Onboarding");
  await expect(preview).not.toContainText("HubSpot");

  // Rejecting a change takes it out of the preview.
  const skills = page.getByRole("listitem").filter({ hasText: "Leads with the skills in the job post" });
  await skills.getByRole("button", { name: "Don't use this" }).click();
  await expect(skills.getByText("Not using")).toBeVisible();

  const [pdfPage] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "Download PDF" }).click()]);
  await expect(pdfPage.getByLabel("CV preview")).toContainText("Asha Gurung");
  await expect(pdfPage).toHaveTitle("asha-gurung-cv-customer-success-lead");
  await pdfPage.close();

  // Word is part of the pass.
  await expect(page.getByRole("link", { name: "Word download comes with a pass" })).toBeVisible();

  // 5. Cover letter: drafted from the CV, edited, saved, nothing unsupported.
  await page.getByRole("link", { name: "Cover letter" }).click();
  await page.getByRole("button", { name: "Write a draft" }).click();
  const letter = page.getByLabel("Cover letter");
  await expect(letter).toHaveValue(/Customer Success Lead position at Northwind Software/);
  await expect(page.getByText("Check these before sending")).toHaveCount(0);
  await letter.fill(`${await letter.inputValue()}\n\nP.S. I can start in two weeks.`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // 6. Interview prep, with feedback on a typed answer.
  await page.getByRole("link", { name: "Interview prep" }).click();
  await page.getByRole("button", { name: "Get my questions" }).click();
  await expect(page.getByRole("heading", { name: /This role uses HubSpot/ })).toBeVisible();
  const first = page.getByRole("listitem").first();
  await first
    .getByLabel("Your answer")
    .fill("Our renewals were slipping, so I set up check-in calls two weeks before each renewal and tracked answers in the CRM. Over six months churn on my accounts fell under 3 percent, and the whole team started doing the same.");
  await first.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.getByText(/\d\/5/).first()).toBeVisible();
  await expect(page.getByText("Practised 1 of")).toBeVisible();

  // 7. Apply, then a week passes with no answer.
  await page.getByLabel("Status").selectOption("applied");
  await expect(page.getByLabel("Status")).toHaveValue("applied");
  const jobId = jobUrl.split("/").pop()!;
  await expect.poll(async () => (await query((sql) => sql`select status from jobs where id = ${jobId}`))[0]?.status).toBe("applied");
  await query((sql) => sql`update jobs set applied_on = current_date - 8, follow_up_on = current_date - 1 where id = ${jobId}`);

  await page.goto("/app");
  await expect(page.getByLabel("1 to follow up")).toBeVisible();
  const due = page.getByRole("region", { name: "Worth a follow-up" });
  await expect(due.getByRole("link", { name: "Customer Success Lead" })).toBeVisible();
  await page.goto(jobUrl);
  await expect(page.getByLabel("Follow-up message")).toHaveValue(/I applied for Customer Success Lead at Northwind Software/);
  await page.getByRole("button", { name: "I followed up" }).click();
  await expect(page.getByLabel("1 to follow up")).toHaveCount(0);

  await page.goto("/app/progress");
  await expect(page.getByText("Applications sent")).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^1$/ }).first()).toBeVisible();
});

test("the free allowance runs out, and a Khalti pass lifts it and unlocks Word downloads", async ({ page }) => {
  await logIn(page, email);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/jobs");
  await page.getByRole("link", { name: /Customer Success Lead/ }).click();
  await page.getByRole("link", { name: "Tailored CV", exact: true }).click();

  // One tailoring used already; two more reach the free limit of 3.
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Suggest again" }).click();
    await expect(page.getByText(/suggested change/)).toBeVisible();
  }
  await page.getByRole("button", { name: "Suggest again" }).click();
  await expect(page.getByText("That's this month's free allowance used.")).toBeVisible();

  await page.goto("/app/billing");
  await expect(page.getByTestId("current-plan")).toHaveText("Free");
  await page.getByRole("button", { name: "NPR 1,500 for 30 days" }).click();
  await expect(page).toHaveURL(/\/app\/billing\?status=success/);
  await expect(page.getByTestId("current-plan")).toHaveText("Job-hunt pass");
  await expect(page.getByText("Your pass is active.")).toBeVisible();

  await page.goto("/app/jobs");
  await page.getByRole("link", { name: /Customer Success Lead/ }).click();
  await page.getByRole("link", { name: "Tailored CV", exact: true }).click();
  await page.getByRole("button", { name: "Suggest again" }).click();
  await expect(page.getByText(/suggested change/)).toBeVisible();

  const download = await page.request.get((await page.getByRole("link", { name: "Download Word" }).getAttribute("href"))!);
  expect(download.headers()["content-disposition"]).toBe('attachment; filename="asha-gurung-cv-customer-success-lead.docx"');
  expect((await download.body()).subarray(0, 2).toString()).toBe("PK");
});

test("a pasted job works when the site blocks reading", async ({ page }) => {
  await logIn(page, email);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/jobs");
  await page.getByLabel("Link to the job post").fill(`${FIXTURE_BASE}/jobs/login-wall`);
  await page.getByRole("button", { name: "Add job" }).click();
  await expect(page.getByText("That site doesn't let us read its pages.")).toBeVisible();
  await page.getByLabel("Job description").fill(
    "Staff Nurse\nCompany: City Hospital\nLocation: Lalitpur\n\nRequirements\n- BLS certificate\n- 2 years of ward experience\n- Patient Care\n- Excellent written communication in English",
  );
  await page.getByRole("button", { name: "Add job" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Staff Nurse");
  await expect(page.getByText("3 must-haves not in your CV.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "BLS certificate" })).toContainText("Not in your CV");
});
