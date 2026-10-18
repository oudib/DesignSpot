"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, destroySession, hasWorkspaceAccess } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { getLinearViewer, getLinearIssue } from "@/lib/linear";
import { buildDesignPrompt } from "@/lib/designPrompt";
import { encryptSecret } from "@/lib/crypto";
import { actingLinearKey } from "@/lib/linearSync";
import * as tickets from "@/lib/tickets";
import * as deliveries from "@/lib/deliveries";

// Ticket and delivery mutations are thin wrappers over src/lib/tickets.ts and
// src/lib/deliveries.ts — the same functions back the REST API in /api/v1, so
// permission rules, validation and Linear sync live in one place.

async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login?from=/manage");
  // Role comes from the DB, not the JWT, so revoking workspace access in
  // /manage/users locks mutations out immediately.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!hasWorkspaceAccess(user?.role)) redirect("/");
  return { userId: session.userId, isAdmin: user?.role === "admin" };
}

function s(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/* ----------------------------- Auth ----------------------------- */

export async function logout() {
  await destroySession();
  redirect("/login");
}

/* ------------------------- Linear connection -------------------------- */
// Per-designer connect/disconnect for the settings page. The key is validated
// against Linear before saving and stored encrypted; it's never sent back to
// the browser.

export type ConnectResult = { ok: boolean; message: string };

export async function connectLinear(
  _prev: ConnectResult | null,
  fd: FormData
): Promise<ConnectResult> {
  const session = await requireAuth();
  const apiKey = s(fd, "apiKey");
  if (!apiKey) return { ok: false, message: "Paste your Linear API key first." };
  const viewer = await getLinearViewer(apiKey);
  if (!viewer) {
    return {
      ok: false,
      message: "That key didn't work — double-check it and try again.",
    };
  }
  await prisma.user.update({
    where: { id: session.userId },
    data: { linearApiKey: encryptSecret(apiKey) },
  });
  revalidatePath("/manage/settings");
  return { ok: true, message: `Connected as ${viewer.name} (${viewer.email}).` };
}

export async function disconnectLinear() {
  const session = await requireAuth();
  await prisma.user.update({
    where: { id: session.userId },
    data: { linearApiKey: null },
  });
  revalidatePath("/manage/settings");
}

/* --------------------------- Solutions -------------------------- */

export async function createSolution(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  if (!name) return;
  const slug = s(fd, "slug") || slugify(name);
  const count = await prisma.solution.count();
  await prisma.solution.create({
    data: {
      name,
      slug,
      tagline: s(fd, "tagline"),
      description: s(fd, "description"),
      color: s(fd, "color") || "#3464f6",
      icon: s(fd, "icon") || "✦",
      language: s(fd, "language") || "en",
      order: count,
    },
  });
  revalidateAll();
}

export async function updateSolution(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.solution.update({
    where: { id },
    data: {
      name: s(fd, "name"),
      tagline: s(fd, "tagline"),
      description: s(fd, "description"),
      color: s(fd, "color") || "#3464f6",
      icon: s(fd, "icon") || "✦",
      language: s(fd, "language") || "en",
    },
  });
  revalidateAll();
}

export async function deleteSolution(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.solution.delete({ where: { id } });
  revalidateAll();
}

/* ---------------------------- Modules --------------------------- */

export async function createModule(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  const solutionId = s(fd, "solutionId");
  if (!name || !solutionId) return;
  const count = await prisma.module.count({ where: { solutionId } });
  await prisma.module.create({
    data: { name, slug: slugify(name) || `m-${count}`, solutionId, order: count },
  });
  revalidateAll();
}

export async function updateModule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.module.update({ where: { id }, data: { name: s(fd, "name") } });
  revalidateAll();
}

export async function deleteModule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.module.delete({ where: { id } });
  revalidateAll();
}

/* -------------------------- Submodules -------------------------- */

export async function createSubmodule(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  const moduleId = s(fd, "moduleId");
  if (!name || !moduleId) return;
  const count = await prisma.submodule.count({ where: { moduleId } });
  await prisma.submodule.create({
    data: { name, slug: slugify(name) || `sm-${count}`, moduleId, order: count },
  });
  revalidateAll();
}

