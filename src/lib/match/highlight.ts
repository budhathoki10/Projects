import type { KeywordHit } from "@/lib/model/types";
import { spellings } from "@/lib/text";

export type Segment = { text: string; mark: KeywordHit["where"] | null };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Split text into runs, marking each place a job keyword appears and whether the user has it. */
export function highlight(text: string, hits: KeywordHit[]): Segment[] {
  const terms = hits
    .flatMap((h) => spellings(h.keyword).map((s) => ({ s, where: h.where })))
    .filter((t) => t.s.length > 1)
    .sort((a, b) => b.s.length - a.s.length);
  if (terms.length === 0) return [{ text, mark: null }];
  const re = new RegExp(`(?<![a-z0-9+#])(${terms.map((t) => escape(t.s)).join("|")})(?![a-z0-9+#])`, "gi");
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), mark: null });
    out.push({ text: m[0], mark: terms.find((t) => t.s === m[0].toLowerCase())?.where ?? null });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mark: null });
  return out;
}
