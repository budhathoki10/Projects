import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { cleanText } from "@/lib/text";

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export class UnreadableFileError extends Error {}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);
const isPdf = (bytes: Uint8Array) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
const isZip = (bytes: Uint8Array) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // PK.. (DOCX is a zip)

/**
 * Plain text from an uploaded CV. The file's own bytes decide how it's read, not its name or the
 * type the browser claims. Scanned PDFs (images only) have no text to read.
 */
export async function cvFileToText(file: { name: string; type: string; bytes: Uint8Array }): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";
  try {
    if (isPdf(file.bytes)) {
      const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (isZip(file.bytes) && (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) })).value;
    } else if ((name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) && !file.bytes.includes(0)) {
      text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
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
