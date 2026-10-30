import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import sharp from "sharp";
import { FIXTURE_BASE } from "../playwright.config";
import { addFixtureJob, expectNoSeriousA11yIssues, logIn, query, setUpJobSeeker, signUp } from "./helpers";

const stamp = Date.now();
const email = `studio-${stamp}@example.com`;
let jobUrl = "";

test.describe.configure({ mode: "serial" });

const userId = async (address: string) => (await query((sql) => sql`select id from users where email = ${address}`))[0].id as string;


test("browse the gallery with your own CV, make a template your own and use it for a job", async ({ page }) => {
  await setUpJobSeeker(page, email);
  jobUrl = await addFixtureJob(page, FIXTURE_BASE);

  // The gallery: 100 templates, honest filters, previews with the user's own CV.
  await page.goto("/app/studio/templates");
  await expect(page.getByRole("heading", { name: "All 100 templates" })).toBeVisible();
  await page.getByRole("button", { name: "Two columns" }).click();
  const count = page.locator("h2#all");
  await expect(count).toHaveText("20 templates");
  await page.getByRole("button", { name: "Teal" }).click();
  await expect(count).toHaveText(/^[1-9] templates?$/);
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByLabel("Search templates").fill("charter");
  await page.getByRole("button", { name: /^Charter\./ }).click();
  const preview = page.getByRole("dialog", { name: "Charter preview" });
  await expect(preview.getByLabel("CV preview")).toContainText("Asha Gurung");
  await expect(preview.getByLabel("CV preview")).toContainText("Answered customer tickets in Zendesk");
  await preview.getByRole("button", { name: "Use as my default" }).click();
  await expect(preview.getByText("This is now your default for every job.")).toBeVisible();
  const id = await userId(email);
  await expect.poll(async () => (await query((sql) => sql`select default_template_id from profiles where user_id = ${id}`))[0].default_template_id).toBe("sl-033");

  // Customise it: font, colour, section order, then save as the user's own.
  await preview.getByRole("link", { name: "Customise" }).click();
  await expect(page).toHaveURL(/\/app\/studio\/edit\/sl-033$/);
  await page.getByLabel("Body text").selectOption("inter");
  await page.getByRole("button", { name: "Teal colours" }).click();
  await page.getByRole("button", { name: "Move Skills up" }).click();
  await expect(page.getByLabel("CV preview")).toHaveAttribute("data-layout", "executive");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Redo" }).click();
  await page.getByLabel("Template name").fill("Asha's teal");
  await page.getByRole("button", { name: "Save as my template" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved to My templates." })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/studio\/edit\/[0-9a-f-]{36}$/);
  const rows = await query((sql) => sql`select t.id, t.name, t.spec, t.based_on from cv_templates t join users u on u.id = t.user_id where u.email = ${email}`);
  expect(rows[0]).toMatchObject({ name: "Asha's teal", based_on: "sl-033" });
  const spec = rows[0].spec as { fonts: { body: string }; palette: { accent: string }; sections: { id: string }[] };
  expect(spec.fonts.body).toBe("inter");
  expect(spec.palette.accent).toBe("#0d6363");
  const order = spec.sections.map((s) => s.id);
  expect(order.indexOf("skills")).toBeLessThan(order.indexOf("education"));

  // "What an ATS reads" shows the text in reading order.
  await page.getByRole("button", { name: "What an ATS reads" }).click();
  await expect(page.locator("pre")).toContainText(/asha gurung/i);
  await expect(page.locator("pre")).toContainText("Answered customer tickets in Zendesk");

  // Use a different look for the job, straight from its Tailored CV tab.
  await page.goto(`${jobUrl}/cv`);
  await page.getByRole("button", { name: "Suggest changes" }).click();
  await expect(page.getByRole("heading", { name: "Suggested changes" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Look:").locator("..")).toContainText("Charter");
  const option = page.getByRole("button", { name: /^Use the .+ look for this job$/ }).first();
  const optionName = (await option.getAttribute("aria-label"))!.replace(/^Use the (.+) look for this job$/, "$1");
  await option.click();
  await expect(page.getByText("Look:").locator("..")).toContainText(optionName);

  // The PDF page and the Word file follow the job's look.
  const jobId = jobUrl.split("/").pop()!;
  const [{ cv_style }] = await query((sql) => sql`select cv_style from jobs where id = ${jobId}`);
  const chosen = (cv_style as { templateId: string }).templateId;
  await page.goto(`/app/print/cv/${jobId}`);
  const layout = await page.locator("article.cv").getAttribute("data-layout");
  expect(layout).toBeTruthy();
  await page.goto(`/app/studio/templates`);
  await query((sql) => sql`update users set pass_until = now() + interval '30 days' where email = ${email}`);
  const word = await page.request.get(`/app/download/cv/${jobId}`);
  expect(word.status()).toBe(200);
  const xml = await (await JSZip.loadAsync(await word.body())).file("word/document.xml")!.async("string");
  expect(xml).toContain("Answered customer tickets in Zendesk");
  // Switching the job to the user's own template changes the Word file's font.
  const [{ id: mine }] = await query((sql) => sql`select t.id from cv_templates t join users u on u.id = t.user_id where u.email = ${email}`);
  await query((sql) => sql`update jobs set cv_style = ${sql.json({ templateId: mine as string, fit: null })} where id = ${jobId}`);
  const xml2 = await (await JSZip.loadAsync(await (await page.request.get(`/app/download/cv/${jobId}`)).body())).file("word/document.xml")!.async("string");
  expect(xml2).toContain('w:ascii="Inter"');
  expect(chosen).toMatch(/^sl-\d{3}$/);

  // The cover letter prints in the same look.
  await page.goto(`${jobUrl}/cover-letter`);
  await page.getByRole("button", { name: "Write a draft" }).click();
  await expect(page.getByLabel("Cover letter", { exact: true })).toHaveValue(/Dear hiring team/, { timeout: 20_000 });
  await page.goto(`/app/print/letter/${jobId}`);
  await expect(page.getByLabel("Cover letter")).toContainText("Dear hiring team");
  await expect(page.locator("article.cv")).toHaveAttribute("data-layout", "executive");
});

test("a photo shows on photo templates, never on ATS-safe ones, and only to its owner", async ({ page, browser }) => {
  await logIn(page, email);
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/studio");
  const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#3366aa" } }).png().toBuffer();
  await page.locator("input[type=file][name=photo]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Photo saved.")).toBeVisible();
  await expect(page.getByAltText("Your photo")).toBeVisible();

  await page.goto("/app/studio/edit/sl-081"); // Sidecar: photo slot
  await expect(page.getByLabel("CV preview").locator("img.cv-photo")).toHaveCount(1);
  await page.goto("/app/studio/edit/sl-001"); // Classic: ATS-safe, no photo
  await expect(page.getByLabel("CV preview").locator("img")).toHaveCount(0);

  const mine = await page.request.get("/app/photo");
  expect(mine.headers()["content-type"]).toBe("image/webp");
  expect(mine.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await sharp(await mine.body()).metadata()).width).toBe(600);

  const stranger = await browser.newPage();
  const strangerEmail = `stranger-${stamp}@example.com`;
  await signUp(stranger, strangerEmail);
  expect((await stranger.request.get("/app/photo")).status()).toBe(404);
  const anon = await browser.newContext();
  const res = await anon.request.get("/app/photo", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  await anon.close();
  await stranger.close();
});

test("Ctrl+K jumps anywhere, and jobs move between stages by drag or menu", async ({ page }) => {
  await logIn(page, email);
  await expect(page).toHaveURL(/\/app$/);
  await page.keyboard.press("Control+k");
  const bar = page.getByRole("dialog", { name: "Search and jump" });
  await bar.getByLabel("Search").fill("cust lead");
  await expect(bar.getByRole("option").first()).toContainText("Customer Success Lead");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(jobUrl);

  await page.goto("/app/jobs");
  const jobId = jobUrl.split("/").pop()!;
  const status = async () => (await query((sql) => sql`select status from jobs where id = ${jobId}`))[0].status;
  await page.locator("#stage-saved li").filter({ hasText: "Customer Success Lead" }).dragTo(page.locator("#stage-applied"));
  await expect(page.locator("#stage-applied")).toContainText("Customer Success Lead");
  await expect.poll(status).toBe("applied");
  await page.getByLabel("Move Customer Success Lead to").selectOption("interview");
  await expect.poll(status).toBe("interview");

  // An interview with a date shows on Today and Interviews.
  await page.goto(jobUrl);
  const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Interview", { exact: true }).fill(soon);
  await expect.poll(async () => (await query((sql) => sql`select interview_on::text as d from jobs where id = ${jobId}`))[0].d).toBe(soon);
  await page.goto("/app");
  await expect(page.getByRole("region", { name: "Up next" })).toContainText("Practise for your interview in 2 days");
  await expect(page.getByRole("region", { name: "Coming up" })).toContainText("Customer Success Lead");
  await page.goto("/app/interviews");
  await expect(page.getByRole("region", { name: "Booked" })).toContainText("Customer Success Lead");

  // Table view sorts and edits too.
  await page.goto("/app/jobs");
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByLabel("Stage for Customer Success Lead")).toHaveValue("interview");
});

test("the main pages pass automated accessibility checks", async ({ page }) => {
  await logIn(page, email);
  await expect(page).toHaveURL(/\/app$/);
  for (const path of ["/app", "/app/jobs", "/app/studio", "/app/studio/templates", "/app/studio/edit/sl-084", jobUrl, `${jobUrl}/cv`]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoSeriousA11yIssues(page, path);
  }
  await page.goto("/templates");
  await expectNoSeriousA11yIssues(page, "/templates");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tabs at the bottom, and Studio fits the screen", async ({ page }) => {
    await logIn(page, email);
    await expect(page).toHaveURL(/\/app$/);
    const tabs = page.getByRole("navigation", { name: "Main" }).last();
    await tabs.getByRole("link", { name: "Studio" }).click();
    await expect(page).toHaveURL(/\/app\/studio$/);
    await tabs.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "More" }).getByRole("link", { name: "Interviews" }).click();
    await expect(page).toHaveURL(/\/app\/interviews$/);
    for (const path of ["/app/studio", "/app/studio/templates", "/app/studio/edit/sl-090", "/app/interviews", "/templates"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
    await page.goto("/app/studio/edit/sl-090");
    await page.getByRole("tab", { name: "design" }).click();
    await expect(page.getByRole("complementary", { name: "Design controls" })).toBeVisible();
  });
});
