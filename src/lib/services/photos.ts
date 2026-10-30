import "server-only";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, schema } from "@/db";

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const SIZE = 600;

export class PhotoError extends Error {}

const looksLikeImage = (b: Uint8Array) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // JPEG
  (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || // PNG
  (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50); // RIFF....WEBP

/**
 * Decode and re-encode to a square WebP. Re-encoding drops all metadata (EXIF, including GPS
 * location) and anything hidden after the image data. Files that don't decode are refused.
 */
export async function normalisePhoto(bytes: Uint8Array): Promise<Buffer> {
  if (bytes.length > MAX_PHOTO_BYTES) throw new PhotoError("That photo is over 3 MB. Try a smaller one.");
  if (!looksLikeImage(bytes)) throw new PhotoError("Upload a JPEG, PNG or WebP photo.");
  try {
    return await sharp(bytes, { limitInputPixels: 50_000_000 })
      .rotate() // respect the camera's orientation before the metadata is dropped
      .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new PhotoError("We couldn't read that image. Try another photo.");
  }
}

export async function savePhoto(userId: string, bytes: Uint8Array) {
  const image = await normalisePhoto(bytes);
  await db
    .insert(schema.profilePhotos)
    .values({ userId, image })
    .onConflictDoUpdate({ target: schema.profilePhotos.userId, set: { image, updatedAt: new Date() } });
}

export async function getPhoto(userId: string) {
  const [row] = await db.select().from(schema.profilePhotos).where(eq(schema.profilePhotos.userId, userId));
  return row ?? null;
}

/** The URL a CV uses for the photo, changing whenever the photo does so browsers don't show an old one. */
export async function photoUrl(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ updatedAt: schema.profilePhotos.updatedAt })
    .from(schema.profilePhotos)
    .where(eq(schema.profilePhotos.userId, userId));
  return row ? `/app/photo?v=${row.updatedAt.getTime()}` : null;
}

export async function deletePhoto(userId: string) {
  await db.delete(schema.profilePhotos).where(eq(schema.profilePhotos.userId, userId));
}
