import { requireUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/services/account";

/** Everything stored about the user, as JSON (right of access and portability). */
export async function GET() {
  const user = await requireUser();
  return new Response(JSON.stringify(await exportUserData(user), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="shortlist-data.json"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
