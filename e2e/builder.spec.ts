import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yIssues, logIn, query, signUp } from "./helpers";

const stamp = Date.now();
const email = `builder-${stamp}@example.com`;

test.describe.configure({ mode: "serial" });

test("someone without a CV builds one step by step, and nothing is added to their words", async ({ page }) => {
  await signUp(page, email, "Sita Thapa");
  await page.getByRole("link", { name: "Build one with help" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();

  // About you: the name is already there from sign-up; the headline is required.
  await expect(page.getByLabel("Full name")).toHaveValue("Sita Thapa");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add a headline" })).toBeVisible();
  await page.getByLabel("Headline").fill("Staff Nurse");
  await page.getByLabel("City and country").fill("Pokhara, Nepal");
  await page.getByRole("button", { name: "Continue" }).click();

  // Work: rough notes become bullet points, and the person picks which to use.
  await expect(page.getByRole("heading", { level: 1, name: "Your work" })).toBeVisible();
  await page.getByLabel("Job title").fill("Staff Nurse");
  await page.getByLabel("Employer").fill("Manipal Hospital");
  await page.getByLabel("From").fill("2021");
  await page.getByLabel("I work here now").check();
  await page.getByLabel("What did you do there?").fill("I looked after 12 patients a shift. I trained 3 new nurses. I also made tea sometimes.");
  await page.getByRole("button", { name: "Turn into bullet points" }).click();
  const picks = page.getByRole("group", { name: /Tick the ones to use/ });
  await expect(picks.getByRole("checkbox")).toHaveCount(3);
  await picks.getByRole("checkbox", { name: /made tea/ }).uncheck();
  await picks.getByRole("button", { name: "Add these points" }).click();
  await expect(page.getByLabel("Bullet points")).toHaveValue("Looked after 12 patients a shift\nTrained 3 new nurses");
  await expect(page.getByRole("complementary", { name: "Preview" })).toContainText("Looked after 12 patients a shift");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your studies" })).toBeVisible();

  // Leaving and coming back starts at the first step that's still empty.
  await page.goto("/app");
  await page.goto("/app/profile/build");
  await expect(page.getByRole("heading", { level: 1, name: "Your studies" })).toBeVisible();

  await page.getByLabel("Qualification").fill("BSc Nursing");
  await page.getByLabel("School, college or university").fill("Pokhara University");
  await page.getByRole("button", { name: "Continue" }).click();

  // Skills: typed ones (commas split them) and a one-tap suggestion.
  await page.getByLabel("Skills").fill("Patient care, Wound care");
  await page.getByLabel("Skills").press("Enter");
  await page.getByRole("button", { name: "Add Communication" }).click();
  await expect(page.getByRole("list", { name: "Skills" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "Continue" }).click();

  // Summary: drafted from what's there (the plain version, with no AI key in tests).
  await page.getByRole("button", { name: "Write it for me" }).click();
  await expect(page.getByRole("textbox", { name: "Summary" })).toHaveValue("Staff Nurse at Manipal Hospital. Skilled in Patient care, Wound care and Communication.");
  await page.getByRole("button", { name: "Continue" }).click();

  // Pick a look from four, then finish.
  const looks = page.getByRole("radio");
  await expect(looks).toHaveCount(4);
  await looks.nth(1).check({ force: true });
  const chosen = await looks.nth(1).getAttribute("value");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/app\/studio$/);
  await expect(page.getByRole("status").filter({ hasText: "Your CV is ready." })).toBeVisible();

  const [row] = await query((sql) => sql`select p.data, p.default_template_id from profiles p join users u on u.id = p.user_id where u.email = ${email}`);
  expect(row.default_template_id).toBe(chosen);
  const data = row.data as { experience: { bullets: string[]; end: string }[]; skills: string[] };
  expect(data.experience[0]).toMatchObject({ bullets: ["Looked after 12 patients a shift", "Trained 3 new nurses"], end: "Present" });

  // Today no longer asks for a CV.
  await page.goto("/app");
  await expect(page.getByRole("region", { name: "Up next" })).not.toContainText("Add your CV");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the builder fits the screen, the preview is one tap away, and it passes accessibility checks", async ({ page }) => {
    await logIn(page, email);
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/profile/build");
    await expect(page.getByRole("heading", { level: 1, name: "Pick a look" })).toBeVisible(); // everything is filled in
    const steps = page.getByRole("navigation", { name: "Steps" });
    for (const [name, title] of [["About you", "About you"], ["Work", "Your work"], ["Studies", "Your studies"], ["Skills", "Skills and languages"], ["Summary", "A short summary"], ["Your look", "Pick a look"]]) {
      await steps.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${title} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("complementary", { name: "Preview" })).toBeVisible();
    await page.getByRole("button", { name: "Back to editing" }).click();
    await expectNoSeriousA11yIssues(page, "/app/profile/build");
  });
});
