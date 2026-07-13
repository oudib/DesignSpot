"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { currentRole } from "@/lib/access";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login?from=/manage/prompt-builder");
  if ((await currentRole()) !== "admin") redirect("/manage");
  return session;
}

/** Save (or overwrite) a designer's custom "Generate a prompt" template. */
export async function savePromptTemplate(fd: FormData) {
  await requireAdmin();
  const userId = String(fd.get("userId") ?? "");
  const body = String(fd.get("body") ?? "");
  if (!userId || !body.trim()) return;

  await prisma.promptTemplate.upsert({
    where: { userId },
    create: { userId, body },
    update: { body },
  });
  revalidatePath("/manage/prompt-builder");
}

/** Remove a designer's override so they fall back to the built-in default. */
export async function resetPromptTemplate(fd: FormData) {
  await requireAdmin();
  const userId = String(fd.get("userId") ?? "");
  if (!userId) return;

  await prisma.promptTemplate.deleteMany({ where: { userId } });
  revalidatePath("/manage/prompt-builder");
}

/** Save (or overwrite) a solution's custom "Generate a prompt" template. */
export async function saveSolutionPromptTemplate(fd: FormData) {
  await requireAdmin();
  const solutionId = String(fd.get("solutionId") ?? "");
  const body = String(fd.get("body") ?? "");
  if (!solutionId || !body.trim()) return;

  await prisma.solution.update({
    where: { id: solutionId },
    data: { promptTemplate: body },
  });
  revalidatePath("/manage/prompt-builder");
}

/** Clear a solution's override so its tickets fall back to the default (or
 * their assigned designer's own override, if they have one). */
export async function resetSolutionPromptTemplate(fd: FormData) {
  await requireAdmin();
  const solutionId = String(fd.get("solutionId") ?? "");
  if (!solutionId) return;

  await prisma.solution.update({
    where: { id: solutionId },
    data: { promptTemplate: null },
  });
  revalidatePath("/manage/prompt-builder");
}
