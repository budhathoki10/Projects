import type { JobPost, Requirement } from "@/lib/model/types";
import { containsTerm } from "@/lib/text";
import { SKILL_TERMS } from "./skills-dictionary";

/** Plain-code job post reader, used when no AI key is configured. */

const MUST = /^(requirements?|qualifications?|what you('|’)ll need|what we('|’)re looking for|you have|must[- ]haves?|skills( and experience)?|who you are|about you|key skills|essential( criteria)?|minimum qualifications?)\b/i;
const NICE = /^(nice[- ]to[- ]haves?|bonus( points)?|preferred( qualifications)?|desirable( criteria)?|it('|’)s a plus|good to have|pluses|extra credit)\b/i;
const OTHER = /^(responsibilities|what you('|’)ll do|the role|about (us|the company|the role)|benefits|perks|why join|how to apply|what we offer|compensation)\b/i;
const BULLET = /^\s*(?:[-•*▪●◦–]|\d+[.)])\s+/;

/** Acronyms that look like skills but aren't: currencies, units, time zones, common abbreviations. */
const NOT_SKILLS = new Set("USD NPR INR EUR GBP AED AUD CAD JPY QAR SAR CV CVs FAQ ASAP PTO WFH CEO CTO CFO COO VP UTC GMT IST NST EST PST AM PM OK USA UK UAE EU".split(" "));

/** Skill-looking words a dictionary might miss: tools with dots or symbols, CamelCase names, acronyms. */
function oddTerms(line: string): string[] {
  const words = line.match(/[A-Za-z][A-Za-z0-9+#./-]*[A-Za-z0-9+#]/g) ?? [];
  return words.filter((w, i) => {
    if (/^(I|A|An|The|We|You|Our|Your|In|On|At|To|And|Or|For|With|Of|Is|Are|Be|Must|Will|Can|This|That|Experience|Strong|Excellent|Good|Great|Ability|Knowledge|Working|Proven|Familiarity|Understanding)$/.test(w)) return false;
    if (NOT_SKILLS.has(w)) return false;
    if (/[+#]|\.[a-z]/i.test(w) && w.length <= 20) return true;
    if (/^[A-Z]{2,6}$/.test(w)) return true;
    return i > 0 && /^[a-z]+[A-Z]/.test(w);
  });
}

function keywordsIn(text: string): string[] {
  const found: string[] = SKILL_TERMS.filter((t) => containsTerm(text, t));
  for (const t of oddTerms(text)) if (!found.some((f) => f.toLowerCase() === t.toLowerCase())) found.push(t);
  return found;
}

function firstMatch(lines: string[], re: RegExp): string {
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m[1].trim();
  }
  return "";
}

export function heuristicJob(text: string): JobPost {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const title = firstMatch(lines, /^(?:job title|position|role)\s*:\s*(.+)$/i) || (lines[0] && lines[0].length < 100 ? lines[0] : "");
  const company =
    firstMatch(lines, /^(?:company|employer|organi[sz]ation)\s*:\s*(.+)$/i) ||
    firstMatch(lines.slice(0, 4), /\bat\s+([A-Z][\w&.' -]{1,60})$/) ||
    firstMatch(lines, /^about\s+(?!us\b|the\b|you\b)([A-Z][\w&.' -]{1,60})$/i);
  const location = firstMatch(lines, /^(?:location|based in|where)\s*:\s*(.+)$/i);
  const salary =
    firstMatch(lines, /^(?:salary|pay|compensation)\s*:\s*(.+)$/i) ||
    lines.find((l) => /(\$|£|€|NPR|Rs\.?|INR|AED|USD)\s?\d|\d[\d,]*\s?(k|per (year|month|hour)|\/(yr|year|mo|month|hr|hour))/i.test(l) && l.length < 120) ||
    "";

  const requirements: Requirement[] = [];
  let section: "must" | "nice" | "other" | null = null;
  for (const line of lines) {
    const bare = line.replace(/[:*#]+$/, "").replace(/^[#*]+\s*/, "").trim();
    if (!BULLET.test(line) && bare.length < 60) {
      if (NICE.test(bare)) section = "nice";
      else if (MUST.test(bare)) section = "must";
      else if (OTHER.test(bare)) section = "other";
      if (NICE.test(bare) || MUST.test(bare) || OTHER.test(bare)) continue;
    }
    if ((section === "must" || section === "nice") && (BULLET.test(line) || line.length > 15)) {
      const req = line.replace(BULLET, "").trim();
      requirements.push({ text: req, kind: section, keywords: keywordsIn(req) });
    }
  }
  // No headed sections: treat every bullet as a requirement.
  if (requirements.length === 0) {
    for (const line of lines.filter((l) => BULLET.test(l)).slice(0, 25)) {
      const req = line.replace(BULLET, "").trim();
      requirements.push({ text: req, kind: "must", keywords: keywordsIn(req) });
    }
  }

  const keywords = [...new Set([...requirements.flatMap((r) => r.keywords), ...keywordsIn(text)].map((k) => k.trim()))].slice(0, 40);
  const summary = lines.find((l) => l.length > 80 && !BULLET.test(l)) ?? "";
  return { title, company, location, salary, summary: summary.slice(0, 400), requirements: requirements.slice(0, 30), keywords };
}
