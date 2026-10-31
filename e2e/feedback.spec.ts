import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("login feedback is actionable, keeps input and clears when the candidate edits", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("feedback-candidate@example.com");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  const loginButton = page.getByRole("button", { name: "Log in", exact: true });
  const before = await loginButton.boundingBox();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const message = page.getByRole("alert").filter({ hasText: "Unable to log in" });
  await expect(message).toContainText("Unable to log in");
  await expect(message).toContainText("Incorrect email or password.");
  const after = await loginButton.boundingBox();
  expect(Math.abs(after!.y - before!.y), "The login button stays in place when an error appears").toBeLessThanOrEqual(1);
  await expect(message.getByRole("link", { name: "Reset password" })).toHaveAttribute("href", "/forgot-password");
  // Both fields are marked, so it is clear what to change.
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("feedback-candidate@example.com");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("incorrect-password");
  expect(page.url()).not.toContain("password");
  mkdirSync("tmp/feedback-audit", { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `feedback fits ${width}px`).toBe(true);
    expect((await message.boundingBox())!.height, `compact notification at ${width}px`).toBeLessThanOrEqual(96);
  }
  await page.screenshot({ path: "tmp/feedback-audit/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "tmp/feedback-audit/login-mobile.png", fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: "tmp/feedback-audit/login-dark.png", fullPage: true, animations: "disabled" });
  await page.getByLabel("Password", { exact: true }).fill("updated-password");
  await expect(message).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).not.toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(message).toContainText("Unable to log in");
  await message.getByRole("link", { name: "Reset password" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("signup validation identifies the field and preserves the remaining details", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("   ");
  await page.getByLabel("Email", { exact: true }).fill("feedback-signup@example.com");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByLabel("I agree to the Terms").check();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Your name")).toBeFocused();
  await expect(page.getByText("Enter your name.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("feedback-signup@example.com");
  await page.getByLabel("Your name").fill("Alex");
  await expect(page.getByText("Enter your name.", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Your name")).not.toHaveAttribute("aria-invalid", "true");
});