export async function updateSubmodule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.submodule.update({ where: { id }, data: { name: s(fd, "name") } });
  revalidateAll();
}

export async function deleteSubmodule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.submodule.delete({ where: { id } });
  revalidateAll();
}

/* ----------------------------- Flows ---------------------------- */

export async function createFlow(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  const submoduleId = s(fd, "submoduleId");
  if (!name || !submoduleId) return;
  const count = await prisma.flow.count({ where: { submoduleId } });
  await prisma.flow.create({
    data: {
      name,
      description: s(fd, "description"),
      submoduleId,
      order: count,
    },
  });
  revalidateAll();
}

export async function updateFlow(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.flow.update({
    where: { id },
    data: {
      name: s(fd, "name"),
      description: s(fd, "description"),
    },
  });
  revalidateAll();
}

export async function deleteFlow(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.flow.delete({ where: { id } });
  revalidateAll();
}

/* ------------------------- Linear tickets ----------------------- */
// Multiple per flow, each dated — a change history for the flow.

function parseDate(value: string): Date {
  const d = value ? new Date(value) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function createLinearTicket(fd: FormData) {
  await requireAuth();
  const url = s(fd, "url");
  const flowId = s(fd, "flowId");
  if (!url || !flowId) return;
  await prisma.linearTicket.create({
    data: {
      url,
      label: s(fd, "label"),
      date: parseDate(s(fd, "date")),
      flowId,
    },
  });
  revalidateAll();
}

export async function updateLinearTicket(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.linearTicket.update({
    where: { id },
    data: {
      url: s(fd, "url"),
      label: s(fd, "label"),
      date: parseDate(s(fd, "date")),
    },
  });
  revalidateAll();
}

export async function deleteLinearTicket(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.linearTicket.delete({ where: { id } });
  revalidateAll();
}

/* ---------------------------- Designs --------------------------- */

export async function createDesign(fd: FormData) {
  const actor = await requireAuth();
  // The design link can be a Claude share link or a Google Drive link — the
  // delivery dialog sends it as "linkUrl", older forms still send "claudeUrl".
  const file = fd.get("file");
  await deliveries.createDelivery(actor, {
    title: s(fd, "title"),
    linkUrl: s(fd, "linkUrl") || s(fd, "claudeUrl"),
    variant: s(fd, "variant"),
    flowId: s(fd, "flowId") || null,
    // Set when delivered from a ticket (board drag-to-done or the ticket detail
    // page) — lets that ticket show only its own deliverables.
    ticketId: s(fd, "ticketId") || null,
    markDone: s(fd, "markDone") === "1",
    file: file instanceof File ? file : null,
  });
  revalidateAll();
}

export async function updateDesign(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await deliveries.updateDelivery(actor, id, {
    title: s(fd, "title"),
    linkUrl: s(fd, "claudeUrl"),
    variant: s(fd, "variant"),
  });
  revalidateAll();
}

export async function deleteDesign(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await deliveries.deleteDelivery(actor, id);
  revalidateAll();
}

/* ------------------------- Design attachments ------------------------ */
// Files (images, PDFs, zips…) and standalone HTML exports attached to a
// design, stored in Google Drive — this only persists the metadata.

export async function addDesignAttachment(fd: FormData) {
  const actor = await requireAuth();
  const designId = s(fd, "designId");
  const file = fd.get("file");
  if (!designId || !(file instanceof File) || file.size === 0) return;
  await deliveries.addDeliveryFile(actor, designId, file);
  revalidateAll();
}

/**
 * Upload a redesign as the next version of an existing attachment instead of a
 * new, unrelated file. The chain's first version keeps its Drive id, so the
 * `/preview/{driveId}` link already shared in Linear comments now renders this
 * new version — reviewers don't need a new link.
 */
export async function addDesignRevision(fd: FormData) {
  const actor = await requireAuth();
  const attachmentId = s(fd, "attachmentId");
  const file = fd.get("file");
  if (!attachmentId || !(file instanceof File) || file.size === 0) return;
  await deliveries.addDeliveryRevision(actor, attachmentId, file);
  revalidateAll();
}

export async function deleteDesignAttachment(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await deliveries.deleteDeliveryFile(actor, id);
  revalidateAll();
}

/* ---------------------------- Tickets --------------------------- */

export async function createTicket(fd: FormData) {
  const actor = await requireAuth();
  if (!s(fd, "title")) return;
  await tickets.createTicket(actor, {
    title: s(fd, "title"),
    description: s(fd, "description"),
    status: s(fd, "status") || "todo",
    priority: s(fd, "priority") || "medium",
    linearUrl: s(fd, "linearUrl"),
    assigneeId: s(fd, "assigneeId") || null,
    solutionId: s(fd, "solutionId") || null,
    flowId: s(fd, "flowId") || null,
  });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
}

export async function updateTicket(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await tickets.updateTicket(actor, id, {
    title: s(fd, "title"),
    description: s(fd, "description"),
    status: s(fd, "status") || "todo",
    priority: s(fd, "priority") || "medium",
    linearUrl: s(fd, "linearUrl"),
    assigneeId: s(fd, "assigneeId") || null,
    solutionId: s(fd, "solutionId") || null,
    flowId: s(fd, "flowId") || null,
  });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
}

export async function setTicketStatus(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  const status = s(fd, "status");
  if (!id || !status) return;
  await tickets.setTicketStatus(actor, id, status);
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
  revalidatePath(`/manage/tickets/${id}`);
}

export async function deleteTicket(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await tickets.deleteTicket(actor, id);
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
}

// Update the core fields from the ticket detail page. Deliberately does NOT
// touch the hierarchy location (solution/flow) — that's edited from the board
// where the hierarchy picker lives, so we never accidentally clear it here.
export async function updateTicketDetails(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await tickets.updateTicket(actor, id, {
    title: s(fd, "title"),
    description: s(fd, "description"),
    status: s(fd, "status") || "todo",
    priority: s(fd, "priority") || "medium",
    // The Linear link is edited from its own sidebar card (linkTicketLinear), so
    // a form that doesn't carry the field leaves the existing link untouched.
    ...(fd.has("linearUrl") ? { linearUrl: s(fd, "linearUrl") } : {}),
    assigneeId: s(fd, "assigneeId") || null,
    // Hierarchy isn't edited here, so solution/flow stay whatever they were.
  });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
  revalidatePath(`/manage/tickets/${id}`);
}

// Set (or change) where a ticket lives in the hierarchy from the ticket detail
// page. The picker can create the solution/module/submodule/flow inline, so a
// ticket that was filed without a flow can get one without leaving the page.
export async function setTicketLocation(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const flowId = s(fd, "flowId") || null;
  if (!flowId) throw new Error("Pick or create a flow first.");
  // A newly attached flow gets the flow-link comment on the Linear issue.
  await tickets.updateTicket(actor, id, {
    solutionId: s(fd, "solutionId") || null,
    flowId,
  });
  revalidateAll();
}

// Attach, replace or clear the Linear issue on a ticket from the detail page.
export async function linkTicketLinear(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const linearUrl = s(fd, "linearUrl");
  if (linearUrl && !/linear\.app\//i.test(linearUrl)) {
    throw new Error("That doesn't look like a Linear link.");
  }
  // Fresh link → flow-link comment (when there's a flow) + current status.
  await tickets.updateTicket(actor, id, { linearUrl });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
  revalidatePath(`/manage/tickets/${id}`);
}

export async function deleteTicketAndRedirect(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await tickets.deleteTicket(actor, id);
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
  redirect("/manage/tickets");
}

/**
 * Build a Claude design-brief prompt for a ticket: pulls the ticket's hierarchy
 * (solution → flow), enriches it with the live Linear issue when one is linked,
 * and folds in the solution's brand color + a set of design rules. Returned to
 * the client to copy into Claude.
 */
export async function generateDesignPrompt(
  ticketId: string
): Promise<{ prompt: string } | { error: string }> {
  const session = await requireAuth();
  if (!ticketId) return { error: "Missing ticket." };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      solution: true,
      flow: {
        include: { submodule: { include: { module: true } } },
      },
    },
  });
  if (!ticket) return { error: "Ticket not found." };

  // Enrich with the live Linear issue when one is linked (best-effort).
  const linear = ticket.linearUrl
    ? await getLinearIssue(await actingLinearKey(session.userId), ticket.linearUrl)
    : null;

  // Template priority: the assigned designer's own override, then the
  // ticket's solution override, then the built-in default — all edited by
  // an admin in /manage/prompt-builder.
  const designerTemplate = ticket.assigneeId
    ? await prisma.promptTemplate.findUnique({ where: { userId: ticket.assigneeId } })
    : null;
  const template = designerTemplate?.body ?? ticket.solution?.promptTemplate ?? undefined;

  const prompt = buildDesignPrompt(
    {
      ticket: {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        linearUrl: ticket.linearUrl,
      },
      solution: ticket.solution
        ? {
            name: ticket.solution.name,
            tagline: ticket.solution.tagline,
            description: ticket.solution.description,
            color: ticket.solution.color,
            language: ticket.solution.language,
          }
        : null,
      path: {
        module: ticket.flow?.submodule?.module?.name ?? null,
        submodule: ticket.flow?.submodule?.name ?? null,
        flow: ticket.flow?.name ?? null,
      },
      linear,
    },
    template
  );

  return { prompt };
}

