import "server-only";
import { randomUUID } from "node:crypto";
import { collections, fromDoc, isDuplicateKey } from "@/db/mongo";
import type { User } from "@/db/types";

export async function findUserByEmail(email: string): Promise<User | null> {
  const doc = await (await collections()).users.findOne({ email: String(email) });
  return doc ? fromDoc<User>(doc) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const doc = await (await collections()).users.findOne({ _id: String(id) });
  return doc ? fromDoc<User>(doc) : null;
}

/** Create an account. Returns null when the email is already taken (the unique index decides, so two sign-ups at once can't both win). */
export async function createUser(input: { name: string; email: string; passwordHash: string }): Promise<User | null> {
  const user: User = { id: randomUUID(), emailVerifiedAt: null, createdAt: new Date(), ...input };
  const { id, ...rest } = user;
  try {
    await (await collections()).users.insertOne({ _id: id, ...rest });
  } catch (err) {
    if (isDuplicateKey(err)) return null;
    throw err;
  }
  return user;
}

export async function setPasswordHash(userId: string, passwordHash: string) {
  await (await collections()).users.updateOne({ _id: String(userId) }, { $set: { passwordHash } });
}
