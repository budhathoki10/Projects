import "server-only";
import { safeFetch } from "@/lib/safe-fetch";
import { cleanText } from "@/lib/text";
import { htmlToText } from "@/lib/jobs/html";
import type { CompanyResearch, CompanySource } from "./types";

/** Only crawl a website the candidate identifies. A company name is not enough to guess its domain. */
export async function researchCompany(input: string): Promise<CompanyResearch> {
  if (!input.trim()) return { sources: [], facts: [], warning: "No company website supplied. Company products, culture and hiring practices have not been verified." };
  const sources: CompanySource[] = [];
  try {
    const home = await safeFetch(input.trim(), 8000);
    if (home.status >= 400 || !String(home.headers["content-type"] ?? "").includes("text/html")) throw new Error("Unavailable website");
    const origin = new URL(home.finalUrl).origin;
    const append = (url: string, html: string) => {
      const text = cleanText(htmlToText(html)).slice(0, 16_000);
      if (text.length < 80) return;
      sources.push({ id: `source-${sources.length + 1}`, url, title: htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? new URL(url).hostname).slice(0, 180), text, retrievedAt: new Date().toISOString() });
    };
    append(home.finalUrl, home.body);
    const links = [...home.body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((m) => {
      try {
        const url = new URL(m[1].replace(/&amp;/g, "&"), home.finalUrl);
        if (url.origin !== origin || !/about|career|culture|product|engineering/i.test(`${url.pathname} ${htmlToText(m[2])}`) || /logout|signout|delete|unsubscribe/i.test(url.pathname)) return [];
        url.hash = "";
        return [url.href];
      } catch { return []; }
    });
    const results = await Promise.allSettled([...new Set(links)].filter((url) => url !== home.finalUrl).slice(0, 2).map((url) => safeFetch(url, 7000)));
    for (const result of results) if (result.status === "fulfilled" && result.value.status < 400 && new URL(result.value.finalUrl).origin === origin && String(result.value.headers["content-type"] ?? "").includes("text/html")) append(result.value.finalUrl, result.value.body);
    const facts: CompanyResearch["facts"] = [];
    const patterns = { product: /\b(product|platform|customers?|build|solution|service)\b/i, technology: /\b(python|typescript|javascript|react|django|fastapi|database|engineering|technology|stack)\b/i, culture: /\b(values|remote|collaboration|inclusion|flexible|teamwork)\b/i, hiring: /\b(hiring|interview|recruitment|assessment|selection)\b/i };
    for (const [category, pattern] of Object.entries(patterns)) {
      for (const source of sources) {
        const quote = source.text.split(/\n+|(?<=[.!?])\s+/).find((line) => line.length >= 40 && line.length <= 420 && pattern.test(line));
        if (quote) { facts.push({ category: category as CompanyResearch["facts"][number]["category"], sourceId: source.id, quote }); break; }
      }
    }
    return { sources, facts, warning: sources.length ? "Confirm this website belongs to the employer. These are dated excerpts from its public pages, not independently verified claims or a prediction of its interview process." : "The website had no readable company information." };
  } catch {
    return { sources, facts: [], warning: "Company research was unavailable or blocked. No company details were invented; check the employer's official website manually." };
  }
}
