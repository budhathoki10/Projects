import "server-only";
import { FetchBlockedError, safeFetch } from "@/lib/safe-fetch";
import { cleanText } from "@/lib/text";
import { htmlToText, jobPostingFromHtml } from "./html";

export type FetchedPost = { ok: true; text: string; url: string } | { ok: false; reason: "blocked" | "unreachable" | "login" | "too_short" };

/** Sites that only show job posts to signed-in users. We don't log in anywhere on anyone's behalf. */
const LOGIN_WALLS = /(^|\.)linkedin\.com$|(^|\.)glassdoor\.[a-z.]+$/i;

export async function fetchJobPost(input: string): Promise<FetchedPost> {
  let res;
  try {
    res = await safeFetch(input, 12_000);
  } catch (err) {
    return { ok: false, reason: err instanceof FetchBlockedError || err instanceof TypeError ? "blocked" : "unreachable" };
  }
  const host = new URL(res.finalUrl).hostname;
  if (res.status === 401 || res.status === 403 || res.status === 999 || res.status === 429) {
    return { ok: false, reason: LOGIN_WALLS.test(host) ? "login" : "blocked" };
  }
  if (res.status >= 400) return { ok: false, reason: "unreachable" };
  const text = cleanText(jobPostingFromHtml(res.body) ?? htmlToText(res.body));
  if (text.length < 200) return { ok: false, reason: LOGIN_WALLS.test(host) ? "login" : "too_short" };
  return { ok: true, text: text.slice(0, 40_000), url: res.finalUrl };
}
