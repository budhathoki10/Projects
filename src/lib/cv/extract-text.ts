import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { cleanText } from "@/lib/text";

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export class UnreadableFileError extends Error {}

/** Plain text from an uploaded CV. Scanned PDFs (images only) have no text to read. */
export async function cvFileToText(file: { name: string; type: string; bytes: Uint8Array }): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";
  try {
    if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) })).value;
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      text = new TextDecoder().decode(file.bytes);
    } else {
      throw new UnreadableFileError("Upload a PDF, Word (.docx) or text file.");
    }
  } catch (err) {
    if (err instanceof UnreadableFileError) throw err;
    throw new UnreadableFileError("We couldn't read that file. Try saving it as a PDF again, or paste the text instead.");
  }
  const clean = cleanText(text);
  if (clean.length < 80) {
    throw new UnreadableFileError("That file has almost no text we can read (it may be a scanned image). Paste your CV text instead.");
  }
  return clean;
}
