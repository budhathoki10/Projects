import { readFile } from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";
import type { ProfileDoc } from "../src/db/types";
import { cvFileToText, MAX_CV_BYTES } from "../src/lib/cv/extract-text";
import { heuristicProfile } from "../src/lib/cv/heuristic";
import { originalBytes, originalCvFile } from "../src/lib/cv/original";

// Restore a source file for an older import. Never changes the profile, its edits or its drafts.
const [email, sourceFile, mode] = process.argv.slice(2);
if (!email || !sourceFile) throw new Error("Usage: node --env-file=.env --conditions=react-server --import tsx scripts/attach-original-cv.mts <account-email> <original-cv.pdf> [--apply]");
const bytes = await readFile(sourceFile);
if (bytes.length > MAX_CV_BYTES || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Supply an original PDF up to 5 MB");
const text = await cvFileToText({ name: path.basename(sourceFile), type: "application/pdf", bytes });
const recovered = heuristicProfile(text);
if (recovered.email.toLowerCase() !== email.toLowerCase()) throw new Error("The CV email does not match the target account");
const original = originalCvFile(path.basename(sourceFile), "application/pdf", bytes, recovered);
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "shortlist");
  const user = await db.collection("users").findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } });
  if (!user) throw new Error("Account not found");
  const profiles = db.collection<ProfileDoc>("profiles");
  const filter = { _id: String(user._id) };
  const existing = await profiles.findOne(filter, { projection: { data: 1, "original.sha256": 1 } });
  if (!existing || existing.data.email.toLowerCase() !== email.toLowerCase()) throw new Error("Saved CV does not match target account");
  if (existing.original && existing.original.sha256 !== original.sha256) throw new Error("A different original already exists; replace it through the reviewed upload flow");
  console.log(JSON.stringify({ mode: mode === "--apply" ? "apply" : "preview", originalAlreadySaved: !!existing.original, filename: original.name, bytes: bytes.length, sha256: original.sha256 }));
  if (mode === "--apply") {
    const result = await profiles.updateOne({ ...filter, $or: [{ original: { $exists: false } }, { "original.sha256": original.sha256 }] }, { $set: { original } });
    if (result.matchedCount !== 1) throw new Error("The original changed during attachment; no replacement applied");
    const stored = await profiles.findOne(filter, { projection: { original: 1 } });
    if (!stored?.original || !originalBytes(stored.original).equals(bytes)) throw new Error("Stored file verification failed");
    console.log("Original PDF attached and verified byte-for-byte. Profile edits and application drafts preserved.");
  }
} finally { await client.close(); }
