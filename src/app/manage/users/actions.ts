"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { currentRole } from "@/lib/access";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login?from=/manage/users");
  if ((await currentRole()) !== "admin") redirect("/manage");
  return session;
}

/** Grant or revoke workspace access by flipping a user between designer/viewer. */
export async function setWorkspaceAccess(fd: FormData) {
  const session = await requireAdmin();
  const userId = String(fd.get("userId") ?? "");
  const grant = fd.get("grant") === "1";

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;
  // Admins always have access; they're managed via ADMIN_EMAILS, and an admin
  // can't accidentally demote themselves out of this page.
  if (target.role === "admin" || target.id === session.userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role: grant ? "designer" : "viewer" },
  });
  revalidatePath("/manage/users");
}
