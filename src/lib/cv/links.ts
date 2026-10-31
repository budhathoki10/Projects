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
