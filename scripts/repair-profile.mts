import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { cvFileToText } from "../src/lib/cv/extract-text";
import { heuristicProfile } from "../src/lib/cv/heuristic";
import { ProfileSchema } from "../src/lib/cv/profile-schema";
import { CV_READER_VERSION, profileNeedsRepair } from "../src/lib/cv/quality";
import { scoreMatch } from "../src/lib/match/score";
import { jobHasCriteria } from "../src/lib/jobs/quality";

const [email, sourceFile, mode] = process.argv.slice(2);
if (!email || !sourceFile) throw new Error("Usage: node --env-file=.env --conditions=react-server --import tsx scripts/repair-profile.mts <account-email> <original-cv.pdf> [--apply]");
const sourceText = await cvFileToText({ name: sourceFile, type: "application/pdf", bytes: await readFile(sourceFile) });
const recovered = heuristicProfile(sourceText);
if (recovered.email.toLowerCase() !== email.toLowerCase()) throw new Error("The source CV email does not match the target account");
ProfileSchema.parse(recovered);
if (profileNeedsRepair(recovered) || !recovered.projects.length || recovered.projects.some((p) => !p.link || !p.bullets.length)) throw new Error("Source extraction needs manual review; no data changed");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "shortlist");
  const user = await db.collection("users").findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } });
  if (!user) throw new Error("Account not found");
  const filter = { _id: String(user._id) };
  const profiles = db.collection<{ _id: string; data: typeof recovered; updatedAt: Date }>("profiles");
  const existing = await profiles.findOne(filter);
  if (!existing || !profileNeedsRepair(existing.data)) throw new Error("The saved profile is not a legacy fragmented import; no data changed");
  for (const key of ["name", "headline", "email", "phone", "location", "summary"] as const) if (!recovered[key]) recovered[key] = existing.data[key];
  console.log(JSON.stringify({ mode: mode === "--apply" ? "apply" : "preview", before: { projects: existing.data.projects.length, education: existing.data.education.length }, after: { projects: recovered.projects.length, education: recovered.education.length, links: recovered.projects.map((p) => ({ title: p.name, url: p.link })) } }, null, 2));
  if (mode === "--apply") {
    const result = await profiles.updateOne({ ...filter, updatedAt: existing.updatedAt }, { $set: { data: recovered, previousData: existing.data, sourceText, readerVersion: CV_READER_VERSION, updatedAt: new Date() } });
    if (result.modifiedCount !== 1) throw new Error("Profile changed during review; repair was not applied");
    const jobs = await db.collection("jobs").find({ userId: String(user._id) }).toArray();
    for (const job of jobs) await db.collection("jobs").updateOne({ _id: job._id, userId: String(user._id) }, { $set: { match: jobHasCriteria(job.post) ? scoreMatch(recovered, job.post) : null } });
    await db.collection("documents").updateMany({ userId: String(user._id) }, { $set: { sourceNeedsReview: true } });
    await db.collection("interviews").updateMany({ userId: String(user._id) }, { $set: { sourceNeedsReview: true } });
    console.log("Repaired one profile, retained previousData backup, refreshed match data, and marked existing drafts for review.");
  }
} finally { await client.close(); }
