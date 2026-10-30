/**
 * Photographs every built-in template with the sample CV and saves a small WebP to
 * public/template-thumbs/. Needs the app running: `npm run dev` (or BASE_URL=... for another host).
 *   npm run templates:thumbs            all templates
 *   npm run templates:thumbs sl-007     only these
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { BUILTIN_TEMPLATES } from "../src/lib/templates/builtin/index.ts";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const only = new Set(process.argv.slice(2));
const list = BUILTIN_TEMPLATES.filter((t) => !only.size || only.has(t.id));
const out = new URL("../public/template-thumbs/", import.meta.url);
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1.5 });
for (const t of list) {
  await page.goto(`${base}/render/template/${t.id}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const article = page.locator("article").first();
  // The first page only, in A4/Letter proportions.
  const box = (await article.boundingBox())!;
  const ratio = t.spec.page.size === "A4" ? 297 / 210 : 279.4 / 215.9;
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, box.width * ratio) } });
  const webp = await sharp(png).resize({ width: 480 }).webp({ quality: 78 }).toBuffer();
  await writeFile(new URL(`${t.id}.webp`, out), webp);
  console.log(`${t.id} ${t.name} ${Math.round(webp.length / 1024)} KB`);
}
await browser.close();
