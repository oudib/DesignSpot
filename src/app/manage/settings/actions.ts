"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, hasWorkspaceAccess } from "@/lib/auth";
import { generateApiKey } from "@/lib/apiKeys";

async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login?from=/manage/settings");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!hasWorkspaceAccess(user?.role)) redirect("/");
  return session;
}

export type CreateKeyResult =
  | { ok: true; key: string; name: string }
  | { ok: false; message: string };

/**
 * Mint a personal API key. The plaintext is returned ONCE through the action
 * state so the settings page can show it; only its hash is stored.
 */
export async function createApiKey(
  _prev: CreateKeyResult | null,
  fd: FormData
): Promise<CreateKeyResult> {
  const session = await requireAuth();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, message: "Give the key a name first (e.g. “Claude”)." };
  const { key, prefix, hash } = generateApiKey();
  await prisma.apiKey.create({
    data: { name, prefix, hash, userId: session.userId },
  });
  revalidatePath("/manage/settings");
  return { ok: true, key, name };
}

/** Revoke one of the caller's own keys. Requests with it fail from now on. */
export async function revokeApiKey(fd: FormData) {
  const session = await requireAuth();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await prisma.apiKey.updateMany({
    where: { id, userId: session.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/manage/settings");
}

/** Remove a revoked key from the list for good. */
export async function deleteApiKey(fd: FormData) {
  const session = await requireAuth();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  await prisma.apiKey.deleteMany({ where: { id, userId: session.userId } });
  revalidatePath("/manage/settings");
}
