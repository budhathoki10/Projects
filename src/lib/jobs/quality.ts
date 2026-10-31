import type { JobPost } from "@/lib/model/types";

export function jobHasCriteria(post: JobPost): boolean {
  return post.requirements.some((r) => r.text.trim()) || post.keywords.length >= 3;
}

export function isJobSearchPage(text: string): boolean {
  return /sign in to create job alert|you.re now using AI-powered job search|\d[\d,.+]*\+?\s+[^\n]{0,50}\bjobs in\b/i.test(text);
}
