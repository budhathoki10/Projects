import { EMPTY_PROFILE, type Education, type Experience, type Profile } from "@/lib/model/types";
import { localId, splitSentences } from "@/lib/text";
import { textLinks } from "./links";

/**
 * A plain-code CV reader used when no AI key is configured. It understands the common
 * layout: name and contact at the top, then headed sections with bullet points.
 */

const SECTIONS: [keyof typeof HEADINGS, RegExp][] = [];
const HEADINGS = {
  summary: /^(summary|profile|about( me)?|professional summary|objective|career objective)$/i,
  experience: /^(experience|work experience|employment( history)?|professional experience|work history|career history)$/i,
  education: /^(education|academic background|qualifications|education and training)$/i,
  skills: /^(skills|technical skills|key skills|core skills|competencies|skills and tools)$/i,
  projects: /^(projects|personal projects|selected projects|relevant projects|key projects)$/i,
  certifications: /^(certifications|certificates|licenses( and certifications)?|courses|certifications [&] achievements|certifications and achievements|achievements)$/i,
  languages: /^(languages)$/i,
};
for (const [k, re] of Object.entries(HEADINGS)) SECTIONS.push([k as keyof typeof HEADINGS, re]);

const BULLET = /^\s*(?:[-•*▪●◦–]|\d+[.)])\s+/;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const POINT = `(?:${MONTH}\\s+)?(?:\\d{1,2}/)?\\d{4}`;
const DATE_RANGE = new RegExp(`(${POINT})\\s*(?:-|–|—|to)\\s*(${POINT}|present|current|now|today)`, "i");
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const LINK = /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com)\/[^\s|,]+|https?:\/\/[^\s|,]+)/gi;

