/** Small, dependency-free HTML helpers for job pages. */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Readable text from HTML, keeping list items and paragraphs on their own lines. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|head|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>/gi, "\n")
      // Each <li> already starts its own line, so closing one adds nothing.
      .replace(/<\/li>/gi, "")
      .replace(/<\/(p|div|h[1-6]|tr|section|article|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type JobPosting = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } } | { address?: unknown }[];
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } };
  "@graph"?: unknown[];
};

function findPosting(node: unknown): JobPosting | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findPosting(n);
      if (found) return found;
    }
    return null;
  }
  const obj = node as JobPosting;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
  return obj["@graph"] ? findPosting(obj["@graph"]) : null;
}

/**
 * Most job boards and applicant-tracking systems embed a schema.org JobPosting for Google.
 * It's cleaner than scraping the page, so we use it whenever it's there.
 */
export function jobPostingFromHtml(html: string): string | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const p = findPosting(data);
    if (!p?.description) continue;
    const company = typeof p.hiringOrganization === "string" ? p.hiringOrganization : p.hiringOrganization?.name;
    const loc = Array.isArray(p.jobLocation) ? p.jobLocation[0] : p.jobLocation;
    const addr = (loc as { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } } | undefined)?.address;
    const country = typeof addr?.addressCountry === "string" ? addr.addressCountry : addr?.addressCountry?.name;
    const location = [addr?.addressLocality, addr?.addressRegion, country].filter(Boolean).join(", ");
    const v = p.baseSalary?.value;
    const salary = v ? [p.baseSalary?.currency, v.minValue ?? v.value, v.maxValue ? `to ${v.maxValue}` : "", v.unitText ? `per ${v.unitText.toLowerCase()}` : ""].filter(Boolean).join(" ") : "";
    return [p.title, company && `Company: ${company}`, location && `Location: ${location}`, salary && `Salary: ${salary}`, "", htmlToText(p.description)]
      .filter((l) => l !== undefined && l !== null)
      .join("\n")
      .trim();
  }
  return null;
}
