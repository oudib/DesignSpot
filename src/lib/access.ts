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

/** The signed-in user's id + admin flag, or null when signed out. */
export async function currentActor(): Promise<{
  userId: string;
  isAdmin: boolean;
} | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  return { userId: session.userId, isAdmin: user?.role === "admin" };
}

/**
 * Can this actor edit/delete a design or ticket tied to `flowId`? Admins
 * always can; otherwise only a designer already assigned to a ticket on that
 * flow — "responsible for the flow". Tickets with no flow fall back to
 * `fallbackAssigneeId` (the ticket's own assignee), since there's no flow
 * group to belong to. Does one query — fine for single-item pages/actions;
 * pages that already loaded every ticket should use canManageWithMap instead.
 */
export async function canManageFlow(
  actor: { userId: string; isAdmin: boolean } | null,
  flowId: string | null,
  fallbackAssigneeId?: string | null
): Promise<boolean> {
  if (!actor) return false;
  if (actor.isAdmin) return true;
  if (flowId) {
    const tickets = await prisma.ticket.findMany({
      where: { flowId, NOT: { assigneeId: null } },
      select: { assigneeId: true },
    });
    return tickets.some((t) => t.assigneeId === actor.userId);
  }
  return !!fallbackAssigneeId && fallbackAssigneeId === actor.userId;
}
