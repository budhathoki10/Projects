"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { cvFileToText, MAX_CV_BYTES, UnreadableFileError } from "@/lib/cv/extract-text";
import { parseCv } from "@/lib/cv/parse";
import { ProfileSchema, profileError } from "@/lib/cv/profile-schema";
import { profileNeedsRepair } from "@/lib/cv/quality";
import { originalCvFile } from "@/lib/cv/original";
import type { Profile } from "@/lib/model/types";
import { rescoreAll } from "@/lib/services/jobs";
import { getProfile, saveProfile } from "@/lib/services/profile";
import { discardCvImport, getCvImport, stageCvImport } from "@/lib/services/cv-imports";
import { refundAllowance, spendAllowance } from "@/lib/services/usage";
import { cleanText, localId } from "@/lib/text";
import { withSkillEvidence } from "@/lib/cv/skill-evidence";

export type ProfileState = { error?: string; success?: string; preview?: Profile; method?: "ai" | "basic"; source?: string; importId?: string; originalType?: string } | undefined;

/** Extract a draft for review. The saved profile stays in place until the user confirms. */
export async function importCv(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const file = formData.get("file");
  const pasted = cleanText(String(formData.get("text") ?? ""));
  let text = pasted;
  let bytes: Uint8Array | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CV_BYTES) return { error: "This file exceeds the 5 MB limit. Upload a smaller file, or paste your CV text." };
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      text = await cvFileToText({ name: file.name, type: file.type, bytes });
    } catch (err) {
      return { error: err instanceof UnreadableFileError ? err.message : "Unable to read this file. Try another file, or paste your CV text." };
    }
  }
  if (text.length < 80) return { error: "Upload your CV, or paste at least a few lines of it." };
  if (!(await spendAllowance(user, "import"))) return { error: "You’ve reached your monthly CV import limit. You can still edit your saved profile below." };

  const { profile, method } = await parseCv(text).catch(async (err) => {
    await refundAllowance(user.id, "import");
    throw err;
  });
  if (!profile.email) profile.email = user.email;
  if (!profile.name) profile.name = user.name;
  const original = bytes && file instanceof File ? originalCvFile(file.name, file.type, bytes, profile) : null;
  const importId = await stageCvImport(user.id, { profile, method, sourceText: text, original });
  return { preview: profile, method, source: text, importId, originalType: original?.type };
}

export async function confirmCvImport(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const pending = await getCvImport(user.id, String(formData.get("importId") ?? ""));
  if (!pending) return { error: "This review has expired or was replaced by a newer upload. Read your CV again; your saved profile is unchanged." };
  const parsed = ProfileSchema.safeParse(pending.profile);
  if (!parsed.success) return { error: profileError(parsed.error.issues) };
  const profile = parsed.data;
  if (profileNeedsRepair(profile)) return { error: "Some project descriptions were read as titles. Re-upload the original CV so we can recover its sections and hidden URLs." };
  if (!profile.experience.length && !profile.projects.length && !profile.education.length) {
    return { error: "No experience, projects or education were recognised. Try pasting the CV text, or fill in your profile below. Your existing profile is unchanged." };
  }
  await saveProfile(user.id, profile, pending.sourceText, pending.original);
  await discardCvImport(user.id, pending._id);
  await rescoreAll(user.id, profile);
  revalidatePath("/app", "layout");
  // A redirect, because the import form moves once a profile exists and would lose its message.
  redirect(`/app/profile?imported=${pending.method}&at=${Date.now()}`);
}

/** Save the edited profile. Empty rows and bullets are dropped, and entries keep stable ids. */
export async function updateProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("profile") ?? "{}"));
  } catch {
    return { error: "Unable to read your profile changes. Copy any unsaved text before refreshing this page, then try again." };
  }
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: profileError(parsed.error.issues) };
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
  return { success: "Profile saved. Your job matches have been updated. New application documents will use this version." };
}

/**
 * "I have this": the candidate confirms a skill the job asks for and, optionally, says where they used it
 * in their own words. Only what they typed is saved: the skill joins the skills list, and the sentence
 * becomes a bullet under the role they picked. Nothing is generated, so nothing can be invented.
 */
export async function addSkillEvidence(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) return { error: "Add your CV first." };
  const result = withSkillEvidence(profile, {
    skill: cleanText(String(formData.get("skill") ?? "")),
    experienceId: String(formData.get("experienceId") ?? ""),
    sentence: cleanText(String(formData.get("sentence") ?? "")),
  });
  if ("error" in result) return { error: result.error };
  await saveProfile(user.id, result.profile);
  await rescoreAll(user.id, result.profile);
  revalidatePath("/app", "layout");
  return { success: "Added to your CV. Suggest changes again to use it." };
}

/** Download everything we hold in the profile, as JSON. */
export async function profileJson(): Promise<string> {
  const user = await requireUser();
  return JSON.stringify((await getProfile(user.id)) ?? {}, null, 2);
}
