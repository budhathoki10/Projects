import type { Profile } from "@/lib/model/types";

/**
 * The fact check: every number, name, tool, acronym or qualification in rewritten text must
 * already appear in the user's profile. Rewording is fine; new facts are not.
 */

/** Everything the profile says, as one lowercase string. */
export function profileCorpus(p: Profile): string {
  return [
    p.name,
    p.headline,
    p.location,
    p.summary,
    ...p.links,
    ...p.experience.flatMap((e) => [e.title, e.company, e.location, e.start, e.end, ...e.bullets]),
    ...p.education.flatMap((e) => [e.school, e.degree, e.start, e.end, ...e.details]),
    ...p.projects.flatMap((x) => [x.name, x.link, ...x.bullets]),
    ...p.skills,
    ...p.certifications,
    ...p.languages,
  ]
    .join("\n")
    .toLowerCase();
}

const QUALIFICATIONS =
  /\b(bachelor'?s?|master'?s?|ph\.?d|doctorate|mba|bba|bbs|bca|bim|bit|bsc|bsw|b\.?ed|bpharm|mbbs|bds|llb|llm|msc|mbs|mca|m\.?ed|ma|ba|b\.?tech|m\.?tech|b\.?e|degree|diploma|certified|certification|certificate|licensed|chartered|cpa|acca|cfa|pmp)\b/gi;

/** Capitalised words that are ordinary English at the start of a clause, or common in CVs. */
const ORDINARY = new Set(
  "i a an the and or but in on at to for with of by as from my our we led built created designed developed improved increased reduced managed delivered launched ran wrote owned shipped drove grew cut helped worked supported handled trained mentored coordinated organised organized planned analysed analyzed implemented maintained introduced automated streamlined resolved collaborated partnered prepared presented negotiated achieved over under more than".split(
    " ",
  ),
);

const GENERIC = /^(degree|diploma|certified|certification|certificate|licensed)$/i;

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/i;

function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.0+$/, "").replace(/\.$/, ""));
}

/**
 * Words that carry facts: anything with a digit or a symbol like + # . /, all-caps
 * acronyms, and capitalised words that aren't starting a sentence (names of employers,
 * products, places and tools).
 */
function factWords(s: string): string[] {
  const out: string[] = [];
  for (const sentence of s.split(/(?<=[.!?:;])\s+|\n+/)) {
    const words = sentence.match(/[A-Za-z0-9][A-Za-z0-9+#.&/'’-]*[A-Za-z0-9+#]|[A-Za-z0-9]/g) ?? [];
    words.forEach((raw, i) => {
      const w = raw.replace(/['’]s$/i, "");
      if (/^\d/.test(w)) return; // numbers are checked separately
      const lower = w.toLowerCase();
      if (ORDINARY.has(lower) || MONTHS.test(w) || /^i['’](m|d|ve|ll)$/i.test(w)) return;
      const technical = /[+#]|[a-z]\.[a-z]|\//i.test(w);
      const acronym = /^[A-Z0-9]{2,}$/.test(w);
      const properNoun = i > 0 && /^[A-Z]/.test(w);
      const camel = /[a-z][A-Z]/.test(w);
      if (technical || acronym || properNoun || camel) out.push(w);
    });
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function inCorpus(word: string, corpus: string): boolean {
  return new RegExp(`(^|[^a-z0-9+#])${escape(word.toLowerCase())}(?![a-z0-9+#])`).test(corpus);
}

/** Facts in `text` that the profile (plus any `extra` allowed text, like the job post for a cover letter) doesn't support. */
export function unsupportedFacts(text: string, profile: Profile, extra = ""): string[] {
  const corpus = `${profileCorpus(profile)}\n${extra.toLowerCase()}`;
  const corpusNumbers = new Set(numbersIn(corpus));
  const flags = new Set<string>();
  for (const n of numbersIn(text)) if (!corpusNumbers.has(n)) flags.add(n);
  for (const w of factWords(text)) if (!inCorpus(w, corpus)) flags.add(w);
  const hasAnyQualification =
    profile.education.length > 0 || profile.certifications.length > 0 || new RegExp(QUALIFICATIONS.source, "i").test(corpus);
  for (const q of text.match(QUALIFICATIONS) ?? []) {
    // "degree" or "certified" is fine if the profile names any qualification; "MBA" needs an MBA.
    if (GENERIC.test(q) ? hasAnyQualification : inCorpus(q.replace(/'s$/, ""), corpus)) continue;
    flags.add(q);
  }
  return [...flags];
}
