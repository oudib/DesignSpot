// Create rows in the Solution → Module → Submodule → Flow hierarchy. Shared by
// the quick-create server actions (the ticket picker's inline "new …" inputs)
// and the /api/v1 routes, so an agent can file a ticket somewhere that doesn't
// exist yet without a human building the path first.

import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { badRequest } from "@/lib/errors";

const PALETTE = [
  "#1f47eb", "#0ea5a3", "#f97316", "#a855f7",
  "#e11d48", "#2563eb", "#059669", "#0f172a",
];

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const root = base || "item";
  let slug = root;
  let n = 2;
  while (await exists(slug)) slug = `${root}-${n++}`;
  return slug;
}

function cleanName(name: string | undefined, what: string) {
  const clean = (name ?? "").trim();
  if (!clean) throw badRequest(`${what} name is required.`);
  return clean;
}

export async function createSolution(input: {
  name?: string;
  tagline?: string;
  description?: string;
  color?: string;
  icon?: string;
  language?: string;
}) {
  const name = cleanName(input.name, "Solution");
  const count = await prisma.solution.count();
  const slug = await uniqueSlug(
    slugify(name),
    async (sl) => !!(await prisma.solution.findUnique({ where: { slug: sl } }))
  );
  return prisma.solution.create({
    data: {
      name,
      slug,
      tagline: input.tagline?.trim() ?? "",
      description: input.description?.trim() ?? "",
      color: input.color?.trim() || PALETTE[count % PALETTE.length],
      icon: input.icon?.trim() || "✦",
      language: input.language?.trim() || "en",
      order: count,
    },
  });
}

export async function createModule(input: { solutionId?: string; name?: string }) {
  const name = cleanName(input.name, "Module");
  const solutionId = (input.solutionId ?? "").trim();
  if (!solutionId) throw badRequest("solutionId is required (see GET /api/v1/structure).");
  const solution = await prisma.solution.findUnique({ where: { id: solutionId }, select: { id: true } });
  if (!solution) throw badRequest(`No solution with id "${solutionId}".`);
  const count = await prisma.module.count({ where: { solutionId } });
  const slug = await uniqueSlug(
    slugify(name),
    async (sl) =>
      !!(await prisma.module.findUnique({ where: { solutionId_slug: { solutionId, slug: sl } } }))
  );
  return prisma.module.create({ data: { name, slug, solutionId, order: count } });
}

export async function createSubmodule(input: { moduleId?: string; name?: string }) {
  const name = cleanName(input.name, "Submodule");
  const moduleId = (input.moduleId ?? "").trim();
  if (!moduleId) throw badRequest("moduleId is required (see GET /api/v1/structure).");
  const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } });
  if (!mod) throw badRequest(`No module with id "${moduleId}".`);
  const count = await prisma.submodule.count({ where: { moduleId } });
  const slug = await uniqueSlug(
    slugify(name),
    async (sl) =>
      !!(await prisma.submodule.findUnique({ where: { moduleId_slug: { moduleId, slug: sl } } }))
  );
  return prisma.submodule.create({ data: { name, slug, moduleId, order: count } });
}

export async function createFlow(input: {
  submoduleId?: string;
  name?: string;
  description?: string;
}) {
  const name = cleanName(input.name, "Flow");
  const submoduleId = (input.submoduleId ?? "").trim();
  if (!submoduleId) throw badRequest("submoduleId is required (see GET /api/v1/structure).");
  const sub = await prisma.submodule.findUnique({ where: { id: submoduleId }, select: { id: true } });
  if (!sub) throw badRequest(`No submodule with id "${submoduleId}".`);
  const count = await prisma.flow.count({ where: { submoduleId } });
  return prisma.flow.create({
    data: { name, description: input.description?.trim() ?? "", submoduleId, order: count },
  });
}