/* ---------------------------- Comments -------------------------- */

export async function addComment(fd: FormData) {
  const actor = await requireAuth();
  const ticketId = s(fd, "ticketId");
  const body = s(fd, "body");
  if (!ticketId || !body) return;
  await tickets.addComment(actor, ticketId, body);
  revalidatePath(`/manage/tickets/${ticketId}`);
}

export async function deleteComment(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  const ticketId = s(fd, "ticketId");
  if (id) await prisma.comment.delete({ where: { id } });
  if (ticketId) revalidatePath(`/manage/tickets/${ticketId}`);
}

/* ------------- Quick-create (used by the ticket picker) -------------- */
// These accept plain string args, create the record, and RETURN the new
// row so the client can append it to the dropdowns and select it.

const PALETTE = [
  "#1f47eb", "#0ea5a3", "#f97316", "#a855f7",
  "#e11d48", "#2563eb", "#059669", "#0f172a",
];

async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
) {
  const root = base || "item";
  let slug = root;
  let n = 2;
  while (await exists(slug)) slug = `${root}-${n++}`;
  return slug;
}

export async function quickCreateSolution(name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean) throw new Error("Name required");
  const count = await prisma.solution.count();
  const slug = await uniqueSlug(
    slugify(clean),
    async (sl) => !!(await prisma.solution.findUnique({ where: { slug: sl } }))
  );
  const row = await prisma.solution.create({
    data: {
      name: clean,
      slug,
      color: PALETTE[count % PALETTE.length],
      icon: "✦",
      language: "en",
      order: count,
    },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}

export async function quickCreateModule(solutionId: string, name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean || !solutionId) throw new Error("Missing data");
  const count = await prisma.module.count({ where: { solutionId } });
  const slug = await uniqueSlug(
    slugify(clean),
    async (sl) =>
      !!(await prisma.module.findUnique({
        where: { solutionId_slug: { solutionId, slug: sl } },
      }))
  );
  const row = await prisma.module.create({
    data: { name: clean, slug, solutionId, order: count },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}

export async function quickCreateSubmodule(moduleId: string, name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean || !moduleId) throw new Error("Missing data");
  const count = await prisma.submodule.count({ where: { moduleId } });
  const slug = await uniqueSlug(
    slugify(clean),
    async (sl) =>
      !!(await prisma.submodule.findUnique({
        where: { moduleId_slug: { moduleId, slug: sl } },
      }))
  );
  const row = await prisma.submodule.create({
    data: { name: clean, slug, moduleId, order: count },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}

export async function quickCreateFlow(submoduleId: string, name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean || !submoduleId) throw new Error("Missing data");
  const count = await prisma.flow.count({ where: { submoduleId } });
  const row = await prisma.flow.create({
    data: { name: clean, submoduleId, order: count },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}
