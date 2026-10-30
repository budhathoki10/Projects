import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";
import { EMAIL_OUTBOX, TEST_DATABASE_URL } from "../playwright.config";

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
  const url = new URL(TEST_DATABASE_URL);
  const admin = postgres({ host: url.hostname, port: Number(url.port || 5432), user: url.username, password: url.password, database: "postgres", max: 1, onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = ${url.pathname.slice(1)}`;
  if (!exists) await admin.unsafe(`create database "${url.pathname.slice(1)}"`);
  await admin.end();

  execFileSync("npx", ["tsx", "scripts/migrate.mts"], { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: "inherit" });
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`truncate users, sessions, auth_tokens, payments, profiles, jobs, documents, interviews, usage cascade`;
  await sql.end();
  rmSync(EMAIL_OUTBOX, { force: true });
  await makeCvPdf();
}
