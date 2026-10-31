/** Only ordinary web links can be rendered or exported as clickable CV links. */
export function webUrl(value: string): string | null {
  const clean = value.trim().replace(/[),.;]+$/, "");
  if (!clean || /[\s<>\u0000-\u001f]/.test(clean)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".") || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function textLinks(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s<>]+|(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com)\/[^\s<>]+/gi) ?? [])
    .map((s) => webUrl(s)).filter((s): s is string => !!s))];
}

export function linkLabel(value: string): string {
  const url = webUrl(value);
  if (!url) return value;
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "linkedin.com") return "LinkedIn";
  if (host === "github.com") return "GitHub";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** A web address without "https://", "www." or a trailing slash: "linkedin.com/in/asha". */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

/**
 * The word a link sat on in the original CV ("LinkedIn", "Live", "Certificate"), so a redesigned CV
 * links the same word. Null when none was recorded, and then the short address is shown instead.
 */
export function labelFor(value: string, labels?: Record<string, string>): string | null {
  const url = webUrl(value);
  return (url && labels?.[url]) || null;
}

export type LinkPart = { text: string; url?: string };

/**
 * Text that carries addresses in brackets, as an import records them: "Herald College Certificate (https://…)".
 * The address becomes a link on the word it sat on in the original ("Certificate"), or a short address.
 */
export function linkParts(text: string, labels?: Record<string, string>): LinkPart[] {
  const parts: LinkPart[] = [];
  let rest = 0;
  for (const m of text.matchAll(/\s*\((https?:\/\/[^\s)]+)\)/g)) {
    const url = webUrl(m[1]);
    if (!url) continue;
    let before = text.slice(rest, m.index);
    const label = labelFor(url, labels);
    if (label && before.trimEnd().endsWith(label)) {
      before = before.trimEnd().slice(0, -label.length);
      if (before) parts.push({ text: before });
      parts.push({ text: label, url });
    } else {
      if (before) parts.push({ text: `${before} ` });
      parts.push({ text: shortUrl(url), url });
    }
    rest = m.index + m[0].length;
  }
  if (rest < text.length) parts.push({ text: text.slice(rest) });
  return parts.length ? parts : [{ text }];
}

/** Keeps a link's word only when it's a short label, not the address itself or a whole sentence. */
export function cleanLinkLabel(raw: string): string | null {
  const label = raw.replace(/\s+/g, " ").replace(/^[\s|·•,–—-]+|[\s|·•,–—-]+$/g, "").trim();
  if (!label || label.length > 40 || label.split(" ").length > 4) return null;
  if (/:\/\/|^www\.|^[^\s]+\.[a-z]{2,}(\/|$)/i.test(label) || label.includes("@")) return null;
  return label;
}
