import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/db/indexes";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });
await client.connect();
await ensureIndexes(client.db(process.env.MONGODB_DB || "shortlist"));
await client.close();
console.log("Indexes are in place.");
