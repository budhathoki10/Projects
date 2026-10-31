import { requireUser } from "@/lib/auth/session";
import { getPhoto } from "@/lib/services/photos";

/** The signed-in user's own profile photo. Nobody else's is reachable. */
export async function GET() {
  const user = await requireUser();
  const photo = await getPhoto(user.id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.image), {
    headers: {
      "content-type": "image/webp",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "content-disposition": "inline",
    },
  });
}
