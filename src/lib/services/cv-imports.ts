import "server-only";
import { randomUUID } from "node:crypto";
import { collections } from "@/db/mongo";
import type { CvImportDoc } from "@/db/types";

/** Keep uploaded bytes on the server while the user reviews extraction. Never send them in a hidden form. */
export async function stageCvImport(userId: string, input: Pick<CvImportDoc, "profile" | "sourceText" | "method" | "original">) {
  const c = await collections();
  // One pending review per account bounds storage even when the review is abandoned.
  await c.cvImports.deleteMany({ userId: String(userId) });
  const row: CvImportDoc = { _id: randomUUID(), userId: String(userId), ...input, expiresAt: new Date(Date.now() + 60 * 60_000) };
  await c.cvImports.insertOne(row);
  return row._id;
}

export async function getCvImport(userId: string, id: string) {
  return (await collections()).cvImports.findOne({ _id: id, userId: String(userId), expiresAt: { $gt: new Date() } });
}

export async function discardCvImport(userId: string, id: string) {
  await (await collections()).cvImports.deleteOne({ _id: id, userId: String(userId) });
}
