import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { EMAIL_OUTBOX, TEST_DATABASE_URL } from "../playwright.config";

export const PASSWORD = "correct-horse-battery";
export const CV_PDF = "test-results/fixtures/asha-gurung-cv.pdf";

export async function logIn(page: Page, address: string, pass = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(pass);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function signUp(page: Page, address: string, name = "Asha Gurung") {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("I agree to the Terms").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app\/profile\?welcome=1/);
}

/** Sign up and import the fixture CV. */
export async function setUpJobSeeker(page: Page, address: string) {
  await signUp(page, address);
  await page.locator("input[type=file][name=file]").setInputFiles(CV_PDF);
  await page.getByRole("button", { name: "Read my CV" }).click();
  await expect(page.getByText("Your CV is in.")).toBeVisible({ timeout: 20_000 });
}

/** Add the fixture job by link and land on its Match tab. */
export async function addFixtureJob(page: Page, fixtureBase: string) {
  await page.goto("/app/jobs");
  await page.getByLabel("Link to the job post").fill(`${fixtureBase}/jobs/northwind.html`);
  await page.getByRole("button", { name: "Add job" }).click();
  await expect(page).toHaveURL(/\/app\/jobs\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  return page.url();
}

/** The link in the newest email sent to `to` whose subject contains `subject`. */
export function latestEmailLink(to: string, subject: string): string {
  const emails = readFileSync(EMAIL_OUTBOX, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { to: string; subject: string; text: string })
    .filter((e) => e.to === to && e.subject.includes(subject));
  const link = emails.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No "${subject}" email for ${to}`);
  return link;
}

export async function query<T extends Record<string, unknown>>(run: (sql: postgres.Sql) => Promise<T[]>): Promise<T[]> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

/** Log out through the account menu in the top bar. */
export async function logOut(page: Page) {
  await page.getByLabel("Account menu").click();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/app"));
}
