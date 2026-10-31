import { createHash } from "node:crypto";
import type { OriginalCvFile } from "@/db/types";
import type { Profile } from "@/lib/model/types";

/** IDs identify form rows, not facts. Changing them doesn't change the original's content. */
export function profileHash(profile: Profile) {
  return createHash("sha256").update(JSON.stringify(profile, (key, value) => {
    if (key === "id") return undefined;
    if (value && typeof value === "object" && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    return value;
  })).digest("hex");
}

export function originalCvFile(name: string, type: string, bytes: Uint8Array, profile: Profile): OriginalCvFile {
  const pdf = Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
  return {
    name: name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 200) || "original-cv",
    type: pdf ? "application/pdf" : type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(name) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain",
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    profileHash: profileHash(profile),
  };
}

/** Mongo returns BSON Binary in production and may return Uint8Array in tests. */
export function originalBytes(file: OriginalCvFile): Buffer {
  const raw = file.bytes as unknown as Uint8Array | { buffer: Uint8Array };
  return Buffer.from(raw instanceof Uint8Array ? raw : raw.buffer);
}

export function originalFileResponse(file: OriginalCvFile, inline = false) {
  return new Response(new Uint8Array(originalBytes(file)), { headers: {
    "content-type": file.type,
    "content-disposition": `${inline && file.type === "application/pdf" ? "inline" : "attachment"}; filename="original-cv.${file.type === "application/pdf" ? "pdf" : file.type === "text/plain" ? "txt" : "docx"}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  } });
}
