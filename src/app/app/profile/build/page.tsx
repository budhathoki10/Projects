import type { Metadata } from "next";
import { CvBuilder } from "@/components/cv-builder/builder";
import { requireUser } from "@/lib/auth/session";
import { firstIncompleteStep } from "@/lib/cv/builder";
import { EMPTY_PROFILE } from "@/lib/model/types";
import { photoUrl } from "@/lib/services/photos";
import { getProfile } from "@/lib/services/profile";
import { resolveCvStyle } from "@/lib/services/templates";

export const metadata: Metadata = { title: "Build your CV" };

export default async function BuildCv() {
  const user = await requireUser();
  const [profile, style, photo] = await Promise.all([getProfile(user.id), resolveCvStyle(user.id), photoUrl(user.id)]);
  return (
    <CvBuilder
      initial={profile ?? { ...EMPTY_PROFILE, name: user.name, email: user.email }}
      startStep={firstIncompleteStep(profile)}
      defaultSpec={style.spec}
      photoUrl={photo}
    />
  );
}
