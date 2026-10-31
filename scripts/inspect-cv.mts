import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cvFileToText } from "../src/lib/cv/extract-text";
import { heuristicProfile } from "../src/lib/cv/heuristic";
import { ProfileSchema } from "../src/lib/cv/profile-schema";
import { cvPdfBuffer } from "../src/lib/export/pdf";
import { presentCv } from "../src/lib/cv/presentation";

// Read-only against application data; outputs stay in ignored review directories.
const input = process.argv[2];
if (!input) throw new Error("Usage: node --conditions=react-server --import tsx scripts/inspect-cv.mts <cv.pdf>");
const text = await cvFileToText({ name: path.basename(input), type: "application/pdf", bytes: await readFile(input) });
const profile = heuristicProfile(text);
const parsed = ProfileSchema.safeParse(profile);
if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
const output = path.resolve("tmp/cv-audit");
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "profile.json"), JSON.stringify(profile, null, 2));
await writeFile(path.join(output, "source.txt"), text);
const pdfOutput = path.resolve("output/pdf/cv-review.pdf");
await mkdir(path.dirname(pdfOutput), { recursive: true });
await writeFile(pdfOutput, await cvPdfBuffer(presentCv(profile)));
console.log(JSON.stringify({ output, roles: profile.experience.length, projects: profile.projects.length, education: profile.education.length, skills: profile.skills.length, links: profile.links, projectLinks: profile.projects.map((p) => ({ name: p.name, link: p.link })), languages: profile.languages }, null, 2));
