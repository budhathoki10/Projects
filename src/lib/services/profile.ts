import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/lib/model/types";

export async function getProfileRow(userId: string) {
  const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
  return row ?? null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  return (await getProfileRow(userId))?.data ?? null;
}

export async function saveProfile(userId: string, data: Profile) {
  await db
    .insert(schema.profiles)
    .values({ userId, data })
    .onConflictDoUpdate({ target: schema.profiles.userId, set: { data, updatedAt: new Date() } });
}

/** True once the profile has enough to tailor from: a name and at least one role, project or education entry. */
export function profileReady(p: Profile | null): p is Profile {
  return !!p && !!p.name.trim() && p.experience.length + p.projects.length + p.education.length > 0;
}
