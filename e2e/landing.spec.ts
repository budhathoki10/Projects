import { expect, test } from "@playwright/test";

test("the landing page has all its content and working calls to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/A CV for every job\.\s*Nothing made up\./);
  for (const heading of ["How it works", "Why one CV doesn't work", "Pricing", "Questions", "Your next application, tailored today."]) {
    await expect(page.getByRole("heading", { name: heading })).toBeAttached();
  }
  const signups = page.getByRole("link", { name: /^Start free/ });
  expect(await signups.count()).toBeGreaterThanOrEqual(3);
  for (const a of await signups.all()) await expect(a).toHaveAttribute("href", "/signup");
  await expect(page.locator("#how")).toBeAttached();
  await expect(page.locator("#pricing")).toBeAttached();
  // Every FAQ answer is on the page (not hidden behind a click), so search engines and everyone else can read it.
  await expect(page.getByText("A change that adds an employer, title, number, tool, skill or qualification")).toBeAttached();
});

test("with reduced motion nothing is hidden and nothing waits to appear", async ({ browser }) => {
  const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await page.goto("/");
  await page.waitForTimeout(250);
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll("main *")].filter((el) => {
      const style = getComputedStyle(el);
      return style.opacity === "0" && (el.textContent ?? "").trim().length > 0 && !el.closest("[aria-hidden=true]");
    }).length,
  );
  expect(hidden).toBe(0);
  // And the ambient loops are off.
  const looping = await page.evaluate(() => document.getAnimations().filter((a) => (a.effect?.getComputedTiming().iterations ?? 1) === Infinity && a.playState === "running").length);
  expect(looping).toBe(0);
  await page.close();
});

for (const width of [320, 390, 768, 1360]) {
  test(`the landing page never scrolls sideways at ${width}px`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
    await page.goto("/");
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.close();
  });
}

test("animations do not shift the layout", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.waitForTimeout(3500);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls, `cumulative layout shift ${cls.toFixed(3)}`).toBeLessThan(0.05);
  await page.close();
});

test("the header settles into a solid bar once the page scrolls", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header").first();
  await expect(header).toHaveAttribute("data-scrolled", "false");
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(header).toHaveAttribute("data-scrolled", "true");
});

test("on a wide screen the steps are driven by scroll: the rail fills and each step comes forward in turn", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
  await page.goto("/");
  const how = page.locator("#how");
  const box = (await how.boundingBox())!;
  const top = await page.evaluate(() => document.querySelector("#how")!.getBoundingClientRect().top + window.scrollY);
  const fill = page.locator("[data-fill]");
  await expect(fill).toBeAttached({ timeout: 10_000 });
  const scale = async () => Number(await fill.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).d));
  await page.evaluate((y) => window.scrollTo(0, y), top + box.height * 0.1);
  await page.waitForTimeout(900);
  const early = await scale();
  await page.evaluate((y) => window.scrollTo(0, y), top + box.height * 0.8);
  await page.waitForTimeout(900);
  const late = await scale();
  expect(late).toBeGreaterThan(early);
  expect(late).toBeGreaterThan(0.7);
  // Steps already shown stay shown: the third step's picture is visible after scrolling on to the fourth.
  await expect(page.getByText("Using · every fact is in your CV").last()).toBeVisible();
  await page.close();
});

test("on a phone the plans are readable cards, with the price in view", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto("/");
  await page.locator("#pricing").scrollIntoViewIfNeeded();
  const paid = page.locator("#pricing").getByText("Paid plan").first();
  await paid.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const box = (await paid.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(page.locator("#pricing").getByText("Word (.docx) download").first()).toBeVisible();
  await page.close();
});
