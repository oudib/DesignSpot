import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * The signed-in user's role, read fresh from the DB — never from the JWT.
 * Access changes made in the admin dashboard apply immediately this way,
 * instead of lingering in a stale session token for up to 7 days.
 */
export async function currentRole(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  return user?.role ?? null;
}

/** Emails from ADMIN_EMAILS (comma-separated) are promoted to admin on login. */
export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
