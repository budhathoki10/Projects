import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { FIXTURE_BASE, PADDLE_SECRET } from "../playwright.config";
import { addFixtureJob, latestEmailLink, logIn, PASSWORD, query, setUpJobSeeker, signUp, logOut } from "./helpers";

const stamp = Date.now();

test.describe.configure({ mode: "serial" });

test("signed-out visitors are sent to log in for every app page", async ({ page }) => {
  for (const path of ["/app", "/app/jobs", "/app/profile", "/app/billing", "/app/settings/export"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login/);
  }
});

test("people can never open each other's jobs or downloads", async ({ page, browser }) => {
  await setUpJobSeeker(page, `owner-${stamp}@example.com`);
  const jobUrl = await addFixtureJob(page, FIXTURE_BASE);
  const jobId = jobUrl.split("/").pop()!;

  const other = await browser.newPage();
  await signUp(other, `other-${stamp}@example.com`, "Other Person");
  for (const path of [`/app/jobs/${jobId}`, `/app/jobs/${jobId}/cv`, `/app/print/cv/${jobId}`]) {
    const res = await other.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  expect((await other.request.get(`/app/download/cv/${jobId}`, { maxRedirects: 0 })).status()).toBe(303); // free: to billing, not the file
  await other.close();
});

test("confirming email, resetting a password and exporting data work", async ({ page }) => {
  const address = `reset-${stamp}@example.com`;
  await signUp(page, address);
  await page.goto(latestEmailLink(address, "Confirm"));
  await expect(page.getByText("Email confirmed.")).toBeVisible();

  const exported = await page.request.get("/app/settings/export");
  const data = await exported.json();
  expect(data.account.email).toBe(address);
  expect(exported.headers()["content-disposition"]).toContain("shortlist-data.json");

  await logOut(page);
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(address);
  await page.getByRole("button", { name: /reset link/i }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();
  await page.goto(latestEmailLink(address, "Reset"));
  await page.getByLabel("New password", { exact: true }).fill("a-brand-new-password");
  await page.getByLabel("Type it again").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/app\?reset=1/);
});

test("a signed Paddle payment adds exactly the days of the price paid, once", async ({ page, request }) => {
  const address = `paddle-${stamp}@example.com`;
  await signUp(page, address);
  const [{ id }] = await query((sql) => sql`select id from users where email = ${address}`);
  const body = JSON.stringify({
    event_id: "evt_1",
    event_type: "transaction.completed",
    data: { id: `txn_${stamp}`, currency_code: "USD", custom_data: { userId: id, days: 9999 }, items: [{ price: { id: "pri_90" } }], details: { totals: { grand_total: "3500" } } },
  });
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", PADDLE_SECRET).update(`${ts}:${body}`).digest("hex");
  const send = (signature: string) => request.post("/api/webhooks/paddle", { data: body, headers: { "content-type": "application/json", "paddle-signature": signature } });

  expect((await send(`ts=${ts};h1=${"0".repeat(64)}`)).status()).toBe(401);
  expect((await send(`ts=${ts};h1=${sig}`)).status()).toBe(200);
  expect((await send(`ts=${ts};h1=${sig}`)).status()).toBe(200); // a retried delivery
  const [row] = await query((sql) => sql`select round(extract(epoch from pass_until - now()) / 86400) as days from users where id = ${id}`);
  expect(Number(row.days)).toBe(90);
});

test("the daily reminder job needs its secret", async ({ request }) => {
  expect((await request.get("/api/cron-job/daily")).status()).toBe(401);
  expect((await request.get("/api/cron-job/nope?key=e2e-cron-job-secret")).status()).toBe(404);
  const res = await request.get("/api/cron-job/daily?key=e2e-cron-job-secret&wait=1");
  expect(await res.json()).toMatchObject({ job: "daily", result: { sent: expect.any(Number) } });
});

test("deleting the account removes everything", async ({ page }) => {
  const address = `delete-${stamp}@example.com`;
  await setUpJobSeeker(page, address);
  await addFixtureJob(page, FIXTURE_BASE);
  const [{ id }] = await query((sql) => sql`select id from users where email = ${address}`);
  await page.goto("/app/settings");
  await page.getByLabel("Confirm with your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Your account and everything in it has been deleted.")).toBeVisible();
  const [left] = await query((sql) => sql`select (select count(*) from jobs where user_id = ${id})::int as jobs, (select count(*) from profiles where user_id = ${id})::int as profiles`);
  expect(left).toEqual({ jobs: 0, profiles: 0 });
  await logIn(page, address);
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no page is wider than the screen", async ({ page }) => {
    const fits = async (path: string) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    };
    for (const path of ["/", "/signup", "/login", "/terms", "/privacy", "/refund"]) await fits(path);
    await logIn(page, `owner-${stamp}@example.com`);
    await expect(page).toHaveURL(/\/app$/);
    for (const path of ["/app", "/app/profile", "/app/jobs", "/app/progress", "/app/settings", "/app/billing"]) await fits(path);
    const [{ id }] = await query((sql) => sql`select j.id from jobs j join users u on u.id = j.user_id where u.email = ${`owner-${stamp}@example.com`} limit 1`);
    for (const tab of ["", "/cv", "/cover-letter", "/interview"]) await fits(`/app/jobs/${id}${tab}`);
  });
});