function headingOf(line: string): keyof typeof HEADINGS | null {
  const t = line.replace(/[:#*_]/g, "").trim();
  if (t.length > 40) return null;
  return SECTIONS.find(([, re]) => re.test(t) || re.test(t.replace(/\s+/g, "")))?.[0] ?? null;
}

const stripBullet = (l: string) => l.replace(BULLET, "").trim();

/** "Frontend Developer, Himalayan Tech — Kathmandu" / "Developer at Acme" / "Acme | Developer" */
function splitRole(line: string): { title: string; company: string; location: string } {
  const noDates = line.replace(/\bCertificate\s*\(https?:\/\/[^\s]+\)/gi, "").replace(DATE_RANGE, "").replace(/[()]/g, "").replace(/\s{2,}/g, " ").trim().replace(/[,|–—-]\s*$/, "");
  let location = "";
  let rest = noDates;
  const loc = rest.match(/\s+[—–]\s+([^,|]+)$/);
  if (loc) {
    location = loc[1].trim();
    rest = rest.slice(0, loc.index).trim();
  }
  const at = rest.match(/^(.+?)\s+at\s+(.+)$/i);
  if (at) return { title: at[1].trim(), company: at[2].trim(), location };
  const parts = rest.split(/\s*[,|]\s*|\s+[—–-]\s+/).filter(Boolean);
  return { title: parts[0] ?? rest, company: parts[1] ?? "", location: location || parts[2] || "" };
}

function parseExperience(lines: string[]): Experience[] {
  const out: Experience[] = [];
  let current: Experience | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (BULLET.test(line)) {
      if (current) current.bullets.push(stripBullet(line));
      continue;
    }
    const dates = line.match(DATE_RANGE);
    const nextDates = !dates && lines[i + 1]?.match(DATE_RANGE) && !BULLET.test(lines[i + 1]) ? lines[i + 1].match(DATE_RANGE) : null;
    if (dates && current && !current.start && !headerLike(line)) {
      current.start = dates[1];
      current.end = normalizeEnd(dates[2]);
      continue;
    }
    if (dates || nextDates) {
      const d = (dates ?? nextDates)!;
      const role = splitRole(line);
      current = { id: localId("x"), ...role, start: d[1], end: normalizeEnd(d[2]), bullets: [] };
      out.push(current);
      if (nextDates) i++;
      continue;
    }
    if (current && !current.company && !current.bullets.length && line.length < 160) {
      const parts = line.split(/\s+[—–·]\s+|\s*\|\s*/);
      current.company = parts[0];
      current.location = parts.slice(1).join(", ");
      continue;
    }
    if (current && current.bullets.length > 0 && line.length > 60) {
      // Wrapped bullet text from a PDF.
      current.bullets[current.bullets.length - 1] += ` ${line}`;
    } else if (current && current.bullets.length === 0 && line.length > 60) {
      current.bullets.push(line);
    }
  }
  return out;
}

function headerLike(line: string) {
  return line.replace(DATE_RANGE, "").trim().length > 3;
}

function normalizeEnd(v: string) {
  return /present|current|now|today/i.test(v) ? "Present" : v;
}

function parseEducation(lines: string[]): Education[] {
  const out: Education[] = [];
  let current: Education | null = null;
  for (const line of lines) {
    if (BULLET.test(line)) {
      current?.details.push(stripBullet(line));
      continue;
    }
    const dates = line.match(DATE_RANGE) ?? line.match(/\b(\d{4})\b/);
    if (current && dates && line.replace(dates[0], "").trim().length < 3) {
      current.start = dates[2] ? dates[1] : "";
      current.end = dates[2] ? normalizeEnd(dates[2]) : dates[1];
      continue;
    }
    const clean = line.replace(DATE_RANGE, "").trim();
    if (current && !dates && !current.school && /\b(university|college|school|institute|academy)\b/i.test(clean)) {
      current.school = clean.replace(/\s+[—–]\s+/g, ", ");
      continue;
    }
    if (current && !dates && (current.school || clean.length > 100)) {
      current.details.push(stripBullet(clean));
      continue;
    }
    const parts = clean.split(/\s*[,|]\s*|\s+[—–-]\s+/).filter(Boolean);
    current = { id: localId("e"), degree: parts[0] ?? clean, school: parts.slice(1).join(", "), start: "", end: "", details: [] };
    if (dates) {
      current.start = dates[2] ? dates[1] : "";
      current.end = dates[2] ? normalizeEnd(dates[2]) : dates[1];
    }
    out.push(current);
  }
  return out;
}

function parseList(lines: string[]): string[] {
  const plainLines = lines.every((l) => !/[,;•·|:]/.test(l) && l.length < 60);
  const text = lines.map((line, i) => {
    const category = /^[A-Za-z &/]{2,40}:\s*/;
    const separator = i && (plainLines || BULLET.test(line) || category.test(stripBullet(line))) ? ", " : " ";
    return separator + stripBullet(line).replace(category, "");
  }).join("");
  return [
    ...new Set(
      text.split(/\s*[,;•·|]\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 60),
    ),
  ];
}

function parseProjects(lines: string[]): Profile["projects"] {
  const projects: Profile["projects"] = [];
  const paragraphs = new Map<string, string[]>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const urls = textLinks(line);
    const clean = line.replace(/\s*\(https?:\/\/[^\s]+\)/g, "").replace(/\s+Live\s*$/i, "").trim();
    const next = lines[i + 1] ?? "";
    if (projects.length && urls.length && /^(?:live|demo|github|source(?: code)?|website|(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?)$/i.test(clean)) {
      projects[projects.length - 1].link ||= urls[0];
      continue;
    }
    const isTitle = !BULLET.test(line) && clean.length <= 160 && !/^Tech Stack:/i.test(clean) && (
      /\s[—–]\s/.test(clean) || /^Tech Stack:/i.test(next) ||
      (clean.length < 80 && BULLET.test(next) && !/[,;:]/.test(clean) && !/[.!?]$/.test(clean)) || !projects.length
    );
    if (isTitle) {
      const project = { id: localId("p"), name: clean.replace(/https?:\/\/\S+/g, "").trim(), link: urls[0] ?? "", bullets: [] as string[] };
      projects.push(project);
      paragraphs.set(project.id, []);
    } else if (projects.length) {
      const current = projects[projects.length - 1];
      const parts = paragraphs.get(current.id)!;
      if (BULLET.test(line)) parts.push(stripBullet(line));
      else if (parts.length && !/[.!?]$/.test(parts[parts.length - 1]) && !/^(?:This is |The second |[A-Z][\w-]+ helps )/.test(clean)) parts[parts.length - 1] += ` ${clean}`;
      else parts.push(clean);
      if (!current.link && urls.length) current.link = urls[0];
    }
  }
  for (const p of projects) {
    const points: string[] = [];
    for (const sentence of paragraphs.get(p.id)!.flatMap(splitSentences).filter(Boolean)) {
      const last = points[points.length - 1];
      if (last && !/^Tech Stack:/i.test(last) && !/^Tech Stack:/i.test(sentence) && last.length + sentence.length < 520) points[points.length - 1] += ` ${sentence}`;
      else points.push(sentence);
    }
    p.bullets = points;
  }
  return projects;
}

export function heuristicProfile(text: string): Profile {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !!l && !/^\d+$/.test(l) && !/·\s*\d+\s*\/\s*\d+$/.test(l) && !/^(?:https?:\/\/)?localhost:\d+\/app\/print\//i.test(l) && !/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/.test(l));
  const profile: Profile = structuredClone(EMPTY_PROFILE);
  const firstHeading = lines.findIndex((l) => headingOf(l));
  const top = lines.slice(0, firstHeading === -1 ? Math.min(lines.length, 5) : firstHeading);

  const contact = top.join(" | ");
  profile.email = contact.match(EMAIL)?.[0] ?? "";
  profile.phone = contact.replace(EMAIL, "").match(PHONE)?.[1]?.trim() ?? "";
  profile.links = textLinks(contact);
  const plain = top.filter((l) => !EMAIL.test(l) && !PHONE.test(l) && !l.match(LINK));
  profile.name = plain[0] ?? "";
  profile.headline = plain[1] && plain[1].length < 80 ? plain[1] : "";
  const locationPart = contact
    .split(/\s*\|\s*/)
    .find((p) => !EMAIL.test(p) && !PHONE.test(p) && !p.match(LINK) && p !== profile.name && p !== profile.headline && /[A-Za-z]/.test(p) && p.length < 60);
  profile.location = locationPart ?? "";

  const sections = new Map<keyof typeof HEADINGS, string[]>();
  let currentSection: keyof typeof HEADINGS | null = null;
  for (const line of lines.slice(firstHeading === -1 ? lines.length : firstHeading)) {
    const h = headingOf(line);
    if (h) {
      currentSection = h;
      sections.set(h, sections.get(h) ?? []);
      continue;
    }
    if (currentSection) sections.get(currentSection)!.push(line);
  }

  profile.summary = (sections.get("summary") ?? []).map(stripBullet).join(" ");
  profile.experience = parseExperience(sections.get("experience") ?? []);
  profile.education = parseEducation(sections.get("education") ?? []);
  profile.skills = parseList(sections.get("skills") ?? []);
  profile.certifications = (sections.get("certifications") ?? []).reduce<string[]>((all, line) => {
    if (BULLET.test(line) || !all.length) all.push(stripBullet(line));
    else all[all.length - 1] += ` ${line}`;
    return all;
  }, []);
  const languageLines = (sections.get("languages") ?? []).join(", ");
  profile.languages = languageLines.split(/[,;|·]|\s+(?=[\p{L}]+:)/u).map(stripBullet).filter(Boolean);
  profile.projects = parseProjects(sections.get("projects") ?? []);
  return profile;
}
