import "server-only";
import mammoth from "mammoth";
import { getDocumentProxy } from "unpdf";
import { cleanText } from "@/lib/text";
import { decodeEntities, htmlToText } from "@/lib/jobs/html";
import { webUrl } from "./links";

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export class UnreadableFileError extends Error {}

/** Plain text from an uploaded CV. Scanned PDFs (images only) have no text to read. */
export async function cvFileToText(file: { name: string; type: string; bytes: Uint8Array }): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";
  try {
    if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
      try {
        const pages: string[] = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          const items = content.items.filter((item) => "str" in item);
          const linksAt = new Map<number, string[]>();
          for (const annotation of await page.getAnnotations()) {
            const url = annotation.subtype === "Link" && annotation.url ? webUrl(annotation.url) : null;
            if (!url || !annotation.rect) continue;
            const [x1, y1, x2, y2] = annotation.rect;
            // Link annotations are separate from visible text. Attach the URI to its actual
            // label/line, so three different "Live" labels keep the correct project URL.
            let last = -1;
            items.forEach((item, i) => {
              const x = item.transform[4], y = item.transform[5];
              if (item.str.trim() && x < x2 + 2 && x + item.width > x1 - 2 && y >= y1 - 3 && y <= y2 + 3) last = i;
            });
            if (last >= 0) linksAt.set(last, [...(linksAt.get(last) ?? []), url]);
          }
          pages.push(items.map((item, i) => `${item.str}${(linksAt.get(i) ?? []).map((url) => ` (${url})`).join("")}${item.hasEOL ? "\n" : ""}`).join(""));
        }
        text = pages.join("\n");
      } finally {
        await pdf.loadingTask.destroy();
      }
    } else if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const html = (await mammoth.convertToHtml({ buffer: Buffer.from(file.bytes) })).value;
      text = htmlToText(html.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
        const url = webUrl(decodeEntities(href));
        return `${label}${url ? ` (${url})` : ""}`;
      }));
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      text = new TextDecoder().decode(file.bytes);
    } else {
      throw new UnreadableFileError("Upload a PDF, Word (.docx) or text file.");
    }
  } catch (err) {
    if (err instanceof UnreadableFileError) throw err;
    throw new UnreadableFileError("Unable to read this file. Export a new PDF, or paste your CV text instead.");
  }
  const clean = cleanText(text);
  if (clean.length < 80) {
    throw new UnreadableFileError("No readable CV text was found. This may be a scanned document. Upload a text-based PDF, or paste your CV text instead.");
  }
  return clean;
}
