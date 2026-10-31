/**
 * Records the word each link sat on ("LinkedIn", "Live") for profiles imported before link words were kept,
 * by re-reading their stored original file. Only display labels are added; no CV content changes.
 *
 *   node --env-file=.env --conditions=react-server --import tsx scripts/backfill-link-labels.mts          (dry run)
 *   node --env-file=.env --conditions=react-server --import tsx scripts/backfill-link-labels.mts --apply
 */
import { MongoClient } from "mongodb";
import { readCvFile } from "../src/lib/cv/extract-text";
import { originalBytes } from "../src/lib/cv/original";
import type { OriginalCvFile } from "../src/db/types";
import type { Profile } from "../src/lib/model/types";

const apply = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const profiles = client.db(process.env.MONGODB_DB).collection<{ _id: string; data: Profile; original?: OriginalCvFile }>("profiles");
let updated = 0;
for (const row of await profiles.find({ original: { $exists: true }, "data.linkLabels": { $exists: false } }).toArray()) {
  const { linkLabels } = await readCvFile({ name: row.original!.name, type: row.original!.type, bytes: new Uint8Array(originalBytes(row.original!)) });
  if (!Object.keys(linkLabels).length) continue;
  console.log(`${apply ? "updating" : "would update"} a profile:`, Object.fromEntries(Object.entries(linkLabels).map(([url, label]) => [url.replace(/^https?:\/\//, "").slice(0, 50), label])));
  if (apply) await profiles.updateOne({ _id: row._id }, { $set: { "data.linkLabels": linkLabels } });
  updated++;
}
console.log(`${updated} profile(s) ${apply ? "updated" : "to update (dry run; add --apply)"}`);
await client.close();
