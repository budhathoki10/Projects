import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { chromium } from "@playwright/test";
import { EMAIL_OUTBOX } from "../playwright.config";
import { withDb } from "./helpers";

export const CV_PDF = "test-results/fixtures/asha-gurung-cv.pdf";

/** A real PDF CV, printed by Chromium from the text fixture, so uploads go through actual PDF parsing. */
async function makeCvPdf() {
  const text = readFileSync("tests/fixtures/cv.txt", "utf8");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<!doctype html><html><body style="font-family: Arial; font-size: 12px">${text
    .split("\n")
    .map((l) => `<div>${esc(l) || "&nbsp;"}</div>`)
    .join("")}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  mkdirSync("test-results/fixtures", { recursive: true });
  await page.pdf({ path: CV_PDF, format: "A4" });
  await browser.close();
}

export default async function globalSetup() {
  // Start every run from an empty database.
  await withDb((db) => db.dropDatabase());
  rmSync(EMAIL_OUTBOX, { force: true });
  await makeCvPdf();
}
