"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { cvFileToText, MAX_CV_BYTES, UnreadableFileError } from "@/lib/cv/extract-text";
import { parseCv } from "@/lib/cv/parse";
import type { Profile } from "@/lib/model/types";
import { rescoreAll } from "@/lib/services/jobs";
import { getProfile, saveProfile } from "@/lib/services/profile";
import { refundAllowance, spendAllowance } from "@/lib/services/usage";
import { cleanText, localId } from "@/lib/text";

export type ProfileState = { error?: string; success?: string } | undefined;

/** Read a CV (file or pasted text) into the profile, replacing what's there. */
export async function importCv(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const file = formData.get("file");
  const pasted = cleanText(String(formData.get("text") ?? ""));
  let text = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CV_BYTES) return { error: "That file is over 5 MB. Export a smaller PDF, or paste the text." };
    try {
      text = await cvFileToText({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    } catch (err) {
      return { error: err instanceof UnreadableFileError ? err.message : "We couldn't read that file." };
    }
  }
  if (text.length < 80) return { error: "Upload your CV, or paste at least a few lines of it." };
  if (!(await spendAllowance(user, "import"))) return { error: "You've imported a lot of CVs this month. Edit your profile below instead." };

  const { profile, method } = await parseCv(text).catch(async (err) => {
    await refundAllowance(user.id, "import");
    throw err;
  });
  if (!profile.email) profile.email = user.email;
  if (!profile.name) profile.name = user.name;
  await saveProfile(user.id, profile);
  await rescoreAll(user.id, profile);
  revalidatePath("/app", "layout");
  // A redirect, because the import form moves once a profile exists and would lose its message.
  redirect(`/app/profile?imported=${method}&at=${Date.now()}`);
}

const Str = (max: number) => z.string().trim().max(max);
const ProfileSchema = z.object({
  name: Str(120).min(1, "Add your name"),
  headline: Str(160),
  email: Str(200),
  phone: Str(60),
  location: Str(160),
  links: z.array(Str(300)).max(10),
  summary: Str(2000),
  experience: z
    .array(z.object({ id: Str(60), title: Str(160), company: Str(160), location: Str(160), start: Str(40), end: Str(40), bullets: z.array(Str(600)).max(20) }))
    .max(30),
  education: z.array(z.object({ id: Str(60), school: Str(200), degree: Str(200), start: Str(40), end: Str(40), details: z.array(Str(400)).max(10) })).max(15),
  skills: z.array(Str(80)).max(100),
  projects: z.array(z.object({ id: Str(60), name: Str(200), link: Str(300), bullets: z.array(Str(600)).max(10) })).max(20),
  certifications: z.array(Str(200)).max(30),
  languages: z.array(Str(80)).max(20),
});

/** Save the edited profile. Empty rows and bullets are dropped, and entries keep stable ids. */
export async function updateProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("profile") ?? "{}"));
  } catch {
    return { error: "Couldn't read the form. Reload and try again." };
  }
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;
  const nonEmpty = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  const profile: Profile = {
    ...p,
    links: nonEmpty(p.links),
    skills: [...new Set(nonEmpty(p.skills))],
    certifications: nonEmpty(p.certifications),
    languages: nonEmpty(p.languages),
    experience: p.experience
      .map((e) => ({ ...e, id: e.id || localId("x"), bullets: nonEmpty(e.bullets) }))
      .filter((e) => e.title || e.company || e.bullets.length),
    education: p.education.map((e) => ({ ...e, id: e.id || localId("e"), details: nonEmpty(e.details) })).filter((e) => e.school || e.degree),
    projects: p.projects.map((x) => ({ ...x, id: x.id || localId("p"), bullets: nonEmpty(x.bullets) })).filter((x) => x.name),
  };
  await saveProfile(user.id, profile);
  await rescoreAll(user.id, profile);
  revalidatePath("/app", "layout");
  return { success: "Saved. Your job matches are updated, and new tailored CVs will use this version." };
}

/** Download everything we hold in the profile, as JSON. */
export async function profileJson(): Promise<string> {
  const user = await requireUser();
  return JSON.stringify((await getProfile(user.id)) ?? {}, null, 2);
}
